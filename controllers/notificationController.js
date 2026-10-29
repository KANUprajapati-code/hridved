import NotificationLog from '../models/NotificationLog.js';
import OptOut from '../models/OptOut.js';
import { 
    getProvidersConfig, 
    processAbandonedCartSweeper, 
    maskPhone, 
    maskEmail 
} from '../utils/notificationService.js';

/**
 * @desc    Get Notification Logs with pagination and filters
 * @route   GET /api/notifications/logs
 * @access  Private/Admin
 */
export const getNotificationLogs = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 25, 
            notificationType, 
            status, 
            channel 
        } = req.query;

        const filter = {};
        if (notificationType && notificationType !== 'all') filter.notificationType = notificationType;
        if (status && status !== 'all') filter.status = status;
        if (channel && channel !== 'all') filter.channel = channel;

        const skip = (Number(page) - 1) * Number(limit);

        const [logs, total, counts] = await Promise.all([
            NotificationLog.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .populate('order', 'totalPrice isPaid paymentMethod waybill shippingStatus')
                .populate('lead', 'customerName cartTotal'),
            NotificationLog.countDocuments(filter),
            NotificationLog.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        const stats = {
            total,
            delivered: counts.find(c => c._id === 'delivered')?.count || 0,
            simulated_demo: counts.find(c => c._id === 'simulated_demo')?.count || 0,
            suppressed_recent_order: counts.find(c => c._id === 'suppressed_recent_order')?.count || 0,
            suppressed_opt_out: counts.find(c => c._id === 'suppressed_opt_out')?.count || 0,
            frequency_capped: counts.find(c => c._id === 'frequency_capped')?.count || 0,
            failed: counts.find(c => c._id === 'failed')?.count || 0,
        };

        res.json({
            success: true,
            logs,
            stats,
            providers: getProvidersConfig(),
            pagination: {
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)) || 1,
                total
            }
        });
    } catch (error) {
        console.error('[NOTIFICATIONS] Get logs error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get Providers Configuration & Status
 * @route   GET /api/notifications/providers
 * @access  Private/Admin
 */
export const getProvidersStatus = async (req, res) => {
    try {
        const providers = getProvidersConfig();
        res.json({
            success: true,
            providers,
            notice: (!providers.sms.configured && !providers.whatsapp.configured)
                ? 'Running in Safe Demo Mode. Real messages will not be dispatched until an approved provider (Fast2SMS/Twilio/WATI/Interakt) is configured.'
                : 'Live messaging gateway active.'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Manually trigger Abandoned Cart safety sweep
 * @route   POST /api/notifications/abandoned-cart/run
 * @access  Private/Admin
 */
export const runAbandonedCartSweep = async (req, res) => {
    try {
        const result = await processAbandonedCartSweeper();
        res.json(result);
    } catch (error) {
        console.error('[NOTIFICATIONS] Sweep execution error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Register Customer Opt-Out
 * @route   POST /api/notifications/opt-out
 * @access  Public
 */
export const registerOptOut = async (req, res) => {
    try {
        const { phone, email, reason = 'USER_UNSUBSCRIBE' } = req.body;

        if (!phone && !email) {
            return res.status(400).json({ success: false, message: 'Please provide a valid 10-digit phone number or email address.' });
        }

        const cleanPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';
        const cleanEmail = email ? String(email).trim().toLowerCase() : '';

        // Upsert OptOut record
        const query = {};
        if (cleanPhone) query.phone = cleanPhone;
        if (cleanEmail) query.email = cleanEmail;

        await OptOut.findOneAndUpdate(
            query,
            {
                phone: cleanPhone,
                email: cleanEmail,
                reason,
                channel: 'all',
                optedOutAt: new Date()
            },
            { upsert: true, new: true }
        );

        console.log(`[OPT-OUT] Successfully registered opt-out for ${maskPhone(cleanPhone) || maskEmail(cleanEmail)}`);

        res.json({
            success: true,
            message: 'You have been successfully unsubscribed from marketing and cart reminder notifications.'
        });
    } catch (error) {
        console.error('[NOTIFICATIONS] Opt-out error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
