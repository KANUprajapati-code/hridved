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
        } = req.body;

        // Validation
        if (!addressId || !deliveryOption || !orderItems || orderItems.length === 0) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Validate delivery option
        if (!['Standard', 'Express'].includes(deliveryOption)) {
            return res.status(400).json({ message: 'Invalid delivery option' });
        }

        // Get address details
        const Address = (await import('../models/Address.js')).default;
        const address = await Address.findById(addressId);

        if (!address) {
            return res.status(404).json({ message: 'Address not found' });
        }

        // Verify address belongs to user
        if (address.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to use this address' });
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
            paymentMethod: 'Razorpay',
        });

        const createdOrder = await order.save();
        res.status(201).json(createdOrder);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get order details for checkout
// @route   GET /api/checkout/order/:orderId
// @access  Private
export const getCheckoutOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId).populate('user', 'name email');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Verify order belongs to user
        if (order.user._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to view this order' });
        }

        res.json(order);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update order after successful payment
// @route   PUT /api/checkout/confirm-payment/:orderId
// @access  Private
export const confirmPayment = async (req, res) => {
    try {
        const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

        if (!razorpayPaymentId || !razorpayOrderId) {
            return res.status(400).json({ message: 'Payment details missing' });
        }

        const order = await Order.findById(req.params.orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Verify order belongs to user
        if (order.user._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this order' });
        }

        // Update order with payment details
        order.isPaid = true;
        order.paidAt = new Date();
        order.razorpayPaymentId = razorpayPaymentId;
        order.razorpayOrderId = razorpayOrderId;
        order.razorpaySignature = razorpaySignature;

        const updatedOrder = await order.save();

        // Clear user's cart after successful order
        try {
            const Cart = (await import('../models/Cart.js')).default;
            await Cart.deleteOne({ user: req.user._id });
        } catch (cartError) {
            console.error('Error clearing cart:', cartError);
            // Don't fail the order if cart clearing fails
        }

        res.json({
            success: true,
            order: updatedOrder,
            message: 'Payment confirmed and order created successfully',
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
