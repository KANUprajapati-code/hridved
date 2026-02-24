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
    console.log(`Creating Razorpay Order: Amount=${amount}, Receipt=${receipt}`);

    try {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            throw new Error('Razorpay keys missing in environment variables');
        }

        const options = {
            amount: amount * 100, // Amount in paise
            currency,
            receipt,
        };

        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error('Razorpay Order Error:', error);
        res.status(500).json({ message: error.message });
    }
});

// @desc    Verify Razorpay Payment
// @route   POST /api/razorpay/verify
// @access  Private
router.post('/verify', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
    console.log(`Verifying Razorpay Payment: OrderID=${orderId}, RazorpayOrder=${razorpay_order_id}, PaymentID=${razorpay_payment_id}`);

    const body = razorpay_order_id + '|' + razorpay_payment_id;

    try {
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        console.log(`Signature Check: Expected=${expectedSignature}, Received=${razorpay_signature}`);

        if (expectedSignature === razorpay_signature) {
            console.log('Signature Matched. Updating order...');
            // Update Order
            const order = await Order.findById(orderId).populate('user', 'email name');
            if (order) {
                order.isPaid = true;
                order.paidAt = Date.now();
                order.paymentResult = {
                    id: razorpay_payment_id,
                    status: 'succeeded',
                    update_time: Date.now().toString(),
                    email_address: order.user ? order.user.email : 'N/A',
                };
                order.razorpayOrderId = razorpay_order_id;
                order.razorpayPaymentId = razorpay_payment_id;
                order.razorpaySignature = razorpay_signature;

                await order.save();
                console.log(`Order ${orderId} marked as PAID successfully.`);

                // Automatic Fship Shipment Creation
                try {
                    const { createFshipOrder } = await import('../utils/fshipService.js');
                    const shipmentData = await createFshipOrder(order);
                    console.log('Fship Response:', JSON.stringify(shipmentData));

                    if (shipmentData && (shipmentData.success || shipmentData.status === 'success')) {
                        order.shipmentId = shipmentData.shipment_id || shipmentData.data?.shipment_id;
                        order.trackingId = shipmentData.awb_number || shipmentData.data?.awb_number;
                        order.courierName = shipmentData.courier_name || shipmentData.data?.courier_name;
                        order.shippingStatus = 'Shipped';
                        await order.save();
                        console.log(`Auto-Shipment Created for Order ${order._id}`);
                    }
                } catch (shipError) {
                    console.error(`Failed to auto-create shipment for Order ${order._id}:`, shipError.message);
                }

                res.json({ status: 'success', message: 'Payment verified' });
            } else {
                console.error(`Order ${orderId} not found during verification.`);
                res.status(404).json({ message: 'Order not found' });
            }
        } else {
            console.error('Signature Mismatch!');
            res.status(400).json({ status: 'failure', message: 'Invalid signature' });
        }
    } catch (error) {
        console.error('Razorpay Verification Error:', error);
        res.status(500).json({ message: error.message });
    }
});

// @desc    Get Razorpay Key ID
// @route   GET /api/razorpay/key
// @access  Public
router.get('/key', (req, res) => {
    res.send(process.env.RAZORPAY_KEY_ID);
});

export default router;
