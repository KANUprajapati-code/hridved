import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const FSHIP_BASE_URL = (process.env.FSHIP_BASE_URL || 'https://api.fship.in').replace(/\/+$/, '');
const FSHIP_KEY = process.env.FSHIP_TOKEN || process.env.FSHIP_KEY || process.env.FSHIP_API_KEY || '';

const fshipClient = axios.create({
    baseURL: FSHIP_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
        'signature': FSHIP_KEY,
    },
});

// Interceptor to log full URLs for debugging
fshipClient.interceptors.request.use((config) => {
    const fullUrl = `${config.baseURL}${config.url}`;
    console.log(`Fship Request: [${config.method.toUpperCase()}] ${fullUrl}`);
    return config;
});

const formatAxiosError = (error) => ({
    message: error.message,
    status: error.response?.status,
    data: error.response?.data,
});

/**
 * 1. Create Forward Order
 * @param {Object} orderData 
 */
export const createFshipForwardOrder = async (orderData) => {
    try {
        const response = await fshipClient.post('/api/createforwardorder', orderData);
        return response.data;
    } catch (error) {
        throw formatAxiosError(error);
    }
};

/**
 * 2. Shipment Summary (Latest Status)
 * @param {string} waybill 
 */
export const getFshipShipmentSummary = async (waybill) => {
    try {
        const response = await fshipClient.post('/api/shipmentsummary', { waybill });
        return response.data;
    } catch (error) {
        throw formatAxiosError(error);
    }
};

/**
 * 3. Tracking History (Full Timeline)
 * @param {string} waybill 
 */
export const getFshipTrackingHistory = async (waybill) => {
    try {
        const response = await fshipClient.post('/api/trackinghistory', { waybill });
        return response.data;
    } catch (error) {
        throw formatAxiosError(error);
    }
};

/**
 * 4. Register Pickup
 * @param {Array<string>} waybills 
 */
export const registerFshipPickup = async (waybills) => {
    try {
        const response = await fshipClient.post('/api/registerpickup', { waybills });
        return response.data;
    } catch (error) {
        throw formatAxiosError(error);
    }
};

/**
 * 5. Shipping Label by Pickup ID
 * @param {Array<number>} pickupOrderId 
 */
export const getFshipShippingLabelByPickupId = async (pickupOrderId) => {
    try {
        const response = await fshipClient.post('/api/shippinglabelbypickupid', { pickupOrderId });
        return response.data;
    } catch (error) {
        throw formatAxiosError(error);
    }
};

/**
 * 6. Create Reverse Order
 * @param {Object} reverseOrderData 
 */
export const createFshipReverseOrder = async (reverseOrderData) => {
    try {
        const response = await fshipClient.post('/api/createreverseorder', reverseOrderData);
        return response.data;
    } catch (error) {
        throw formatAxiosError(error);
    }
};

/**
 * Legacy/Utility: Check Serviceability
 */
export const checkFshipServiceability = async (sourcePincode, destinationPincode) => {
    try {
        const response = await fshipClient.post('/api/pincodeserviceability', {
            source_Pincode: sourcePincode,
            destination_Pincode: destinationPincode
        });
        return response.data;
    } catch (error) {
        throw formatAxiosError(error);
    }
};

export default fshipClient;
