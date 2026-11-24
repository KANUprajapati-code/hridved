import cron from 'node-cron';
import Order from '../models/Order.js';
import { trackVamashipShipment } from '../utils/vamashipService.js';

/**
 * Update tracking status for all Shipped orders using Vamaship
 */
const updateShipmentStatuses = async () => {
    console.log('Cron Job: Updating Vamaship Shipment Statuses...');

    try {
        const orders = await Order.find({
            shippingStatus: { $in: ['Shipped', 'Shipping Pending'] },
            waybill: { $exists: true, $ne: '' },
            shippingProvider: 'Vamaship'
        });

        console.log(`Found ${orders.length} Vamaship orders to update.`);

        for (const order of orders) {
            try {
                const result = await trackVamashipShipment(order.waybill);

                if (result && result.status === "success" && result.data) {
                    const trackData = result.data;
                    const status = trackData.status || 'Shipped';
                    
                    order.trackingStatus = status;

                    if (status === 'Delivered' || status.toLowerCase().includes('deliver')) {
                        order.shippingStatus = 'Delivered';
                        order.orderStatus = 'Delivered';
                        order.trackingStatus = 'Delivered';
                        order.isDelivered = true;
                        order.deliveredAt = order.deliveredAt || new Date();
                        if (order.paymentMethod === 'COD' && !order.isPaid) {
                            order.isPaid = true;
                            order.paidAt = order.deliveredAt;
                            order.paymentStatus = 'Captured';
                        }
                    } else if (status === 'RTO' || status.toLowerCase().includes('returned')) {
                        order.shippingStatus = 'RTO';
                    } else if (status === 'Shipped' || status === 'In Transit') {
                        order.shippingStatus = 'Shipped';
                    }

                    await order.save();
                    console.log(`Updated Vamaship Order ${order._id} to Status: ${status}`);
                }
            } catch (err) {
                console.error(`Failed to update Vamaship Order ${order._id}:`, err.message);
            }
        }
    } catch (error) {
        console.error('Vamaship Tracking Cron Error:', error);
    }
};

// Run every 6 hours
export const initTrackingCron = () => {
    cron.schedule('0 0 */6 * * *', updateShipmentStatuses);
    console.log('Vamaship Tracking Cron Initialized (Every 6 hours)');
};

export { updateShipmentStatuses };
