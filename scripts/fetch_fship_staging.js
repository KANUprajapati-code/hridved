import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const FSHIP_STAGING_BASE = process.env.FSHIP_BASE_URL || 'https://capi-qc.fship.in';
const FSHIP_KEY = process.env.FSHIP_SIGNATURE;

async function fetchStagingData() {
    console.log(`--- Fetching Fship Staging Data ---`);
    console.log(`URL: ${FSHIP_STAGING_BASE}/api/pincodeserviceability`);

    if (!FSHIP_KEY) {
        console.error('Error: FSHIP_SIGNATURE is missing in .env');
        process.exit(1);
    }

    try {
        const response = await axios.post(`${FSHIP_STAGING_BASE}/api/pincodeserviceability`,
            { source_Pincode: "383325", destination_Pincode: "400001" },
            {
                headers: {
                    'signature': FSHIP_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        const outputPath = path.join(__dirname, '../fship_staging_response.json');
        fs.writeFileSync(outputPath, JSON.stringify(response.data, null, 2));

        console.log(`✅ SUCCESS: Response saved to ${outputPath}`);
        console.log('Response Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        const errorData = error.response?.data || { message: error.message };
        const outputPath = path.join(__dirname, '../fship_staging_error.json');
        fs.writeFileSync(outputPath, JSON.stringify(errorData, null, 2));

        console.error(`❌ FAILED: ${error.message}`);
        if (error.response) {
            console.error('Error Response:', JSON.stringify(error.response.data, null, 2));
        }
        console.log(`Error saved to ${outputPath}`);
    }
}

fetchStagingData();
