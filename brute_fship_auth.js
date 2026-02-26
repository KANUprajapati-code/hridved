import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const FSHIP_TOKEN = process.env.FSHIP_TOKEN;
const FSHIP_BASE_URL = 'https://capi.fship.in';
const SANDBOX_URL = 'https://capi-qc.fship.in';
const SANDBOX_KEY = '085c36066064af83c66b9dbf44d190d40feec79f437bc1c1cb';

const authVariations = [
    { name: 'SANDBOX CHECK (Doc Key)', url: `${SANDBOX_URL}/api/getallcourier`, headers: { 'signature': SANDBOX_KEY } },
    { name: 'SANDBOX CHECK (Doc Key + bearer)', url: `${SANDBOX_URL}/api/getallcourier`, headers: { 'signature': `bearer ${SANDBOX_KEY}` } },
    { name: 'production: signature: raw', url: `${FSHIP_BASE_URL}/api/getallcourier`, headers: { 'signature': FSHIP_TOKEN } },
    { name: 'production: signature: bearer', url: `${FSHIP_BASE_URL}/api/getallcourier`, headers: { 'signature': `bearer ${FSHIP_TOKEN}` } },
    { name: 'production: signature: Bearer', url: `${FSHIP_BASE_URL}/api/getallcourier`, headers: { 'signature': `Bearer ${FSHIP_TOKEN}` } },
];

async function bruteForceAuth() {
    console.log('Testing Authentication Variations...');

    for (const variation of authVariations) {
        console.log(`\n--- Testing ${variation.name} ---`);
        try {
            const response = await axios.get(variation.url, {
                headers: {
                    ...variation.headers,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            console.log(`SUCCESS [${response.status}] for ${variation.name}`);
            console.log('Data Preview:', JSON.stringify(response.data).substring(0, 100));
            // We continue testing everything to see Sandbox vs Production behavior
        } catch (error) {
            console.log(`FAILED [${error.response?.status || error.message}]`);
        }
    }
    console.log('\nAll variations tested.');
}

bruteForceAuth();
