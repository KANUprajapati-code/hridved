
import mongoose from 'mongoose';

const contentSchema = mongoose.Schema({
    section: {
        type: String,
        required: true,
        unique: true, // e.g., 'hero', 'tradition'
    },
    title: { type: String },
    subtitle: { type: String },
    image: { type: String },
    image1: { type: String },
    image2: { type: String },
    ctaText: { type: String },
    ctaLink: { type: String },
    // Flexible fields for different section types
    items: [{
        title: String,
        description: String,
        image: String,
        link: String,
        icon: String
    }]
}, {
    timestamps: true,
});

const Content = mongoose.model('Content', contentSchema);

export default Content;
