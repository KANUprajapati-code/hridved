import mongoose from 'mongoose';

const notificationLogSchema = new mongoose.Schema({
    notificationType: {
        type: String,
        enum: ['order_confirmation', 'shipping_update', 'delivery_confirmation', 'abandoned_cart_reminder', 'otp'],
        required: true,
        index: true,
    },
    channel: {
        type: String,
        enum: ['sms', 'whatsapp', 'email'],
        required: true,
    },
    recipientPhoneMasked: {
        type: String,
        default: '',
    },
    recipientEmailMasked: {
        type: String,
        default: '',
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null,
    },
    lead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AudienceLead',
        default: null,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    status: {
        type: String,
        enum: [
            'delivered', 
            'simulated_demo', 
            'failed', 
            'suppressed_recent_order', 
            'suppressed_opt_out', 
            'frequency_capped'
        ],
        required: true,
        index: true,
    },
    provider: {
        type: String,
        enum: ['fast2sms', 'twilio', 'wati', 'interakt', 'simulator', 'none'],
        default: 'simulator',
    },
    triggerReason: {
        type: String,
        default: '',
    },
    dedupKey: {
        type: String,
        index: true,
        default: '',
    },
    messageSnippet: {
        type: String,
        maxlength: 300,
        default: '',
    },
    deliveryResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
}, {
    timestamps: true,
});

notificationLogSchema.index({ createdAt: -1 });
notificationLogSchema.index({ dedupKey: 1, createdAt: -1 });

const NotificationLog = mongoose.model('NotificationLog', notificationLogSchema);

export default NotificationLog;
