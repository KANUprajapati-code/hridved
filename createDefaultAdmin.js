
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import connectDB from './config/db.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });
connectDB();

const createAdmin = async () => {
    try {
        const email = 'admin@example.com';
        const password = '123456';

        const userExists = await User.findOne({ email });

        if (userExists) {
            console.log('User already exists');
            if (!userExists.isAdmin) {
                userExists.isAdmin = true;
                await userExists.save();
                console.log('User updated to Admin');
            } else {
                console.log('User is already Admin');
            }
        } else {
            const user = await User.create({
                name: 'Admin User',
                email,
                password, // Will be hashed by pre-save hook in User model
                isAdmin: true
            });
            console.log('Admin User Created');
        }

        console.log(`\ncredentials:\nEmail: ${email}\nPassword: ${password}`);
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

createAdmin();
