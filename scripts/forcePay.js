// MANUAL PAYMENT RECOVERY SCRIPT
// Run this via: node scripts/forcePay.js <MONGO_ORDER_ID> <RZP_PAYMENT_ID>

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order.js';

dotenv.config();

const forcePay = async () => {
    const orderId = process.argv[2];
    const rzpPaymentId = process.argv[3];

    if (!orderId || !rzpPaymentId) {
        console.error('Usage: node forcePay.js <ORDER_ID> <RZP_PAYMENT_ID>');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        const order = await Order.findById(orderId);

        if (!order) {
            console.error('Order not found');
            process.exit(1);
        }

        order.isPaid = true;
        order.paidAt = Date.now();
        order.paymentResult = {
            id: rzpPaymentId,
            status: 'succeeded',
            update_time: Date.now().toString(),
            email_address: 'manual@recovery.com'
        };

        await order.save();
        console.log(`SUCCESS: Order ${orderId} marked as PAID.`);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
};

forcePay();
