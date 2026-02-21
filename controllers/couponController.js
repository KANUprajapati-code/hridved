import Coupon from '../models/Coupon.js';
import asyncHandler from 'express-async-handler';

// @desc    Validate a promo code
// @route   POST /api/coupons/validate
// @access  Public
const validateCoupon = asyncHandler(async (req, res) => {
    const { code, cartTotal } = req.body;

    if (!code) {
        res.status(400);
        throw new Error('Please provide a promo code');
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

    if (!coupon) {
        res.status(404);
        throw new Error('Invalid or inactive promo code');
    }

    // Check expiry
    if (coupon.expiryDate < new Date()) {
        res.status(400);
        throw new Error('Promo code has expired');
    }

    // Check min order amount
    if (cartTotal < coupon.minOrderAmount) {
        res.status(400);
        throw new Error(`Minimum order amount of ₹${coupon.minOrderAmount} required for this coupon`);
    }

    res.json({
        code: coupon.code,
        discount: coupon.discount,
        type: coupon.type,
    });
});

// @desc    Get all coupons
// @route   GET /api/coupons
// @access  Private/Admin
const getCoupons = asyncHandler(async (req, res) => {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });
    res.json(coupons);
});

// @desc    Create a coupon
// @route   POST /api/coupons
// @access  Private/Admin
const createCoupon = asyncHandler(async (req, res) => {
    const { code, discount, type, expiryDate, minOrderAmount } = req.body;

    const couponExists = await Coupon.findOne({ code: code.toUpperCase() });

    if (couponExists) {
        res.status(400);
        throw new Error('Coupon code already exists');
    }

    const coupon = await Coupon.create({
        code,
        discount,
        type,
        expiryDate,
        minOrderAmount,
    });

    if (coupon) {
        res.status(201).json(coupon);
    } else {
        res.status(400);
        throw new Error('Invalid coupon data');
    }
});

// @desc    Update a coupon
// @route   PUT /api/coupons/:id
// @access  Private/Admin
const updateCoupon = asyncHandler(async (req, res) => {
    const coupon = await Coupon.findById(req.params.id);

    if (coupon) {
        coupon.code = req.body.code || coupon.code;
        coupon.discount = req.body.discount ?? coupon.discount;
        coupon.type = req.body.type || coupon.type;
        coupon.isActive = req.body.isActive ?? coupon.isActive;
        coupon.expiryDate = req.body.expiryDate || coupon.expiryDate;
        coupon.minOrderAmount = req.body.minOrderAmount ?? coupon.minOrderAmount;

        const updatedCoupon = await coupon.save();
        res.json(updatedCoupon);
    } else {
        res.status(404);
        throw new Error('Coupon not found');
    }
});

// @desc    Delete a coupon
// @route   DELETE /api/coupons/:id
// @access  Private/Admin
const deleteCoupon = asyncHandler(async (req, res) => {
    const coupon = await Coupon.findById(req.params.id);

    if (coupon) {
        await coupon.deleteOne();
        res.json({ message: 'Coupon removed' });
    } else {
        res.status(404);
        throw new Error('Coupon not found');
    }
});

export {
    validateCoupon,
    getCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon,
};
