import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import User from '../models/User.js';
import SystemConfig from '../models/SystemConfig.js';

// @desc    Create order from checkout (saves address and shipping method)
// @route   POST /api/checkout/create-order
// @access  Public / OptionalAuth
export const createCheckoutOrder = async (req, res) => {
    try {
        const {
            addressId,
            shippingAddress,
            address: directAddress,
            deliveryOption = 'Standard',
            orderItems,
            itemsPrice,
            shippingPrice = 0,
            totalPrice,
            paymentMethod = 'COD',
            shippingProvider = 'Vamaship',
            discountAmount = 0,
            email,
        } = req.body;

        const userId = req.user?._id ? req.user._id.toString() : 'Guest';
        console.log(`[CHECKOUT] Creating Order for User: ${userId}, Method: ${paymentMethod}, Total: ${totalPrice}`);

        // 1. Validation for order items
        if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
            return res.status(400).json({ success: false, message: 'Your cart / order items cannot be empty' });
        }

        // 2. Resolve Address: Try finding from DB if valid ObjectId, otherwise use embedded address object
        let resolvedAddress = null;
        const Address = (await import('../models/Address.js')).default;

        if (addressId && mongoose.Types.ObjectId.isValid(addressId)) {
            try {
                const found = await Address.findById(addressId);
                if (found) {
                    resolvedAddress = {
                        addressId: found._id,
                        fullName: found.fullName,
                        mobileNumber: found.mobileNumber,
                        houseNumber: found.houseNumber,
                        landmark: found.landmark || '',
                        city: found.city,
                        state: found.state,
                        pincode: found.pincode,
                        addressType: found.addressType || 'Home',
                    };
                }
            } catch (addrErr) {
                console.warn('[CHECKOUT] Address lookup error, falling back to embedded address:', addrErr.message);
            }
        }

        // Fallback to embedded shippingAddress or directAddress from request body
        if (!resolvedAddress) {
            const raw = shippingAddress || directAddress;
            if (raw && (raw.fullName || raw.name) && (raw.mobileNumber || raw.phone) && (raw.houseNumber || raw.street || raw.address) && raw.city && raw.state && (raw.pincode || raw.postalCode)) {
                resolvedAddress = {
                    addressId: (raw._id && mongoose.Types.ObjectId.isValid(raw._id)) ? raw._id : undefined,
                    fullName: raw.fullName || raw.name,
                    mobileNumber: raw.mobileNumber || raw.phone,
                    houseNumber: raw.houseNumber || raw.street || raw.address,
                    landmark: raw.landmark || '',
                    city: raw.city,
                    state: raw.state,
                    pincode: raw.pincode || raw.postalCode,
                    addressType: raw.addressType || 'Home',
                };
            }
        }

        if (!resolvedAddress) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide complete delivery address details (Name, Phone, Address, City, State, Pincode)' 
            });
        }

        // 3. Resolve and sanitize Order Items to ensure valid ObjectIds for Product schema
        const Product = (await import('../models/Product.js')).default;
        const cleanOrderItems = [];

        for (const item of orderItems) {
            let pId = item.product || item._id;
            let productDoc = null;

            if (pId && mongoose.Types.ObjectId.isValid(pId)) {
                productDoc = await Product.findById(pId);
            }

            if (!productDoc && item.name) {
                const cleanName = item.name.split('(')[0].trim();
                productDoc = await Product.findOne({ name: new RegExp(cleanName, 'i') });
            }

            if (!productDoc) {
                // Catalog fallback to ensure schema validity
                productDoc = await Product.findOne();
            }

            cleanOrderItems.push({
                name: item.name || productDoc?.name || 'Ayurvedic Wellness Product',
                qty: Number(item.qty) || 1,
                image: item.image || productDoc?.image || '/logo-modified.png',
                price: Number(item.price) || productDoc?.price || 0,
                weight: Number(item.weight) || productDoc?.weight || 0.5,
                product: productDoc?._id || new mongoose.Types.ObjectId(),
            });
        }

        // 4. Server-Side Inventory & Stock Validation (Soft check / Non-blocking if fallback)
        try {
            const { validateOrderStock, deductOrderStock } = await import('../utils/inventoryService.js');
            const stockValidation = await validateOrderStock(cleanOrderItems);
            if (!stockValidation.valid) {
                return res.status(400).json({ success: false, message: stockValidation.message });
            }
        } catch (stockErr) {
            console.warn('[CHECKOUT] Stock validation warning:', stockErr.message);
        }

        // 5. Calculate tax based on product-specific GST rates
        let calculatedTaxPrice = 0;
        const productIds = cleanOrderItems.map(item => item.product).filter(Boolean);
        const products = productIds.length > 0 ? await Product.find({ _id: { $in: productIds } }) : [];

        cleanOrderItems.forEach(item => {
            const product = products.find(p => p._id.toString() === item.product?.toString());
            const gstRate = product ? (product.gst / 100) : 0;
            calculatedTaxPrice += item.price * item.qty * gstRate;
        });
        calculatedTaxPrice = Math.round(calculatedTaxPrice * 100) / 100;

        let codPrice = 0;
        if (paymentMethod === 'COD') {
            try {
                const config = await SystemConfig.findOne();
                if (config?.shipping?.isCodFeeEnabled) {
                    codPrice = Math.max(0, Number(config.shipping.codFee) || 0);
                }
            } catch (err) {
                console.warn('[CHECKOUT] SystemConfig lookup failed for COD fee:', err.message);
                codPrice = 0;
            }
        }
        const finalDeliveryOption = (deliveryOption && typeof deliveryOption === 'string' && deliveryOption.trim() !== '') ? deliveryOption.trim() : 'Standard';
        const ALLOWED_PROVIDERS = ['Vamaship', 'Local', 'Local Courier', 'Standard', 'Custom', 'Delhivery', 'Shiprocket', 'Other'];
        const finalShippingProvider = (shippingProvider && ALLOWED_PROVIDERS.includes(shippingProvider)) ? shippingProvider : 'Local Courier';
        const finalItemsPrice = Number(itemsPrice) || cleanOrderItems.reduce((acc, it) => acc + (it.price * it.qty), 0);
        const finalShippingPrice = Number(shippingPrice) || 0;
        const finalDiscount = Number(discountAmount) || 0;
        const finalTotalPrice = totalPrice ? Number(totalPrice) : Math.max(0, finalItemsPrice + calculatedTaxPrice + finalShippingPrice + codPrice - finalDiscount);

        // 6. Create Order
        const order = new Order({
            user: req.user?._id || undefined,
            orderSource: 'Website',
            email: email || req.user?.email || (shippingAddress && shippingAddress.email) || '',
            orderItems: cleanOrderItems,
            shippingAddress: resolvedAddress,
            deliveryOption: finalDeliveryOption,
            estimatedDeliveryDays: finalDeliveryOption === 'Standard' ? '3-5' : '1-2',
            itemsPrice: finalItemsPrice,
            taxPrice: calculatedTaxPrice,
            shippingPrice: finalShippingPrice,
            codPrice,
            discountAmount: finalDiscount,
            totalPrice: finalTotalPrice,
            paymentMethod: paymentMethod,
            shippingProvider: finalShippingProvider,
            shippingStatus: 'Processing',
            isPaid: false,
        });

        const createdOrder = await order.save();

        // 7. Handle Post-Creation Actions for COD
        if (paymentMethod === 'COD') {
            // Clear user cart if logged in
            if (req.user?._id) {
                try {
                    await Cart.deleteOne({ user: req.user._id });
                    console.log(`[CHECKOUT] Cart cleared for user: ${req.user._id}`);
                } catch (cartError) {
                    console.error('[CHECKOUT] Error clearing cart for COD:', cartError);
                }
            }

            // Generate Waybill
            createdOrder.waybill = `HRD${Math.floor(10000000 + Math.random() * 90000000)}`;
            await createdOrder.save();

            // Deduct stock safely
            try {
                const { deductOrderStock } = await import('../utils/inventoryService.js');
                await deductOrderStock(cleanOrderItems);
            } catch (deductErr) {
                console.error('[CHECKOUT] Stock deduction error for COD:', deductErr);
            }

            // Trigger Order Confirmation Notification
            try {
                const { sendOrderConfirmation } = await import('../utils/notificationService.js');
                await sendOrderConfirmation(createdOrder._id);
            } catch (notifyErr) {
                console.warn('[CHECKOUT] Order confirmation notification warning:', notifyErr.message);
            }
        }

        console.log(`[CHECKOUT] Order Created Successfully: ${createdOrder._id} (Method: ${paymentMethod})`);
        res.status(201).json({ success: true, data: createdOrder });

    } catch (error) {
        console.error('[CHECKOUT] Create Order Error:', error);
        res.status(500).json({ success: false, message: error.message || 'Internal server error while creating order' });
    }
};

// @desc    Get order details for checkout
// @route   GET /api/checkout/order/:orderId
// @access  Public / OptionalAuth
export const getCheckoutOrder = async (req, res) => {
    try {
        console.log(`[CHECKOUT] Fetching Order: ${req.params.orderId}`);
        const order = await Order.findById(req.params.orderId).populate('user', 'name email');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Verify order belongs to user if authenticated and order is user-bound
        if (order.user && req.user && order.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
        }

        res.json({ success: true, data: order });

    } catch (error) {
        console.error('[CHECKOUT] Get Order Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

