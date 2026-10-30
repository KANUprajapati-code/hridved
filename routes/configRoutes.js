import express from 'express';
import { getShippingConfig, updateShippingConfig } from '../controllers/configController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/shipping', getShippingConfig);
router.put('/shipping', protect, admin, updateShippingConfig);

// @desc    Get Razorpay Public Key Alias
// @route   GET /api/config/razorpay
router.get('/razorpay', (req, res) => {
    const key = process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.trim() : '';
    res.json({ success: !!key, key: key || null });
});

export default router;
