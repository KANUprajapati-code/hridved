import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

/**
 * 🔍 Fship Pickup ID Discovery Script
 * This script will fetch all pickup locations from your Fship account 
 * so you can find the correct ID for your .env file.
 */
const findPickupId = async () => {
    // 1. Get credentials from .env
    const token = process.env.FSHIP_TOKEN;
    const baseUrl = (process.env.FSHIP_BASE_URL || 'https://capi.fship.in').replace(/\/+$/, '');

    if (!token || token === 'your_fship_token_here' || token.length < 10) {
        console.error("❌ ERROR: Please add your real FSHIP_TOKEN in the .env file first!");
        return;
    }

    console.log(`📡 Connecting to: ${baseUrl}`);

    // List of common Fship endpoints that might return warehouse/pickup info
    const endpoints = [
        '/api/getpickupaddress',
        '/api/pickupaddresslist',
        '/api/getwarehouselist',
        '/api/warehouse/list'
    ];

    console.log("🔍 Fetching Pickup Addresses from Fship...");

    for (const endpoint of endpoints) {
        try {
            console.log(`\n🔄 Trying endpoint: ${endpoint}...`);
            const response = await axios.post(`${baseUrl}${endpoint}`, {}, {
                headers: {
                    'signature': token,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });

            if (response.data && response.data.status === true) {
                console.log(`✅ SUCCESS on ${endpoint}!`);
                // Fship sometimes nests data in 'pickupaddress' or 'data'
                const list = response.data.pickupaddress || response.data.data || [];

                if (list.length === 0) {
                    console.log("⚠️ API connected but no warehouses found in this account.");
                } else {
                    console.log("\n✅ Warehouse(s) found:");
                    console.log("-----------------------------------------");
                    list.forEach((addr, i) => {
                        console.log(`[${i + 1}] Name: ${addr.warehouse_Name || addr.name || 'N/A'}`);
                        console.log(`    📍 PICKUP ID: ${addr.pickup_Address_ID || addr.id}  <-- USE THIS IN .env`);
                        console.log(`    📌 Pincode: ${addr.pincode || 'N/A'}`);
                        console.log("-----------------------------------------");
                    });
                }
                return;
            } else {
                console.log(`❌ ${endpoint} returned:`, response.data.message || "No data");
            }
        } catch (error) {
            console.log(`❌ ${endpoint} failed with status: ${error.response?.status || 'Network Error'}`);
        }
    }

    console.log("\n❌ Could not find the ID automatically.");
    console.log("👉 Please check your Fship Dashboard manually under Settings > Manage Warehouse.");
};

findPickupId();
