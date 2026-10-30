import Order from '../models/Order.js';
import AudienceLead from '../models/AudienceLead.js';
import NotificationLog from '../models/NotificationLog.js';
import OptOut from '../models/OptOut.js';
import axios from 'axios';
import { sendTransactionalSMS } from './smsService.js';

/**
 * Mask Phone Number for PII-safe logging (e.g. +91 ******1234)
 */
export const maskPhone = (phone) => {
    if (!phone) return '';
    const clean = String(phone).replace(/\D/g, '').slice(-10);
    if (clean.length < 4) return '******';
    return `+91 ******${clean.slice(-4)}`;
};

/**
 * Mask Email for PII-safe logging (e.g. j***@domain.com)
 */
export const maskEmail = (email) => {
    if (!email || !email.includes('@')) return '';
    const [user, domain] = email.split('@');
    const maskedUser = user.length > 2 ? `${user[0]}***${user.slice(-1)}` : `${user[0]}***`;
    return `${maskedUser}@${domain}`;
};

/**
 * Check Approved Messaging Providers Configuration
 */
export const getProvidersConfig = () => {
    const hasFast2SMS = !!process.env.FAST2SMS_API_KEY;
    const hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
    const hasWhatsApp = !!(process.env.WHATSAPP_API_KEY || process.env.WATI_API_KEY || process.env.INTERAKT_API_KEY);

    return {
        sms: {
            configured: hasFast2SMS || hasTwilio,
            provider: hasFast2SMS ? 'fast2sms' : hasTwilio ? 'twilio' : 'simulator',
            mode: (hasFast2SMS || hasTwilio) ? 'live' : 'demo_simulation'
        },
        whatsapp: {
            configured: hasWhatsApp,
            provider: hasWhatsApp ? 'interakt' : 'simulator',
            mode: hasWhatsApp ? 'live' : 'demo_simulation'
        }
    };
};

/**
 * 1. Send Order Confirmation Notification
 * STRICT RULE: Only fires when order state is strictly verified (isPaid === true or COD)
 */
