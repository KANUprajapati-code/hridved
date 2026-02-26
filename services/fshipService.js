import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const FSHIP_SIGNATURE = process.env.FSHIP_SIGNATURE;
const FSHIP_BASE_URL = 'https://capi-qc.fship.in';

const fshipClient = axios.create({
    baseURL: FSHIP_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'signature': FSHIP_SIGNATURE
    }
});

/**
 * Create Forward Order
 * @param {Object} orderData 
 */
export const createForwardOrder = async (orderData) => {
    try {
        const response = await fshipClient.post('/api/createforwardorder', orderData);
        return response.data;
    } catch (error) {
        throw {
            status: error.response?.status || 500,
            message: error.response?.data?.message || error.message,
            data: error.response?.data
        };
    }
};

/**
 * Get Tracking History
 * @param {string} waybill 
 */
export const getTrackingHistory = async (waybill) => {
    try {
        const response = await fshipClient.post('/api/trackinghistory', { waybill });
        return response.data;
    } catch (error) {
        throw {
            status: error.response?.status || 500,
            message: error.response?.data?.message || error.message,
            data: error.response?.data
        };
    }
};

/**
 * Get Shipment Summary (Latest Status)
 * @param {string} waybill 
 */
export const getShipmentSummary = async (waybill) => {
    try {
        const response = await fshipClient.post('/api/shipmentsummary', { waybill });
        return response.data;
    } catch (error) {
        throw {
            status: error.response?.status || 500,
            message: error.response?.data?.message || error.message,
            data: error.response?.data
        };
    }
};
