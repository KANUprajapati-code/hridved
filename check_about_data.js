import mongoose from 'mongoose';
import dotenv from 'dotenv';
import About from './models/aboutModel.js';

dotenv.config({ path: '../.env' });

const checkData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const about = await About.findOne();
        console.log('About Data found:');
        console.log('Values:', JSON.stringify(about?.values, null, 2));
        console.log('Count:', about?.values?.length);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkData();