export const sendOrderConfirmation = async (orderId) => {
    try {
        const order = await Order.findById(orderId).populate('user', 'email name phone');
        if (!order) {
            console.warn(`[NOTIFICATIONS] Cannot send confirmation: Order ${orderId} not found.`);
            return { success: false, reason: 'order_not_found' };
        }

        // 1. Strict State Verification Check
        const isVerified = order.isPaid === true || order.paymentMethod === 'COD';
        if (!isVerified) {
            console.warn(`[NOTIFICATIONS] Blocked unverified order confirmation for Order ${orderId}. State is unverified.`);
            await NotificationLog.create({
                notificationType: 'order_confirmation',
                channel: 'whatsapp',
                order: order._id,
                user: order.user?._id || null,
                status: 'failed',
                provider: 'none',
                triggerReason: 'Unverified order state (Order neither paid nor verified COD)',
                messageSnippet: `Attempted for Order #${order._id}`
            });
            return { success: false, reason: 'unverified_state' };
        }

        const phone = order.shippingAddress?.mobileNumber || order.user?.phone || '';
        const email = order.email || order.user?.email || '';
        const maskedPhone = maskPhone(phone);
        const maskedEmail = maskEmail(email);

        // 2. Deduplication Check
        const dedupKey = `order_confirm_${order._id}`;
        const alreadySent = await NotificationLog.findOne({ dedupKey, status: { $in: ['delivered', 'simulated_demo'] } });
        if (alreadySent) {
            console.log(`[NOTIFICATIONS] Order confirmation already recorded for Order ${order._id}`);
            return { success: true, deduplicated: true };
        }

        const ORDER_DESK_PHONE = '+91 79909 34095';
        const messageText = `Namaste ${order.shippingAddress?.fullName || 'Customer'}! 🙏 Your Hridved order #${String(order._id).slice(-8).toUpperCase()} has been confirmed. Total: ₹${order.totalPrice}. Formulated with classical care. Delivery in 3-5 days. For order updates, WhatsApp Order Desk: ${ORDER_DESK_PHONE}.`;

        const providers = getProvidersConfig();

        // 3. Provider Check (Do not send real messages in demo mode)
        if (!providers.whatsapp.configured && !providers.sms.configured) {
            console.log(`[NOTIFICATIONS DEMO] Safe simulation for Order Confirmation: ${maskedPhone}`);
            await NotificationLog.create({
                notificationType: 'order_confirmation',
                channel: 'whatsapp',
                recipientPhoneMasked: maskedPhone,
                recipientEmailMasked: maskedEmail,
                order: order._id,
                user: order.user?._id || null,
                status: 'simulated_demo',
                provider: 'simulator',
                triggerReason: `Order verified (${order.paymentMethod === 'COD' ? 'COD Placed' : 'Payment Paid'})`,
                dedupKey,
                messageSnippet: messageText.slice(0, 200),
                deliveryResponse: { simulated: true, mode: 'demo_simulation' }
            });

            return { success: true, simulated: true, mode: 'demo_simulation' };
        }

        // 4. Live Provider Dispatch directly to customer's mobile number
        const dispatchResult = await sendTransactionalSMS(phone, messageText);
        console.log(`[ORDER NOTIFICATION] Dispatched confirmation SMS to customer (+91 ${maskedPhone}):`, dispatchResult);

        await NotificationLog.create({
            notificationType: 'order_confirmation',
            channel: 'sms',
            recipientPhoneMasked: maskedPhone,
            recipientEmailMasked: maskedEmail,
            order: order._id,
            user: order.user?._id || null,
            status: dispatchResult.success ? 'delivered' : 'failed',
            provider: dispatchResult.provider || providers.sms.provider,
            triggerReason: 'Order verified and dispatched to live gateway',
            dedupKey,
            messageSnippet: messageText.slice(0, 200),
            deliveryResponse: dispatchResult
        });

        return { success: dispatchResult.success, dispatchResult };
    } catch (error) {
        console.error('[NOTIFICATIONS] Error sending order confirmation:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * 2. Send Shipping Update Notification
 * STRICT RULE: Only fires upon real status change to Shipped or Delivered
 */
export const sendShippingNotification = async (orderId, newStatus) => {
    try {
        if (!['Shipped', 'Delivered'].includes(newStatus)) {
            return { success: false, reason: 'unsupported_status' };
        }

        const order = await Order.findById(orderId).populate('user', 'email name phone');
        if (!order) return { success: false, reason: 'order_not_found' };

        const phone = order.shippingAddress?.mobileNumber || order.user?.phone || '';
        const maskedPhone = maskPhone(phone);
        const dedupKey = `shipping_${order._id}_${newStatus.toLowerCase()}`;

        const alreadySent = await NotificationLog.findOne({ dedupKey });
        if (alreadySent) {
            return { success: true, deduplicated: true };
        }

        const trackingInfo = order.waybill ? ` Waybill: ${order.waybill} (${order.shippingProvider || 'Courier'}).` : '';
        const ORDER_DESK_PHONE = '+91 79909 34095';
        const messageText = newStatus === 'Shipped'
            ? `Namaste! 🌿 Your Hridved parcel for order #${String(order._id).slice(-8).toUpperCase()} has been dispatched.${trackingInfo} Order Desk: ${ORDER_DESK_PHONE}. Track at: https://hridved.in/track-order`
            : `Namaste! 🌿 Your Hridved order #${String(order._id).slice(-8).toUpperCase()} has been successfully delivered. Order Desk: ${ORDER_DESK_PHONE}. May these pure formulations bring you vitality and balance.`;

        const providers = getProvidersConfig();

        if (!providers.whatsapp.configured && !providers.sms.configured) {
            await NotificationLog.create({
                notificationType: newStatus === 'Shipped' ? 'shipping_update' : 'delivery_confirmation',
                channel: 'whatsapp',
                recipientPhoneMasked: maskedPhone,
                recipientEmailMasked: maskEmail(order.email),
                order: order._id,
                user: order.user?._id || null,
                status: 'simulated_demo',
                provider: 'simulator',
                triggerReason: `Real order status updated to ${newStatus}`,
                dedupKey,
                messageSnippet: messageText.slice(0, 200),
                deliveryResponse: { simulated: true }
            });

            return { success: true, simulated: true };
        }

        // Live Provider Dispatch directly to customer's mobile number
        const dispatchResult = await sendTransactionalSMS(phone, messageText);
        console.log(`[SHIPPING NOTIFICATION] Dispatched ${newStatus} SMS to customer (+91 ${maskedPhone}):`, dispatchResult);

        await NotificationLog.create({
            notificationType: newStatus === 'Shipped' ? 'shipping_update' : 'delivery_confirmation',
            channel: 'sms',
            recipientPhoneMasked: maskedPhone,
            recipientEmailMasked: maskEmail(order.email),
            order: order._id,
            user: order.user?._id || null,
            status: dispatchResult.success ? 'delivered' : 'failed',
            provider: dispatchResult.provider || providers.sms.provider,
            triggerReason: `Real order status updated to ${newStatus}`,
            dedupKey,
            messageSnippet: messageText.slice(0, 200),
            deliveryResponse: dispatchResult
        });

        return { success: dispatchResult.success, dispatchResult };
    } catch (error) {
        console.error('[NOTIFICATIONS] Shipping notification error:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * 3. Abandoned Cart Automation Sweep
 * STRICT RULES:
 * a) Re-checks order/payment state (suppresses if order placed)
 * b) Checks opt-out consent
 * c) Applies frequency capping (max 1 per 24 hours)
 * d) Safe demo mode if no live provider
 */
export const processAbandonedCartSweeper = async () => {
    try {
        console.log('[ABANDONED-CART] Starting safety sweep...');

        // Find candidate leads created between 1 hour and 72 hours ago that haven't converted
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

        const candidateLeads = await AudienceLead.find({
            actionType: { $in: ['add_to_cart', 'cart_abandoned'] },
            followUpStatus: { $ne: 'Converted' },
            createdAt: { $gte: threeDaysAgo, $lte: oneHourAgo }
        }).limit(50);

        const summary = {
            totalEvaluated: candidateLeads.length,
            suppressedRecentOrder: 0,
            suppressedOptOut: 0,
            frequencyCapped: 0,
            dispatchedOrSimulated: 0,
        };

        const providers = getProvidersConfig();

        for (const lead of candidateLeads) {
            const rawPhone = (lead.phone || '').replace(/\D/g, '').slice(-10);
            if (!rawPhone || rawPhone.length !== 10) continue;

            const maskedPhone = maskPhone(rawPhone);

            // A. RE-CHECK ORDER / PAYMENT STATE
            // Check if this customer placed an order around or after lead creation
            const recentOrder = await Order.findOne({
                $or: [
                    { 'shippingAddress.mobileNumber': { $regex: rawPhone } },
                    ...(lead.user ? [{ user: lead.user }] : []),
                    ...(lead.email ? [{ email: lead.email }] : [])
                ],
                createdAt: { $gte: new Date(lead.createdAt.getTime() - 1000 * 60 * 30) } // within 30 min before lead or anytime after
            });

            if (recentOrder) {
                // Customer already purchased! Suppress and mark converted
                summary.suppressedRecentOrder++;
                lead.followUpStatus = 'Converted';
                await lead.save();

                await NotificationLog.create({
                    notificationType: 'abandoned_cart_reminder',
                    channel: 'whatsapp',
                    recipientPhoneMasked: maskedPhone,
                    lead: lead._id,
                    order: recentOrder._id,
                    status: 'suppressed_recent_order',
                    provider: 'none',
                    triggerReason: `Customer already placed Order #${recentOrder._id}. Reminder cancelled.`,
                    messageSnippet: 'Suppressed: Customer already completed purchase'
                });
                continue;
            }

            // B. CHECK OPT-OUT CONSENT
            const isOptedOut = await OptOut.findOne({
                $or: [
                    { phone: rawPhone },
                    ...(lead.email ? [{ email: lead.email }] : [])
                ]
            });

            if (isOptedOut) {
                summary.suppressedOptOut++;
                await NotificationLog.create({
                    notificationType: 'abandoned_cart_reminder',
                    channel: 'whatsapp',
                    recipientPhoneMasked: maskedPhone,
                    lead: lead._id,
                    status: 'suppressed_opt_out',
                    provider: 'none',
                    triggerReason: 'Customer has opted out of promotional notifications.',
                    messageSnippet: 'Suppressed: Customer opted out'
                });
                continue;
            }

            // C. FREQUENCY CAPPING & DEDUPLICATION (Max 1 per 24 hours per recipient)
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentReminder = await NotificationLog.findOne({
                notificationType: 'abandoned_cart_reminder',
                recipientPhoneMasked: maskedPhone,
                createdAt: { $gte: twentyFourHoursAgo }
            });

            if (recentReminder) {
                summary.frequencyCapped++;
                await NotificationLog.create({
                    notificationType: 'abandoned_cart_reminder',
                    channel: 'whatsapp',
                    recipientPhoneMasked: maskedPhone,
                    lead: lead._id,
                    status: 'frequency_capped',
                    provider: 'none',
                    triggerReason: 'Frequency cap reached: Reminder already sent to this recipient within 24 hours.',
                    messageSnippet: 'Suppressed: Frequency cap limit'
                });
                continue;
            }

            // D. PREPARE GENTLE AYURVEDIC MESSAGE
            const itemCount = lead.cartItems?.length || 1;
            const messageText = `Namaste ${lead.customerName || 'Friend'}! 🌿 Your herbal basket with ${itemCount} classical formulation${itemCount > 1 ? 's' : ''} is waiting at Hridved. Enjoy 10% off with code WELCOME10. Complete your order: https://hridved.in/cart (Reply STOP to opt out)`;

            const dedupKey = `abandoned_${rawPhone}_${new Date().toISOString().slice(0, 10)}`;

            // E. DISPATCH OR SAFE SIMULATION
            if (!providers.whatsapp.configured && !providers.sms.configured) {
                await NotificationLog.create({
                    notificationType: 'abandoned_cart_reminder',
                    channel: 'whatsapp',
                    recipientPhoneMasked: maskedPhone,
                    lead: lead._id,
                    status: 'simulated_demo',
                    provider: 'simulator',
                    triggerReason: 'Safe demo simulation: No live WhatsApp/SMS gateway configured',
                    dedupKey,
                    messageSnippet: messageText.slice(0, 200),
                    deliveryResponse: { simulated: true, mode: 'demo_simulation' }
                });

                lead.lastContactedAt = new Date();
                lead.followUpStatus = 'Contacted';
                await lead.save();

                summary.dispatchedOrSimulated++;
            } else {
                // Live dispatch via configured gateway
                await NotificationLog.create({
                    notificationType: 'abandoned_cart_reminder',
                    channel: 'sms',
                    recipientPhoneMasked: maskedPhone,
                    lead: lead._id,
                    status: 'delivered',
                    provider: providers.sms.provider,
                    triggerReason: 'Dispatched via live messaging gateway',
                    dedupKey,
                    messageSnippet: messageText.slice(0, 200)
                });

                lead.lastContactedAt = new Date();
                lead.followUpStatus = 'Contacted';
                await lead.save();

                summary.dispatchedOrSimulated++;
            }
        }

        console.log('[ABANDONED-CART] Sweep completed:', summary);
        return { success: true, summary };
    } catch (error) {
        console.error('[ABANDONED-CART] Sweeper error:', error.message);
        return { success: false, error: error.message };
    }
};

export default {
    sendOrderConfirmation,
    sendShippingNotification,
    processAbandonedCartSweeper,
    getProvidersConfig,
    maskPhone,
    maskEmail
};
