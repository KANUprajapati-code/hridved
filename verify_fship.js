import { checkFshipServiceability } from './utils/fshipService.js';
import dotenv from 'dotenv';
dotenv.config();

const test = async () => {
    try {
        console.log('Testing Fship Serviceability with updated logic...');
        const result = await checkFshipServiceability('560001', 0.5, 0);
        console.log('SUCCESS:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.log('FAILED:', error.message);
        if (error.data) console.log('Response Data:', error.data);
    }
};

test();
