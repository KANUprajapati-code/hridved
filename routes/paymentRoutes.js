import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { protect } from '../middleware/authMiddleware.js';

dotenv.config();

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// @desc    Get Stripe Publishable Key
// @route   GET /api/payment/stripe/config
router.get('/config', (req, res) => {
    res.json({
        success: true,
        publicKey: process.env.STRIPE_PUBLISHABLE_KEY || ''
    });
});

// @desc    Create Payment Intent
// @route   POST /api/payment/create-intent
router.post('/create-intent', protect, async (req, res) => {
    const { amount, currency = 'inr' } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    try {
        console.log(`[STRIPE] Creating Intent: ${amount} ${currency}`);
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // convert to smallest currency unit
            currency,
            automatic_payment_methods: {
                enabled: true,
            },
        });

        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        console.error('[STRIPE] Intent Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
