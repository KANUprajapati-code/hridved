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

async function runFullDiagnostics() {
    console.log(`--- Starting Comprehensive Fship Staging Diagnostics ---`);
    const results = {
        metadata: {
            timestamp: new Date().toISOString(),
            baseUrl: FSHIP_STAGING_BASE,
            apiKeyUsed: FSHIP_KEY ? `${FSHIP_KEY.substring(0, 5)}...` : 'MISSING'
        },
        tests: []
    };

    if (!FSHIP_KEY) {
        console.error('Error: FSHIP_SIGNATURE is missing in .env');
        process.exit(1);
    }

    const headers = ['signature', 'Authorization', 'Token'];
    const prefixes = ['', 'Bearer', 'bearer'];

    for (const header of headers) {
        for (const prefix of prefixes) {
            const authValue = prefix ? `${prefix} ${FSHIP_KEY}` : FSHIP_KEY;
            console.log(`Testing: Header="${header}", Prefix="${prefix || 'None'}"`);

            const testResult = {
                config: {
                    header,
                    prefix: prefix || null,
                    endpoint: `${FSHIP_STAGING_BASE}/api/pincodeserviceability`
                },
                response: null,
                error: null,
                success: false
            };

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
                testResult.success = true;
                testResult.response = response.data;
                console.log(`✅ SUCCESS [${response.status}]`);
            } catch (error) {
                testResult.success = false;
                testResult.error = {
                    message: error.message,
                    status: error.response?.status,
                    data: error.response?.data
                };
                console.log(`❌ FAILED [${error.response?.status || error.message}]`);
            }
            results.tests.push(testResult);
        }
    }

    const outputPath = path.join(__dirname, '../fship_test_results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n✅ COMPLETED: All test results saved to ${outputPath}`);
}

runFullDiagnostics();
