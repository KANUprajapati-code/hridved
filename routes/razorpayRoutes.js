import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';
import Order from '../models/Order.js';

dotenv.config();

const router = express.Router();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @desc    Create Razorpay Order
// @route   POST /api/razorpay/order
// @access  Private
router.post('/order', async (req, res) => {
    const { amount, currency = 'INR', receipt } = req.body;

    try {
        const options = {
            amount: amount * 100, // Amount in paise
            currency,
            receipt,
        };

        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Verify Razorpay Payment
// @route   POST /api/razorpay/verify
// @access  Private
router.post('/verify', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;

    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

    if (expectedSignature === razorpay_signature) {
        // Update Order
        const order = await Order.findById(orderId);
        if (order) {
            order.isPaid = true;
            order.paidAt = Date.now();
            order.paymentResult = {
                id: razorpay_payment_id,
                status: 'succeeded',
                update_time: Date.now(),
                email_address: order.user.email, // Assuming user email is available in order populate
            };
            order.razorpayOrderId = razorpay_order_id;
            order.razorpayPaymentId = razorpay_payment_id;
            order.razorpaySignature = razorpay_signature;

            order.razorpaySignature = razorpay_signature;

            await order.save();

            // Automatic Fship Shipment Creation
            try {
                // Dynamic Import to avoid circular dependency issues if any
                const { createFshipOrder } = await import('../utils/fshipService.js');
                const shipmentData = await createFshipOrder(order);

                if (shipmentData && shipmentData.success) { // Adjust based on actual API success flag
                    order.shipmentId = shipmentData.shipment_id;
                    order.trackingId = shipmentData.awb_number;
                    order.courierName = shipmentData.courier_name;
                    order.shippingStatus = 'Shipped';
                    await order.save();
                    console.log(`Auto-Shipment Created for Order ${order._id}`);
                }
            } catch (shipError) {
                console.error(`Failed to auto-create shipment for Order ${order._id}:`, shipError.message);
                // We don't fail the verification response, just log the error
            }

            res.json({ status: 'success', message: 'Payment verified' });
        } else {
            res.status(404).json({ message: 'Order not found' });
        }

    } else {
        res.status(400).json({ status: 'failure', message: 'Invalid signature' });
    }
});

// @desc    Get Razorpay Key ID
// @route   GET /api/razorpay/key
// @access  Public
router.get('/key', (req, res) => {
    res.send(process.env.RAZORPAY_KEY_ID);
});

export default router;
