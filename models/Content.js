import mongoose from 'mongoose';

const contentSchema = mongoose.Schema({
    section: {
        type: String,
        required: true,
        unique: true, // e.g., 'hero', 'tradition', 'bestsellers', 'consultation', etc.
    },
    title: { type: String },
    subtitle: { type: String },
    description: { type: String },
    image: { type: String },
    image1: { type: String },
    image2: { type: String },
    ctaText: { type: String },
    ctaLink: { type: String },
    isVisible: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    // Flexible fields for different section types
    items: [{
        title: String,
        description: String,
        image: String,
        link: String,
        icon: String,
        badge: String,
        rating: Number,
        isActive: { type: Boolean, default: true }
    }]
}, {
    timestamps: true,
});

const Content = mongoose.model('Content', contentSchema);

export default Content;
