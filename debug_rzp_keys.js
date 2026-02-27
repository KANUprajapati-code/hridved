import dotenv from 'dotenv';
dotenv.config();

console.log('--- Environment Check ---');
console.log('RAZORPAY_KEY_ID:', process.env.RAZORPAY_KEY_ID ? `${process.env.RAZORPAY_KEY_ID.substring(0, 4)}...${process.env.RAZORPAY_KEY_ID.substring(process.env.RAZORPAY_KEY_ID.length - 4)}` : 'MISSING');
console.log('RAZORPAY_KEY_SECRET:', process.env.RAZORPAY_KEY_SECRET ? 'PRESENT' : 'MISSING');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('-------------------------');
