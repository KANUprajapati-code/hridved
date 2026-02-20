import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const FSHIP_API_KEY = process.env.FSHIP_API_KEY;
const PINCODE = '560001';

const testAuth = async (baseUrl, headerName, tokenPrefix = '') => {
    const url = `${baseUrl.replace(/\/$/, '')}/courier/serviceability`;
    const token = tokenPrefix ? `${tokenPrefix} ${FSHIP_API_KEY}` : FSHIP_API_KEY;
    console.log(`Testing [${headerName}]: ${url} (Prefix: "${tokenPrefix}")`);
    try {
        const response = await axios.post(url,
            { pincode: PINCODE, weight: 0.5, cod: 0 },
            { headers: { [headerName]: token, 'Content-Type': 'application/json' } }
        );
        console.log(`SUCCESS: ${headerName} on ${url} (Status: ${response.status})`);
        return true;
    } catch (error) {
        console.log(`FAILED: ${headerName} on ${url} (Status: ${error.response?.status || error.message})`);
        return false;
    }
};

const runTests = async () => {
    const baseUrls = [
        'https://api.fship.in/v1',
        'https://app.fship.in/api/v1',
        'https://capi.fship.in/v1'
    ];

    const authOptions = [
        { header: 'signature', prefix: '' },
        { header: 'Authorization', prefix: 'Bearer' },
        { header: 'Authorization', prefix: '' },
        { header: 'Token', prefix: '' },
        { header: 'x-api-key', prefix: '' }
    ];

    for (const baseUrl of baseUrls) {
        for (const auth of authOptions) {
            const success = await testAuth(baseUrl, auth.header, auth.prefix);
            if (success) {
                console.log('!!! FOUND WORKING CONFIGURATION !!!');
                console.log(`Base URL: ${baseUrl}`);
                console.log(`Header: ${auth.header}`);
                console.log(`Prefix: ${auth.prefix}`);
                return;
            }
        }
    }
};

runTests();
