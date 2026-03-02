import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const FSHIP_STAGING_BASE = 'https://capi-qc.fship.in';
const FSHIP_KEY = process.env.FSHIP_SIGNATURE;

async function testCombination(header, prefix) {
    const authValue = prefix ? `${prefix} ${FSHIP_KEY}` : FSHIP_KEY;
    console.log(`Testing: Header="${header}", Prefix="${prefix}"`);

    try {
        const response = await axios.post(`${FSHIP_STAGING_BASE}/api/pincodeserviceability`,
            { source_Pincode: "383325", destination_Pincode: "400001" },
            {
                headers: {
                    [header]: authValue,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            }
        );
        console.log(`✅ SUCCESS [${response.status}] for ${header} with "${prefix}"`);
        return true;
    } catch (error) {
        console.log(`❌ FAILED [${error.response?.status || error.message}]`);
        return false;
    }
}

async function runDiagnostics() {
    console.log(`--- Starting Fship Staging Diagnostics ---`);
    console.log(`Base URL: ${FSHIP_STAGING_BASE}`);
    console.log(`API Key: ${FSHIP_KEY ? FSHIP_KEY.substring(0, 5) + '...' : 'MISSING'}\n`);

    if (!FSHIP_KEY) {
        console.error('Error: FSHIP_SIGNATURE is missing in .env');
        return;
    }

    const headers = ['signature', 'Authorization', 'Token'];
    const prefixes = ['', 'Bearer', 'bearer'];

    for (const h of headers) {
        for (const p of prefixes) {
            const success = await testCombination(h, p);
            if (success) {
                console.log('\n!!! FOUND WORKING CONFIGURATION !!!');
                console.log(`Header: ${h}`);
                console.log(`Prefix: ${p}`);
                return;
            }
        }
    }

    console.log('\nAll tested combinations failed for Fship staging.');
}

runDiagnostics();
