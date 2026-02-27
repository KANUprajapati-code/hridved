const axios = require('axios');

const VAMASHIP_TOKEN = 'nsaGISQu2jnUy3cpxZk0VI4XdkOgUmDKwU426JtN3'; // from vamashipService.js
const bases = [
    'https://ecom3stagingapi.vamaship.com/ecom/api/v1',
    'https://ecom3stagingapi.vamaship.com/ecom/v1',
    'https://ecom3stagingapi.vamaship.com/api/v1',
    'https://ecom3stagingapi.vamaship.com/v1'
];
const endpoints = ['/shipping-quote', '/rates', '/shipping/rates'];

async function test() {
    for (const base of bases) {
        for (const endpoint of endpoints) {
            const url = base + endpoint;
            try {
                console.log(`Testing ${url}...`);
                const response = await axios.post(url, {
                    type: 'cod',
                    origin: '400001',
                    destination: '400002',
                    weight: 0.5,
                    length: 10,
                    width: 10,
                    height: 10
                }, {
                    headers: { 'X-Vamaship-Token': VAMASHIP_TOKEN }
                });
                console.log(`SUCCESS: ${url} reached with status ${response.status}`);
                return;
            } catch (error) {
                console.log(`FAILED: ${url} -> ${error.response?.status || error.message}`);
                if (error.response?.data) {
                    console.log(`   Data: ${JSON.stringify(error.response.data)}`);
                }
            }
        }
    }
}

test();
