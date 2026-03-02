import { checkFshipServiceability } from './utils/fshipService.js';

async function verifyConnection() {
    console.log('--- Fship Staging Connection Verification ---');
    console.log('Testing Pincode Serviceability...');

    try {
        const result = await checkFshipServiceability('383325', '400001');

        if (result && result.status === true) {
            console.log('\n✅ SUCCESS!');
            console.log('RESULT_START' + JSON.stringify(result) + 'RESULT_END');
        } else {
            console.log('\n❌ FAILED');
            console.log('RESULT_START' + JSON.stringify(result) + 'RESULT_END');
        }
    } catch (error) {
        console.log('\n❌ ERROR');
        console.log('Could not connect to Fship Staging.');
        console.log('Status:', error.status || 'N/A');
        console.log('Message:', error.message);
        if (error.data) {
            console.log('Details:', JSON.stringify(error.data, null, 2));
        }

        if (error.status === 401) {
            console.log('\n👉 HINT: This is still a 401 Unauthorized error. Please update your FSHIP_SIGNATURE in .env with a valid Staging key.');
        }
    }
}

verifyConnection();
