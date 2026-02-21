import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { createPhonePePayment, checkPhonePeStatus } from '../controllers/paymentController.js';
import { protect } from '../middleware/authMiddleware.js';

dotenv.config();

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// @desc    Get Stripe Publishable Key
// @route   GET /api/config/stripe
// @access  Public (public key is safe to expose)
router.get('/stripe', (req, res) => {
    res.json({
        publicKey: process.env.STRIPE_PUBLISHABLE_KEY || ''
    });
});

// @desc    Create Payment Intent
// @route   POST /api/payment/create-payment-intent
// @access  Private
router.post('/create-payment-intent', async (req, res) => {
    const { amount, currency = 'inr' } = req.body;

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency,
            automatic_payment_methods: {
                enabled: true,
            },
        });

        res.send({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// @desc    Create PhonePe Payment
// @route   POST /api/payment/create
// @access  Private
router.post('/create', protect, createPhonePePayment);

// @desc    Check PhonePe Payment Status (Callback)
// @route   POST /api/payment/status/:merchantTransactionId
// @access  Public
router.post('/status/:merchantTransactionId', checkPhonePeStatus);

export default router;
