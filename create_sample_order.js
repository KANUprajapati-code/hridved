import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './models/Order.js';
import User from './models/User.js';
import Product from './models/Product.js';
import connectDB from './config/db.js';

dotenv.config();

const createSampleOrder = async () => {
    try {
        await connectDB();

        // Find a user and a product
        const user = await User.findOne({});
        const product = await Product.findOne({});

        if (!user || !product) {
            console.error('Need at least one user and one product to create an order');
            process.exit(1);
        }

        const order = new Order({
            user: user._id,
            orderItems: [{
                name: product.name,
                qty: 1,
                image: product.image || product.images?.[0] || 'placeholder.jpg',
                price: product.price,
                product: product._id
            }],
            shippingAddress: {
                fullName: user.name,
                mobileNumber: '1234567890',
                houseNumber: '123 Test St',
                city: 'Test City',
                state: 'Test State',
                pincode: '123456'
            },
            paymentMethod: 'COD',
            itemsPrice: product.price,
            shippingPrice: 0,
            taxPrice: 0,
            totalPrice: product.price,
            isPaid: false,
            isDelivered: false
        });

        const createdOrder = await order.save();
        console.log(`Sample Order Created: ${createdOrder._id}`);
        process.exit(0);
    } catch (error) {
        console.error('Error creating sample order:', error);
        process.exit(1);
    }
};

createSampleOrder();
