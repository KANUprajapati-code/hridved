
import mongoose from 'mongoose';

const contactSchema = mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    category: { type: String, default: 'General' },
    orderNumber: { type: String, default: '' },
    source: { type: String, default: 'web' },
    message: { type: String, required: true },
}, {
    timestamps: true,
});

const Contact = mongoose.model('Contact', contactSchema);

export default Contact;
