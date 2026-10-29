import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dzyyckpal';
const apiKey = process.env.CLOUDINARY_API_KEY || '123878386725769';
const apiSecret = process.env.CLOUDINARY_API_SECRET || 'CGYoFs99vPmuIiYoHYlJvpKO8eM';

console.log('Initializing Cloudinary with:', {
    cloud_name: cloudName ? 'CONFIGURED' : 'MISSING',
    api_key: apiKey ? 'CONFIGURED' : 'MISSING',
    api_secret: apiSecret ? 'CONFIGURED' : 'MISSING'
});

cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
});

export default cloudinary;
