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
        expiryDate: {
            type: Date,
            required: true,
        },
        minOrderAmount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

const Coupon = mongoose.model('Coupon', couponSchema);

export default Coupon;
