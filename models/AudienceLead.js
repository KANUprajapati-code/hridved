import mongoose from 'mongoose';

const audienceLeadSchema = new mongoose.Schema({
    customerName: {
        type: String,
        default: 'Guest User',
    },
    phone: {
        type: String,
        required: true,
        index: true,
    },
    email: {
        type: String,
        default: '',
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    actionType: {
        type: String,
        enum: ['whatsapp_click', 'whatsapp_order', 'add_to_cart', 'cart_abandoned', 'otp_lead', 'inquiry'],
        required: true,
        index: true,
    },
    product: {
        productId: { type: String, default: '' },
        name: { type: String, default: '' },
        image: { type: String, default: '' },
        price: { type: Number, default: 0 },
    },
    cartItems: [{
        productId: { type: String },
        name: { type: String },
        image: { type: String },
        price: { type: Number },
        qty: { type: Number, default: 1 },
    }],
    cartTotal: {
        type: Number,
        default: 0,
    },
    followUpStatus: {
        type: String,
        enum: ['New', 'Contacted', 'Interested', 'Converted', 'Not Interested'],
        default: 'New',
        index: true,
    },
    notes: [{
        text: { type: String, required: true },
        addedBy: { type: String, default: 'Admin' },
        createdAt: { type: Date, default: Date.now },
    }],
    tags: [{
        type: String,
    }],
    lastContactedAt: {
        type: Date,
        default: null,
    },
    ipAddress: {
        type: String,
        default: '',
    },
    userAgent: {
        type: String,
        default: '',
    },
}, {
    timestamps: true,
});

const AudienceLead = mongoose.model('AudienceLead', audienceLeadSchema);

export default AudienceLead;
