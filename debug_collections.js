import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './config/db.js';

dotenv.config();

const listCollections = async () => {
    try {
        await connectDB();
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections in DB:');
        collections.forEach(c => console.log(`- ${c.name}`));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

listCollections();
