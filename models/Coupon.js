import mongoose from 'mongoose';

const couponSchema = mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },
        discount: {
            type: Number,
            required: true,
            default: 0,
        },
        type: {
            type: String,
            required: true,
            enum: ['percentage', 'fixed'],
            default: 'percentage',
        },
        isActive: {
            type: Boolean,
            required: true,
            default: true,
        },
        startDate: {
            type: Date,
            default: Date.now,
        },
        expiryDate: {
            type: Date,
            required: true,
        },
        minOrderAmount: {
            type: Number,
            default: 0,
        },
        maxDiscount: {
            type: Number,
            default: 0, // 0 = no cap
        },
        usageCap: {
            type: Number,
            default: 1000, // Total redemptions across all users
        },
        usageCount: {
            type: Number,
            default: 0,
        },
        perCustomerLimit: {
            type: Number,
            default: 1, // Max usage per user
        },
        usedBy: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
                count: {
                    type: Number,
                    default: 1,
                },
            },
        ],
        categoryScope: [{
            type: String,
        }],
        productScope: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
        }],
        canStack: {
            type: Boolean,
            default: false,
        },
        description: {
            type: String,
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

const Coupon = mongoose.model('Coupon', couponSchema);

export default Coupon;
