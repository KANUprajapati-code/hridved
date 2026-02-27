import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';
import Order from '../models/Order.js';

dotenv.config();

const router = express.Router();

// Helper to get Razorpay instance with fresh env vars
const getRazorpayInstance = () => {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret || key_id === 'your_key_id' || key_secret === 'your_razorpay_key_secret') {
        console.error('[RAZORPAY] CRITICAL: Keys missing or invalid in process.env');
        return null;
    }

    return new Razorpay({
        key_id,
        key_secret,
    });
};


// @desc    Create Razorpay Order
// @route   POST /api/razorpay/order
router.post('/order', async (req, res) => {
    const { amount, currency = 'INR', receipt } = req.body;
    console.log(`[RAZORPAY] Create Order Request: Amount=${amount}, Receipt=${receipt}`);

    try {
        const razorpay = getRazorpayInstance();
        if (!razorpay) {
            return res.status(500).json({
                success: false,
                message: 'Razorpay is not configured on the server. Please check environment variables.'
            });
        }

        const options = {
            amount: Math.round(amount * 100), // Ensure it's an integer
            currency,
            receipt,
        };

        const order = await razorpay.orders.create(options);
        res.status(201).json({ success: true, data: order });
    } catch (error) {
        console.error('[RAZORPAY] Create Order CRITICAL Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// @desc    Pre-save Razorpay Order ID to DB Order
// @route   PATCH /api/razorpay/pre-save/:orderId
router.patch('/pre-save/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const { razorpayOrderId } = req.body;

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            console.error(`[DB] Pre-save FAILED: Order ${orderId} not found`);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        order.razorpayOrderId = razorpayOrderId;
        await order.save();
        console.log(`[DB] Pre-save SUCCESS: Razorpay ID ${razorpayOrderId} linked to Order ${orderId}`);
        res.json({ success: true, message: 'Order reference saved' });
    } catch (error) {
        console.error('[DB] Pre-save Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// @desc    Verify Razorpay Payment
// @route   POST /api/razorpay/verify
router.post('/verify', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
    console.log(`[RAZORPAY] Manual Verification: Order=${orderId}, RZP_Order=${razorpay_order_id}`);

    try {
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            console.error('[RAZORPAY] Signature Mismatch!');
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        console.log('[RAZORPAY] Signature Valid. Fetching order...');
        const order = await Order.findById(orderId).populate('user', 'email name');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // 1. Update Payment Status if not already paid
        if (!order.isPaid) {
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
            console.log(`[ORDER] ${order._id} marked as PAID via Verification.`);

            // 2. Trigger Shipment (ONLY if just updated to paid)
            try {
                const { processFshipShipment } = await import('../utils/fshipService.js');
                await processFshipShipment(order._id);
            } catch (shipmentError) {
                console.error(`[RAZORPAY] Fship Shipment Trigger Failed for Order ${order._id}:`, shipmentError.message);
                // We do NOT throw here so that the verification response remains successful
            }
        } else {
            console.log(`[RAZORPAY] Order ${order._id} already marked as paid. Skipping update.`);
        }

        res.json({ success: true, message: 'Payment verified and order updated' });
    } catch (error) {
        console.error('[RAZORPAY] Verification CRITICAL Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// @desc    Razorpay Webhook
// @route   POST /api/razorpay/webhook
router.post('/webhook', async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    console.log(`[WEBHOOK] Incoming from IP: ${clientIp}`);
    console.log(`[WEBHOOK] Signature: ${signature ? 'PRESENT' : 'MISSING'}`);
    console.log(`[WEBHOOK] Secret Configured: ${secret ? 'YES' : 'NO'}`);

    try {
        const shasum = crypto.createHmac('sha256', secret);
        shasum.update(req.rawBody);
        const digest = shasum.digest('hex');

        if (digest !== signature) {
            console.warn('[WEBHOOK] Invalid Signature Attempt!');
            return res.status(400).json({ success: false, message: 'Invalid signature' });
        }

        const { event, payload } = req.body;
        console.log(`[WEBHOOK] Verified signature for event: ${event}`);

        // Handle both payment.captured and order.paid for maximum reliability
        if (event === 'payment.captured' || event === 'order.paid') {
            const payment = event === 'payment.captured' ? payload.payment.entity : payload.order.entity;
            const rzp_order_id = event === 'payment.captured' ? payment.order_id : payment.id;
            const rzp_payment_id = event === 'payment.captured' ? payment.id : 'LINKED_TO_ORDER';

            console.log(`[WEBHOOK] Processing RZP Order ID: ${rzp_order_id}`);

            const order = await Order.findOne({ razorpayOrderId: rzp_order_id }).populate('user', 'email name');

            if (!order) {
                console.error(`[WEBHOOK] Order NOT FOUND for RZP ID: ${rzp_order_id}`);
                return res.status(200).json({ status: 'ok', message: 'Order not found, but webhook acknowledged' });
            }

            // Update if not paid
            if (!order.isPaid) {
                order.isPaid = true;
                order.paidAt = Date.now();
                order.paymentResult = {
                    id: rzp_payment_id,
                    status: 'succeeded',
                    update_time: Date.now().toString(),
                    email_address: order.user ? order.user.email : 'N/A',
                };
                order.razorpayPaymentId = rzp_payment_id;
                order.razorpaySignature = 'WEBHOOK_VERIFIED';
                await order.save();
                console.log(`[ORDER] ${order._id} marked as PAID via Webhook.`);

                // Trigger Shipment (ONLY if just updated to paid)
                try {
                    const { processFshipShipment } = await import('../utils/fshipService.js');
                    await processFshipShipment(order._id);
                } catch (shipmentError) {
                    console.error(`[WEBHOOK] Fship Shipment Trigger Failed for Order ${order._id}:`, shipmentError.message);
                }
            } else {
                console.log(`[WEBHOOK] Order ${order._id} already paid. Skipping shipment trigger.`);
            }
        }

        res.json({ status: 'ok' });
    } catch (error) {
        console.error('[WEBHOOK] Process Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// @desc    Get Razorpay Key ID
// @route   GET /api/razorpay/key
router.get('/key', (req, res) => {
    if (!process.env.RAZORPAY_KEY_ID) {
        return res.status(500).json({ success: false, message: 'Razorpay key not configured' });
    }
    res.json({ success: true, key: process.env.RAZORPAY_KEY_ID });
});

export default router;
