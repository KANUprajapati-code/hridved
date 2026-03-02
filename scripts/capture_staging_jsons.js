import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const REPORT_PATH = path.join(__dirname, '../shipping_integration_report.md');
const LOG = [];

function addToLog(title, url, method, request, response, status) {
    LOG.push(`
## ${title}
**URL:** \`${url}\`
**Method:** \`${method}\`
**Status:** \`${status}\`

### Request JSON
\`\`\`json
${JSON.stringify(request, null, 2)}
\`\`\`

### Response JSON
\`\`\`json
${JSON.stringify(response, null, 2)}
\`\`\`
---
`);
}

async function captureFship() {
    const FSHIP_BASE = 'https://capi-qc.fship.in';
    const FSHIP_KEY = process.env.FSHIP_SIGNATURE;
    const client = axios.create({
        baseURL: FSHIP_BASE,
        headers: {
            'signature': FSHIP_KEY,
            'Content-Type': 'application/json'
        }
    });

    console.log('Capturing Fship Staging...');

    // 1. Serviceability
    try {
        const payload = { source_Pincode: "383325", destination_Pincode: "400001" };
        const res = await client.post('/api/pincodeserviceability', payload);
        addToLog('Fship Serviceability (Staging)', FSHIP_BASE + '/api/pincodeserviceability', 'POST', payload, res.data, res.status);
    } catch (e) {
        addToLog('Fship Serviceability (Staging) - FAILED', FSHIP_BASE + '/api/pincodeserviceability', 'POST', { source_Pincode: "383325", destination_Pincode: "400001" }, e.response?.data || e.message, e.response?.status || 'ERROR');
    }

    // 2. Create Order
    try {
        const payload = {
            customer_Name: "Test User",
            customer_Mobile: "9999999999",
            customer_Emailid: "test@example.com",
            customer_Address: "Test Address, Mumbai",
            customer_PinCode: "400001",
            customer_City: "Mumbai",
            orderId: "TEST" + Date.now(),
            invoice_Number: "INV" + Date.now(),
            payment_Mode: 1,
            express_Type: "surface",
            total_Amount: 500,
            shipment_Weight: 0.5,
            shipment_Length: 10,
            shipment_Width: 10,
            shipment_Height: 10,
            pick_Address_ID: process.env.FSHIP_PICKUP_ID || 0,
            products: [{ productName: "Test Product", unitPrice: 500, quantity: 1, sku: "SKU123" }]
        };
        const res = await client.post('/api/createforwardorder', payload);
        addToLog('Fship Order Creation (Staging)', FSHIP_BASE + '/api/createforwardorder', 'POST', payload, res.data, res.status);
    } catch (e) {
        addToLog('Fship Order Creation (Staging) - FAILED', FSHIP_BASE + '/api/createforwardorder', 'POST', {}, e.response?.data || e.message, e.response?.status || 'ERROR');
    }
}

async function captureVamaship() {
    const VAMA_BASE = 'https://ecom3stagingapi.vamaship.com/ecom/api/v1';
    const VAMA_TOKEN = process.env.VAMASHIP_TOKEN;
    const client = axios.create({
        baseURL: VAMA_BASE,
        headers: {
            'X-Vamaship-Token': VAMA_TOKEN,
            'Content-Type': 'application/json'
        }
    });

    console.log('Capturing Vamaship Staging...');

    // 1. Rates
    try {
        const payload = {
            type: "prepaid",
            origin: "383325",
            destination: "400001",
            weight: 0.5,
            length: 10,
            width: 10,
            height: 10
        };
        const res = await client.post('/dom/quote', payload);
        addToLog('Vamaship Rates (Staging)', VAMA_BASE + '/dom/quote', 'POST', payload, res.data, res.status);
    } catch (e) {
        addToLog('Vamaship Rates (Staging) - FAILED', VAMA_BASE + '/dom/quote', 'POST', {}, e.response?.data || e.message, e.response?.status || 'ERROR');
    }

    // 2. Create Order
    try {
        const payload = {
            seller: {
                name: "Hridved Ayurveda",
                phone: "9876543210",
                email: "hridved@gmail.com",
                pincode: "383325"
            },
            shipments: [{
                type: "prepaid",
                consignee: {
                    name: "Test User",
                    phone: "9999999999",
                    address: "Test Address, Mumbai",
                    pincode: "400001"
                },
                order_id: "TESTV" + Date.now(),
                total_value: 500,
                item_details: [{ name: "Test Product", quantity: 1, value: 500, weight: 0.5 }]
            }]
        };
        const res = await client.post('/shipments/book', payload);
        addToLog('Vamaship Order Creation (Staging)', VAMA_BASE + '/shipments/book', 'POST', payload, res.data, res.status);
    } catch (e) {
        addToLog('Vamaship Order Creation (Staging) - FAILED', VAMA_BASE + '/shipments/book', 'POST', {}, e.response?.data || e.message, e.response?.status || 'ERROR');
    }
}

async function run() {
    await captureFship();
    await captureVamaship();

    const header = `# Shipping Integration Report\nGenerated on: ${new Date().toLocaleString()}\n\n`;
    fs.writeFileSync(REPORT_PATH, header + LOG.join('\n'));
    console.log(`Report generated: ${REPORT_PATH}`);
}

run();
