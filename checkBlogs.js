import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Blog from './models/Blog.js';
import connectDB from './config/db.js';

dotenv.config();

const checkBlogs = async () => {
    try {
        await connectDB();
        const count = await Blog.countDocuments();
        console.log(`Blog count: ${count}`);
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
checkBlogs();
