import mongoose from 'mongoose';

const optOutSchema = new mongoose.Schema({
    phone: {
        type: String,
        index: true,
        default: '',
    },
    email: {
        type: String,
        index: true,
        default: '',
    },
    reason: {
        type: String,
        default: 'USER_UNSUBSCRIBE',
    },
    channel: {
        type: String,
        enum: ['all', 'sms', 'whatsapp', 'email'],
        default: 'all',
    },
    optedOutAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

optOutSchema.index({ phone: 1 });
optOutSchema.index({ email: 1 });

const OptOut = mongoose.model('OptOut', optOutSchema);

export default OptOut;
