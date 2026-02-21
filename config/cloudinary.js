import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

console.log('Initializing Cloudinary with:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'PRESENT' : 'MISSING',
    api_key: process.env.CLOUDINARY_API_KEY ? 'PRESENT' : 'MISSING',
    api_secret: process.env.CLOUDINARY_API_SECRET ? 'PRESENT' : 'MISSING'
});

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;
