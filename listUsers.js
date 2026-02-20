
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import connectDB from './config/db.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });
// console.log("MONGO_URI:", process.env.MONGO_URI); // Debugging

connectDB();

const listUsers = async () => {
    try {
        const users = await User.find({});

        console.log('\nRegistered Users:');
        console.log('------------------------------------------------');
        console.log(`| ${'Name'.padEnd(20)} | ${'Email'.padEnd(30)} | ${'Admin'.padEnd(10)} |`);
        console.log('------------------------------------------------');

        users.forEach(user => {
            console.log(`| ${user.name.padEnd(20)} | ${user.email.padEnd(30)} | ${user.isAdmin ? 'YES' : 'NO '}      |`);
        });

        console.log('------------------------------------------------');
        console.log('\nTo make a user admin, run: node server/makeAdmin.js <email>');

        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

listUsers();
