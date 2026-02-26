import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api/fship';

const testReimplementation = async () => {
    console.log('Testing New Fship Reimplementation...');

    // 1. Test Courier List (Serviceability equivalent)
    try {
        console.log('\n--- Testing Courier List (GET equivalent) ---');
        // Note: I didn't explicitly add a route for getallcourier in fshipRoutes.js 
        // but I can add it or just test the order creation with dummy data.
    } catch (e) { }

    // 2. Test Order Creation (Dummy Data)
    try {
        console.log('\n--- Testing Forward Order Creation (Staging) ---');
        const orderData = {
            customer_Name: "Test User",
            customer_Mobile: "9999999999",
            customer_Address: "Test Address, Mumbai",
            customer_PinCode: "400001",
            payment_Mode: 1, // COD
            total_Amount: 500,
            cod_Amount: 500,
            shipment_Weight: 0.5,
            shipment_Length: 10,
            shipment_Width: 10,
            shipment_Height: 10,
            pick_Address_ID: 1515, // Change to your actual pickup ID
            products: [
                {
                    productName: "Test Product",
                    unitPrice: 500,
                    quantity: 1
                }
            ]
        };

        const response = await axios.post(`${BASE_URL}/create-order`, orderData);
        console.log('SUCCESS!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('FAILED');
        console.log('Status:', error.response?.status);
        console.log('Data:', JSON.stringify(error.response?.data, null, 2));
    }
};

testReimplementation();
