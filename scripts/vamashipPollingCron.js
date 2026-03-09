import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Order from '../models/Order.js';
import { getVamashipOrderDetails } from '../utils/vamashipService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const pollVamashipAWBs = async () => {
  try {
    console.log('[CRON-VAMASHIP] Starting AWB Polling...');
    
    // Find orders with Vamaship provider but no waybill yet
    const pendingOrders = await Order.find({
      shippingProvider: 'Vamaship',
      waybill: { $exists: false },
      apiOrderId: { $exists: true, $ne: '' },
      createdAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } // Last 48 hours
    });

    console.log(`[CRON-VAMASHIP] Found ${pendingOrders.length} pending orders.`);

    for (const order of pendingOrders) {
      try {
        console.log(`[CRON-VAMASHIP] Polling for Order: ${order._id}, RefID: ${order.apiOrderId}`);
        const details = await getVamashipOrderDetails(order.apiOrderId);

        if (details && details.success && details.shipments && details.shipments.length > 0) {
          const shipData = details.shipments[0];
          if (shipData.awb) {
            console.log(`[CRON-VAMASHIP] Found AWB for Order ${order._id}: ${shipData.awb}`);
            order.waybill = shipData.awb;
            order.shippingStatus = 'Shipped';
            await order.save();
          } else {
            console.log(`[CRON-VAMASHIP] AWB still not available for RefID: ${order.apiOrderId}`);
          }
        }
      } catch (err) {
        console.error(`[CRON-VAMASHIP] Error polling Order ${order._id}:`, err.message);
      }
    }

    console.log('[CRON-VAMASHIP] Polling cycle complete.');
  } catch (error) {
    console.error('[CRON-VAMASHIP] Fatal Error:', error);
  }
};

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => {
      console.log('Connected to MongoDB');
      return pollVamashipAWBs();
    })
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

export default pollVamashipAWBs;
