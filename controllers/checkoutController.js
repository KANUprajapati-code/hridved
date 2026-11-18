import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import User from '../models/User.js';
import SystemConfig from '../models/SystemConfig.js';
import { createWayuvegaOrder } from '../utils/wayuvegaService.js';

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
            termsAccepted = true,
            idempotencyKey,
            appliedCoupon,
        } = req.body;

        const effectiveIdempotencyKey = idempotencyKey || req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

        // Idempotency check: prevent duplicate orders on double click or network retry
        if (effectiveIdempotencyKey) {
            const existingOrder = await Order.findOne({ idempotencyKey: effectiveIdempotencyKey });
            if (existingOrder) {
                // If existing order is unpaid and payment method has changed (e.g. from Razorpay to COD), update it
                if (!existingOrder.isPaid) {
                    if (paymentMethod && paymentMethod !== existingOrder.paymentMethod) {
                        existingOrder.paymentMethod = paymentMethod;
                        existingOrder.paymentStatus = 'Pending';
                        existingOrder.orderStatus = paymentMethod === 'COD' ? 'Confirmed' : 'Placed';
                    }
                    if (totalPrice) existingOrder.totalPrice = Number(totalPrice);
                    if (shippingPrice !== undefined) existingOrder.shippingPrice = Number(shippingPrice);
                    if (discountAmount !== undefined) existingOrder.discountAmount = Number(discountAmount);
                    await existingOrder.save();
                }
                console.log(`[CHECKOUT] Idempotency match: Returning existing Order ${existingOrder._id}`);
                return res.status(200).json({ success: true, data: existingOrder, isExisting: true });
            }
        }

        // Terms acceptance guard
        if (termsAccepted === false || termsAccepted === 'false') {
            return res.status(400).json({
                success: false,
                message: 'Please review and accept Hridved Terms & Conditions and Privacy Policy to place your order.'
            });
        }

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
        const ALLOWED_PROVIDERS = ['Wayuvega', 'Delhivery', 'Vamaship', 'Local', 'Local Courier', 'Standard', 'Custom', 'Shiprocket', 'Other'];
        const finalShippingProvider = 'Wayuvega';
        const finalItemsPrice = Number(itemsPrice) || cleanOrderItems.reduce((acc, it) => acc + (it.price * it.qty), 0);
        const finalShippingPrice = Number(shippingPrice) || 0;
        const finalDiscount = Number(discountAmount) || 0;
        const finalTotalPrice = totalPrice ? Number(totalPrice) : Math.max(0, finalItemsPrice + finalShippingPrice + codPrice - finalDiscount);

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
            paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Pending',
            orderStatus: paymentMethod === 'COD' ? 'Confirmed' : 'Placed',
            idempotencyKey: effectiveIdempotencyKey || `idem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            termsAccepted: true,
            guestCheckout: !req.user?._id,
            appliedCoupon: appliedCoupon || undefined,
            shippingProvider: finalShippingProvider,
            shippingStatus: 'Processing',
            isPaid: false,
        });

        const createdOrder = await order.save();

        // Note: Courier / Waybill generation is intentionally NOT performed on draft checkout creation.
        // For Online Payments (Razorpay), courier booking is triggered ONLY after payment is captured & verified.
        // This prevents phantom/auto-generated couriers when users drop off, close the tab, or abandon checkout.
        // For COD, the order is registered with 'Processing' status and courier can be dispatched upon verification.

        // 8. Handle Post-Creation Actions for COD
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

            // Deduct stock safely
            try {
                const { deductOrderStock } = await import('../utils/inventoryService.js');
                await deductOrderStock(cleanOrderItems);
            } catch (deductErr) {
                console.error('[CHECKOUT] Stock deduction error for COD:', deductErr);
            }

            // Trigger Order Confirmation Notification asynchronously without blocking checkout response
            import('../utils/notificationService.js').then(({ sendOrderConfirmation }) => {
                sendOrderConfirmation(createdOrder._id).catch(notifyErr => {
                    console.warn('[CHECKOUT] Order confirmation notification warning:', notifyErr.message);
                });
            }).catch(() => {});
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

