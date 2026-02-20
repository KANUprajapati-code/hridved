import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './models/Order.js';
import User from './models/User.js';
import Product from './models/Product.js';
import connectDB from './config/db.js';

dotenv.config();

const listOrders = async () => {
    try {
        await connectDB();
        console.log('Connected to DB');
        const orderCount = await Order.countDocuments({});
        const userCount = await User.countDocuments({});
        const productCount = await Product.countDocuments({});
        console.log(`Stats - Orders: ${orderCount}, Users: ${userCount}, Products: ${productCount}`);

        if (orderCount > 0) {
            const orders = await Order.find({}).sort({ createdAt: -1 }).limit(10);
            console.log(`Found ${orders.length} recent orders:`);
            orders.forEach(o => {
                console.log(`ID: ${o._id}, User: ${o.user}, createdAt: ${o.createdAt}`);
            });
        }
        process.exit(0);
    } catch (error) {
        console.error('Error in debug script:', error);
        process.exit(1);
    }
};

listOrders();
