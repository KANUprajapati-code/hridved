import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import User from '../models/User.js';

// @desc    Create order from checkout (saves address and shipping method)
// @route   POST /api/checkout/create-order
// @access  Private
export const createCheckoutOrder = async (req, res) => {
    try {
        const {
            addressId,
            deliveryOption,
            orderItems,
            itemsPrice,
            shippingPrice,
            totalPrice,
            paymentMethod = 'Razorpay',
        } = req.body;

        console.log(`[CHECKOUT] Creating Order for User: ${req.user._id}, Method: ${paymentMethod}`);

        // Validation
        if (!addressId || !deliveryOption || !orderItems || orderItems.length === 0) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // Validate delivery option
        if (!['Standard', 'Express'].includes(deliveryOption)) {
            return res.status(400).json({ success: false, message: 'Invalid delivery option' });
        }

        // Get address details
        const Address = (await import('../models/Address.js')).default;
        const address = await Address.findById(addressId);

        if (!address) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        // Verify address belongs to user
        if (address.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to use this address' });
        }

        // Calculate tax (simplified - 5% GST)
        const taxPrice = Math.round(itemsPrice * 0.05 * 100) / 100;

        // Create order
        const order = new Order({
            user: req.user._id,
            orderItems,
            shippingAddress: {
                addressId: address._id,
                fullName: address.fullName,
                mobileNumber: address.mobileNumber,
                houseNumber: address.houseNumber,
                landmark: address.landmark,
                city: address.city,
                state: address.state,
                pincode: address.pincode,
                addressType: address.addressType,
            },
            deliveryOption,
            estimatedDeliveryDays: deliveryOption === 'Standard' ? '3-5' : '1-2',
            itemsPrice,
            taxPrice,
            shippingPrice,
            totalPrice: itemsPrice + taxPrice + shippingPrice,
            paymentMethod: paymentMethod,
            isPaid: false,
        });

        const createdOrder = await order.save();

        // Handle Post-Creation Actions for COD
        if (paymentMethod === 'COD') {
            // 1. Clear cart immediately
            try {
                const Cart = (await import('../models/Cart.js')).default;
                await Cart.deleteOne({ user: req.user._id });
                console.log(`[CHECKOUT] Cart cleared for COD order: ${createdOrder._id}`);
            } catch (cartError) {
                console.error('[CHECKOUT] Error clearing cart for COD:', cartError);
            }

            // 2. Trigger Shipment Creation
            try {
                const { processFshipShipment } = await import('../utils/fshipService.js');
                await processFshipShipment(createdOrder._id);
                console.log(`[CHECKOUT] Shipment triggered for COD order: ${createdOrder._id}`);
            } catch (shipmentError) {
                console.error('[CHECKOUT] Fship Shipment Error for COD:', shipmentError.message);
            }
        }

        console.log(`[CHECKOUT] Order Created: ${createdOrder._id}`);
        res.status(201).json({ success: true, data: createdOrder });

    } catch (error) {
        console.error('[CHECKOUT] Create Order Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get order details for checkout
// @route   GET /api/checkout/order/:orderId
// @access  Private
export const getCheckoutOrder = async (req, res) => {
    try {
        console.log(`[CHECKOUT] Fetching Order: ${req.params.orderId}`);
        const order = await Order.findById(req.params.orderId).populate('user', 'name email');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Verify order belongs to user
        if (order.user._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
        }

        res.json({ success: true, data: order });

    } catch (error) {
        console.error('[CHECKOUT] Get Order Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

