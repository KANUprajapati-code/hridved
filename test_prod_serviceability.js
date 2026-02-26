import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const FSHIP_TOKEN = process.env.FSHIP_TOKEN;
const FSHIP_BASE_URL = 'https://capi.fship.in';

async function testServiceability() {
    console.log('Testing Production Fship Serviceability...');
    console.log('URL:', `${FSHIP_BASE_URL}/api/pincodeserviceability`);

    try {
        const response = await axios.post(`${FSHIP_BASE_URL}/api/pincodeserviceability`,
            {
                source_Pincode: "383325",
                destination_Pincode: "400001"
            },
            {
                headers: {
                    'signature': FSHIP_TOKEN.trim(),
                    'Content-Type': 'application/json'
                }
            });

        console.log('SUCCESS!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('FAILED');
        console.log('Status:', error.response?.status);
        console.log('Data:', JSON.stringify(error.response?.data, null, 2));
    }
}

testServiceability();
