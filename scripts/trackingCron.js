import cron from 'node-cron';
import Order from '../models/Order.js';
import { getFshipShipmentSummary } from '../utils/fshipService.js';

/**
 * Update tracking status for all Shipped orders
 */
const updateShipmentStatuses = async () => {
    console.log('Cron Job: Updating Shipment Statuses...');

    try {
        // Fetch all orders with Shipped status that have a waybill
        const orders = await Order.find({
            shippingStatus: 'Shipped',
            waybill: { $exists: true, $ne: '' },
            shippingProvider: 'Fship'
        });

        console.log(`Found ${orders.length} orders to update.`);

        for (const order of orders) {
            try {
                const result = await getFshipShipmentSummary(order.waybill);

                if (result && result.status === true) {
                    const summary = result.summary;

                    // Update tracking fields
                    order.trackingStatus = summary.status;

                    if (summary.status === 'Delivered') {
                        order.shippingStatus = 'Delivered';
                        order.isDelivered = true;
                        order.deliveredAt = new Date(summary.lastscanned || Date.now());
                    } else if (summary.status === 'RTO' || summary.status.includes('Returned')) {
                        order.shippingStatus = 'RTO';
                    }

                    await order.save();
                    console.log(`Updated Order ${order._id} (Waybill: ${order.waybill}) to Status: ${summary.status}`);
                }
            } catch (err) {
                console.error(`Failed to update Order ${order._id}:`, err.message);
            }
        }
    } catch (error) {
        console.error('Tracking Cron Error:', error);
    }
};

// Run every 6 hours
// 0 0 */6 * * *
export const initTrackingCron = () => {
    cron.schedule('0 0 */6 * * *', updateShipmentStatuses);
    console.log('Tracking Cron Initialized (Every 6 hours)');
};

// For manual trigger/test
export { updateShipmentStatuses };
