import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const FSHIP_BASE_URL = (process.env.FSHIP_BASE_URL || 'https://capi.fship.in').replace(/\/+$/, '');
const FSHIP_KEY = process.env.FSHIP_TOKEN || process.env.FSHIP_KEY || process.env.FSHIP_API_KEY || '';
const FSHIP_PICKUP_ID = process.env.FSHIP_PICKUP_ID || '0';

const fshipClient = axios.create({
    baseURL: FSHIP_BASE_URL,
    timeout: 15000,
});

// Interceptor to log full URLs and handle headers dynamically
fshipClient.interceptors.request.use((config) => {
    const fullUrl = `${config.baseURL}${config.url}`;

    // Ensure we have a token
    if (!FSHIP_KEY) {
        console.warn('[SHIPMENT] WARNING: FSHIP_TOKEN is missing in environment!');
    }

    // Fship typically uses 'signature' header for the token
    config.headers['Content-Type'] = 'application/json';
    config.headers['signature'] = FSHIP_KEY;

    // Add Authorization header as fallback/alternative if signature doesn't work
    // Some Fship accounts use Bearer token pattern
    config.headers['Authorization'] = `Bearer ${FSHIP_KEY}`;

    console.log(`Fship Request: [${config.method.toUpperCase()}] ${fullUrl}`);
    console.log(`Fship Headers: signature: ${FSHIP_KEY.substring(0, 5)}..., Authorization: Bearer ${FSHIP_KEY.substring(0, 5)}...`);

    return config;
});

const formatAxiosError = (error) => {
    return {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        config: {
            url: error.config?.url,
            method: error.config?.method,
            data: error.config?.data
        }
    };
};

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


/**
 * Centralized Shipment Creation Helper
 * Handles payload preparation, API call, and DB update
 * @param {string} orderId - Database Order ID
 */
export const processFshipShipment = async (orderId) => {
    try {
        const Order = (await import('../models/Order.js')).default;
        const order = await Order.findById(orderId).populate('user', 'email name');

        if (!order) throw new Error('Order not found');
        if (order.waybill) {
            console.log(`[SHIPMENT] Already exists for Order: ${order._id}. Skipping.`);
            return { success: true, waybill: order.waybill };
        }

        console.log(`[SHIPMENT] Initiating Fship order for: ${order._id}`);

        const payload = {
            customer_Name: order.shippingAddress.fullName,
            customer_Mobile: order.shippingAddress.mobileNumber,
            customer_Emailid: order.user?.email || 'customer@example.com',
            customer_Address: order.shippingAddress.houseNumber,
            landMark: order.shippingAddress.landmark || '',
            customer_Address_Type: order.shippingAddress.addressType || 'Home',
            customer_PinCode: order.shippingAddress.pincode,
            customer_City: order.shippingAddress.city,
            orderId: order.orderId || `ORD${Date.now()}`,
            invoice_Number: order.orderId || `ORD${Date.now()}`,
            payment_Mode: order.paymentMethod === 'COD' ? 1 : 2, // 1=COD, 2=PREPAID
            express_Type: order.deliveryOption === 'Express' ? 'air' : 'surface',
            order_Amount: Math.round(order.totalPrice),
            total_Amount: Math.round(order.totalPrice),
            cod_Amount: order.paymentMethod === 'COD' ? Math.round(order.totalPrice) : 0,
            shipment_Weight: 0.5,
            shipment_Length: 10,
            shipment_Width: 10,
            shipment_Height: 10,
            pick_Address_ID: process.env.FSHIP_PICKUP_ID || 0,
            return_Address_ID: process.env.FSHIP_PICKUP_ID || 0,
            products: order.orderItems.map(item => ({
                productName: item.name,
                unitPrice: item.price,
                quantity: item.qty,
                sku: String(item.product)
            }))
        };

        const result = await createFshipForwardOrder(payload);

        if (result && result.status === true) {
            order.waybill = result.waybill;
            order.apiOrderId = result.apiorderid;
            order.shippingStatus = 'Shipped';
            order.shippingProvider = 'Fship';
            await order.save();
            console.log(`[SHIPMENT] SUCCESS. Waybill: ${result.waybill}`);
            return { success: true, waybill: result.waybill };
        }

        console.error(`[SHIPMENT] Fship API Failure:`, result);
        order.shippingStatus = 'Shipping Pending';
        await order.save();
        return { success: false, details: result };
    } catch (error) {
        console.error(`[SHIPMENT] CRITICAL ERROR matching order ${orderId}:`, error.message);
        if (error.data) {
            console.error(`[SHIPMENT] Fship API Response Data:`, JSON.stringify(error.data, null, 2));
        }
        throw error;
    }
};

export default fshipClient;
