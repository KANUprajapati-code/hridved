
import mongoose from 'mongoose';

const reviewSchema = mongoose.Schema({
    name: { type: String, required: true },
    rating: { type: Number, required: true },
    comment: { type: String, required: true },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
}, {
    timestamps: true,
});

const variantSchema = mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    price: { type: Number, required: true },
    mrp: { type: Number, required: true },
    stock: { type: Number, default: 0 },
    multiplier: { type: Number, default: 1 },
});

const productSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    name: {
        type: String,
        required: true,
    },
    sku: {
        type: String,
        default: '',
    },
    image: {
        type: String,
        required: true,
    },
    images: [{
        type: String,
    }],
    description: {
        type: String,
        required: true,
    },
    brand: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    benefits: {
        type: String,
    },
    howToUse: {
        type: String,
    },
    price: {
        type: Number,
        required: true,
        default: 0,
    },
    mrp: {
        type: Number,
        required: true,
        default: 0,
    },
    countInStock: {
        type: Number,
        required: true,
        default: 0,
    },
    rating: {
        type: Number,
        required: true,
        default: 0,
    },
    numReviews: {
        type: Number,
        required: true,
        default: 0,
    },
    isBestseller: {
        type: Boolean,
        default: false,
    },
    isFeatured: {
        type: Boolean,
        default: false,
    },
    gst: {
        type: Number,
        required: true,
        default: 0,
    },
    weight: {
        type: Number,
        required: true,
        default: 0.5, // Default weight in kg
    },
    variants: [variantSchema],
    reviews: [reviewSchema],
}, {
    timestamps: true,
});

const Product = mongoose.model('Product', productSchema);

export default Product;
