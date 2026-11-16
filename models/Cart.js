
import mongoose from 'mongoose';

const cartSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    cartItems: [
        {
            product: {
                type: mongoose.Schema.Types.ObjectId,
                required: true,
                ref: 'Product',
            },
            name: { type: String, required: true },
            qty: { type: Number, required: true },
            image: { type: String, required: true },
            price: { type: Number, required: true },
            mrp: { type: Number, default: 0 },
            sku: { type: String, default: '' },
            packSize: { type: String, default: '' },
            selectedVariant: { type: String, default: '' },
            gst: { type: Number, default: 0 },
            weight: { type: Number, default: 0.5 },
        },
    ],
    appliedCoupon: {
        code: { type: String, default: null },
        discount: { type: Number, default: 0 },
        type: { type: String, default: null },
        appliedAmount: { type: Number, default: 0 },
    },
}, {
    timestamps: true,
});

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;
