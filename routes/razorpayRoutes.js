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

// @desc    Pre-save Razorpay Order ID to DB Order (called before payment to enable webhook lookup)
// @route   PATCH /api/razorpay/pre-save/:orderId
// @access  Private
router.patch('/pre-save/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const { razorpayOrderId } = req.body;

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        order.razorpayOrderId = razorpayOrderId;
        await order.save();
        console.log(`Pre-saved razorpayOrderId ${razorpayOrderId} for order ${orderId}`);
        res.json({ message: 'Saved' });
    } catch (error) {
        console.error('Pre-save Error:', error);
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
                    const { createFshipForwardOrder } = await import('../utils/fshipService.js');

                    // Prepare Fship Payload
                    const payload = {
                        customer_Name: order.shippingAddress.fullName,
                        customer_Mobile: order.shippingAddress.mobileNumber,
                        customer_Emailid: order.user?.email || 'customer@example.com',
                        customer_Address: order.shippingAddress.houseNumber,
                        landMark: order.shippingAddress.landmark || '',
                        customer_Address_Type: order.shippingAddress.addressType || 'Home',
                        customer_PinCode: order.shippingAddress.pincode,
                        customer_City: order.shippingAddress.city,
                        orderId: order.orderId || `ORD${Date.now()}`,
                        payment_Mode: 2, // PREPAID (since this is Razorpay verification)
                        express_Type: order.deliveryOption === 'Express' ? 'air' : 'surface',
                        order_Amount: Math.round(order.totalPrice),
                        total_Amount: Math.round(order.totalPrice),
                        cod_Amount: 0,
                        shipment_Weight: 0.5,
                        shipment_Length: 10,
                        shipment_Width: 10,
                        shipment_Height: 10,
                        pick_Address_ID: 0,
                        return_Address_ID: 0,
                        products: order.orderItems.map(item => ({
                            productName: item.name,
                            unitPrice: item.price,
                            quantity: item.qty,
                            sku: String(item.product)
                        }))
                    };

                    const result = await createFshipForwardOrder(payload);

                    if (result && result.status === true) {
                        order.waybill = result.waybill;
                        order.apiOrderId = result.apiorderid;
                        order.shippingStatus = 'Shipped';
                        order.shippingProvider = 'Fship';
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

// @desc    Razorpay Webhook
// @route   POST /api/razorpay/webhook
// @access  Public
router.post('/webhook', async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    console.log('Razorpay Webhook Received');

    try {
        // Verify Webhook Signature
        // We use the raw body for verification to match Razorpay's signature.
        const shasum = crypto.createHmac('sha256', secret);
        shasum.update(req.rawBody);
        const digest = shasum.digest('hex');

        if (digest !== signature) {
            console.error('Webhook Signature Mismatch!');
            return res.status(400).send('Invalid signature');
        }

        const event = req.body.event;
        const payload = req.body.payload;

        if (event === 'payment.captured') {
            const payment = payload.payment.entity;
            const razorpay_order_id = payment.order_id;
            const razorpay_payment_id = payment.id;

            console.log(`Processing captured payment: ${razorpay_payment_id} for order: ${razorpay_order_id}`);

            // Find order by razorpayOrderId
            const order = await Order.findOne({ razorpayOrderId: razorpay_order_id }).populate('user', 'email name');

            if (order && !order.isPaid) {
                order.isPaid = true;
                order.paidAt = Date.now();
                order.paymentResult = {
                    id: razorpay_payment_id,
                    status: 'succeeded',
                    update_time: Date.now().toString(),
                    email_address: order.user ? order.user.email : 'N/A',
                };
                order.razorpayPaymentId = razorpay_payment_id;
                // Signature is not applicable for webhooks in the same way as checkout
                order.razorpaySignature = 'WEBHOOK_VERIFIED';

                await order.save();
                console.log(`Order ${order._id} marked as PAID via Webhook.`);

                // Automatic Fship Shipment Creation
                try {
                    const { createFshipForwardOrder } = await import('../utils/fshipService.js');

                    // Prepare Fship Payload
                    const payload = {
                        customer_Name: order.shippingAddress.fullName,
                        customer_Mobile: order.shippingAddress.mobileNumber,
                        customer_Emailid: order.user?.email || 'customer@example.com',
                        customer_Address: order.shippingAddress.houseNumber,
                        landMark: order.shippingAddress.landmark || '',
                        customer_Address_Type: order.shippingAddress.addressType || 'Home',
                        customer_PinCode: order.shippingAddress.pincode,
                        customer_City: order.shippingAddress.city,
                        orderId: order.orderId || `ORD${Date.now()}`,
                        payment_Mode: 2, // PREPAID
                        express_Type: order.deliveryOption === 'Express' ? 'air' : 'surface',
                        order_Amount: Math.round(order.totalPrice),
                        total_Amount: Math.round(order.totalPrice),
                        cod_Amount: 0,
                        shipment_Weight: 0.5,
                        shipment_Length: 10,
                        shipment_Width: 10,
                        shipment_Height: 10,
                        pick_Address_ID: 0,
                        return_Address_ID: 0,
                        products: order.orderItems.map(item => ({
                            productName: item.name,
                            unitPrice: item.price,
                            quantity: item.qty,
                            sku: String(item.product)
                        }))
                    };

                    const result = await createFshipForwardOrder(payload);

                    if (result && result.status === true) {
                        order.waybill = result.waybill;
                        order.apiOrderId = result.apiorderid;
                        order.shippingStatus = 'Shipped';
                        order.shippingProvider = 'Fship';
                        await order.save();
                        console.log(`Auto-Shipment Created for Order ${order._id} via Webhook.`);
                    }
                } catch (shipError) {
                    console.error(`Failed auto-shipment in Webhook for Order ${order._id}:`, shipError.message);
                }
            } else if (order && order.isPaid) {
                console.log(`Order ${order._id} is already marked as paid.`);
            } else {
                console.error(`No order found for Razorpay Order ID: ${razorpay_order_id}`);
            }
        }

        res.json({ status: 'ok' });

    } catch (error) {
        console.error('Razorpay Webhook Error:', error);
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
