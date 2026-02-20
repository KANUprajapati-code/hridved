import { checkFshipServiceability } from './utils/fshipService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const testControllerLogic = async () => {
    const tests = {
        apiKey: !!process.env.FSHIP_API_KEY,
        baseUrl: process.env.FSHIP_BASE_URL || 'https://capi.fship.in',
        results: {},
    };

    try {
        console.log('Running logic...');
        // Test 1: Serviceability Check
        try {
            console.log('Calling checkFshipServiceability...');
            const serviceabilityResult = await checkFshipServiceability('560001', 0.5, 0);
            console.log('Result 1:', serviceabilityResult);
            tests.results.serviceability = {
                status: 'success',
                data: serviceabilityResult,
            };
        } catch (error) {
            console.log('Error 1 caught:', error);
            tests.results.serviceability = {
                status: 'failed',
                error: error.message || 'Unknown error',
                details: error.data,
            };
        }

        console.log('Final Tests Object:', JSON.stringify(tests, null, 2));

    } catch (error) {
        console.error('Outer Error:', error);
    }
};

testControllerLogic();
