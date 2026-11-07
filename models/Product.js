
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
    concern: {
        type: String,
        default: '',
    },
    concerns: [{
        type: String,
    }],
    packSize: {
        type: String,
        default: '',
    },
    ingredients: {
        type: String,
        default: '',
    },
    keyIngredients: [{
        type: String,
    }],
    benefits: {
        type: String,
    },
    howToUse: {
        type: String,
    },
    precautions: {
        type: String,
        default: 'Consult a qualified Ayurvedic physician prior to use if pregnant, lactating, or on concurrent medical therapy. Keep out of reach of infants. Do not exceed suggested serving.',
    },
    storage: {
        type: String,
        default: 'Store in a cool, dry place away from direct sunlight and heat. Keep container tightly sealed after each use. Do not refrigerate.',
    },
    manufacturerDetails: {
        name: { type: String, default: 'HRIDVED HERBALS PRIVATE LIMITED' },
        address: { type: String, default: 'Vedic Wellness Campus, Gandhinagar, Gujarat - 382010, India' },
        ayushLicense: { type: String, default: 'GA/AYU/108-A' },
        fssaiLicense: { type: String, default: '10722031000456' },
        countryOfOrigin: { type: String, default: 'India' },
        customerCare: { type: String, default: '+91 79909 34095 | care@hridved.com' },
    },
    verifiedDocuments: [{
        title: { type: String, required: true },
        docType: { type: String, default: 'Certificate of Analysis (COA)' },
        fileUrl: { type: String, default: '' },
        verifiedDate: { type: String, default: '' },
        labName: { type: String, default: 'NABL Accredited Analytical Testing Laboratory' },
    }],
    faqs: [{
        question: { type: String, required: true },
        answer: { type: String, required: true },
    }],
    claimStatus: {
        type: String,
        enum: ['classical_text', 'approved', 'under_review'],
        default: 'classical_text',
    },
    evidenceReference: {
        type: String,
        default: 'Ayurvedic Pharmacopoeia of India (API) / Classical Samhitas (Sushruta Samhita & Charaka Samhita)',
    },
    childAgeGuidance: {
        type: String,
        default: '',
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

// Indexes for fast querying & filtering on Shop page
productSchema.index({ category: 1, createdAt: -1 });
productSchema.index({ concern: 1 });
productSchema.index({ concerns: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ name: 'text', description: 'text', ingredients: 'text', sku: 'text' });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ isBestseller: 1 });

const Product = mongoose.model('Product', productSchema);

export default Product;
