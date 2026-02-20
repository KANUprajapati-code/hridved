import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const FSHIP_API_KEY = process.env.FSHIP_API_KEY;
const PINCODE = '560001';

const domains = [
    'https://api.fship.in',
    'https://app.fship.in',
    'https://capi.fship.in',
    'https://api.fship.in/v1',
    'https://app.fship.in/api/v1',
    'https://capi.fship.in/v1'
];

const paths = [
    'courier/serviceability',
    'serviceability',
    'pincode/serviceability',
    'v1/courier/serviceability',
    'api/v1/courier/serviceability',
    'v1/serviceability',
    'api/v1/serviceability',
    'pincode-serviceability',
    'v1/pincode-serviceability'
];

const test = async () => {
    for (const domain of domains) {
        for (const path of paths) {
            const url = `${domain.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
            try {
                const response = await axios.post(url,
                    { pincode: PINCODE, weight: 0.5, cod: 0 },
                    { headers: { 'signature': FSHIP_API_KEY, 'Content-Type': 'application/json' }, timeout: 5000 }
                );
                console.log(`FOUND!!! [200] ${url}`);
                console.log('Result:', JSON.stringify(response.data).substring(0, 100));
                return;
            } catch (error) {
                const status = error.response?.status || error.message;
                if (status === 401) {
                    console.log(`PROBABLY CORRECT PATH [401]: ${url}`);
                } else if (status !== 404) {
                    console.log(`OTHER [${status}]: ${url}`);
                }
            }
        }
    }
    console.log('Brute force finished. No 200 found.');
};

test();
