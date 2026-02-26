import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

const FSHIP_TOKEN = process.env.FSHIP_TOKEN || 'NOT FOUND';
const FSHIP_BASE_URL = process.env.FSHIP_BASE_URL || 'https://capi.fship.in';

console.log('--- ENV CHECK ---');
console.log('FSHIP_BASE_URL:', FSHIP_BASE_URL);
console.log('FSHIP_TOKEN (first 4):', FSHIP_TOKEN.substring(0, 4) + '...');
console.log('FSHIP_TOKEN (length):', FSHIP_TOKEN.length);

const fshipClient = axios.create({
    baseURL: FSHIP_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'signature': FSHIP_TOKEN,
    },
});

console.log('--- AXIOS HEADERS ---');
console.log(fshipClient.defaults.headers);
