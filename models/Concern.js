import mongoose from 'mongoose';

const concernSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    slug: {
        type: String,
        required: true,
        unique: true,
    },
    category: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    badge: {
        type: String,
        default: 'Classical Ayurveda',
    },
    image: {
        type: String,
        default: '',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    order: {
        type: Number,
        default: 0,
    }
}, {
    timestamps: true,
});

concernSchema.index({ slug: 1 });
concernSchema.index({ isActive: 1, order: 1 });

const Concern = mongoose.model('Concern', concernSchema);

export default Concern;

