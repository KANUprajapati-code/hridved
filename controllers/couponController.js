import Coupon from '../models/Coupon.js';
import asyncHandler from 'express-async-handler';

// @desc    Validate a promo code
// @route   POST /api/coupons/validate
// @access  Public
const validateCoupon = asyncHandler(async (req, res) => {
    const { code, cartTotal = 0 } = req.body;

    if (!code) {
        res.status(400);
        throw new Error('Please provide a promo code');
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

    if (!coupon) {
        res.status(404);
        throw new Error('Invalid or inactive promo code');
    }

    const now = new Date();

    // Check start date
    if (coupon.startDate && coupon.startDate > now) {
        res.status(400);
        throw new Error('Promo code is not yet active');
    }

    // Check expiry
    if (coupon.expiryDate < now) {
        res.status(400);
        throw new Error('Promo code has expired');
    }

    // Check global usage cap
    if (coupon.usageCap && coupon.usageCount >= coupon.usageCap) {
        res.status(400);
        throw new Error('Promo code has reached its maximum global redemptions');
    }

    // Check min order amount
    if (Number(cartTotal) < (coupon.minOrderAmount || 0)) {
        res.status(400);
        throw new Error(`Minimum order amount of ₹${coupon.minOrderAmount} required for coupon ${coupon.code}`);
    }

    res.json({
        code: coupon.code,
        discount: coupon.discount,
        type: coupon.type,
        maxDiscount: coupon.maxDiscount || 0,
        minOrderAmount: coupon.minOrderAmount || 0,
        description: coupon.description || (coupon.type === 'percentage' ? `${coupon.discount}% OFF` : `₹${coupon.discount} FLAT OFF`),
    });
});

// @desc    Get active coupons for shoppers to view on Cart
// @route   GET /api/coupons/active
// @access  Public
const getActiveCoupons = asyncHandler(async (req, res) => {
    const now = new Date();
    const coupons = await Coupon.find({
        isActive: true,
        expiryDate: { $gt: now },
        $or: [
            { startDate: { $lte: now } },
            { startDate: { $exists: false } },
            { startDate: null }
        ]
    })
    .select('code discount type minOrderAmount maxDiscount description')
    .sort({ minOrderAmount: 1 })
    .lean();

    res.json(coupons);
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
    const { 
        code, 
        discount, 
        type, 
        startDate,
        expiryDate, 
        minOrderAmount,
        maxDiscount,
        usageCap,
        perCustomerLimit,
        categoryScope,
        productScope,
        canStack,
        description
    } = req.body;

    const couponExists = await Coupon.findOne({ code: code.toUpperCase() });

    if (couponExists) {
        res.status(400);
        throw new Error('Coupon code already exists');
    }

    const coupon = await Coupon.create({
        code: code.toUpperCase().trim(),
        discount,
        type: type || 'percentage',
        startDate: startDate || Date.now(),
        expiryDate,
        minOrderAmount: minOrderAmount || 0,
        maxDiscount: maxDiscount || 0,
        usageCap: usageCap || 1000,
        perCustomerLimit: perCustomerLimit || 1,
        categoryScope: categoryScope || [],
        productScope: productScope || [],
        canStack: Boolean(canStack),
        description: description || '',
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
        if (req.body.code) coupon.code = req.body.code.toUpperCase().trim();
        if (req.body.discount !== undefined) coupon.discount = req.body.discount;
        if (req.body.type) coupon.type = req.body.type;
        if (req.body.isActive !== undefined) coupon.isActive = req.body.isActive;
        if (req.body.startDate) coupon.startDate = req.body.startDate;
        if (req.body.expiryDate) coupon.expiryDate = req.body.expiryDate;
        if (req.body.minOrderAmount !== undefined) coupon.minOrderAmount = req.body.minOrderAmount;
        if (req.body.maxDiscount !== undefined) coupon.maxDiscount = req.body.maxDiscount;
        if (req.body.usageCap !== undefined) coupon.usageCap = req.body.usageCap;
        if (req.body.perCustomerLimit !== undefined) coupon.perCustomerLimit = req.body.perCustomerLimit;
        if (req.body.categoryScope !== undefined) coupon.categoryScope = req.body.categoryScope;
        if (req.body.productScope !== undefined) coupon.productScope = req.body.productScope;
        if (req.body.canStack !== undefined) coupon.canStack = req.body.canStack;
        if (req.body.description !== undefined) coupon.description = req.body.description;

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
    getActiveCoupons,
    getCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon,
};
