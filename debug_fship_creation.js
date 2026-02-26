import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { processFshipShipment } from './utils/fshipService.js';
import connectDB from './config/db.js';

dotenv.config();

const debugFship = async () => {
    const orderId = process.argv[2];

    if (!orderId) {
        console.error('Please provide an Order ID: node debug_fship_creation.js <orderId>');
        process.exit(1);
    }

    try {
        console.log('Connecting to Database...');
        await connectDB();

        console.log(`Testing Fship Shipment for Order ID: ${orderId}`);
        const result = await processFshipShipment(orderId);

        console.log('--- FINAL RESULT ---');
        console.log(JSON.stringify(result, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('--- DEBUG FAILED ---');
        console.error('Full Error:', JSON.stringify(error, null, 2));
        process.exit(1);
    }
};

debugFship();
