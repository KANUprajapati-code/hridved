import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const DEFAULT_BASE = 'https://api.fship.in';
const FSHIP_BASE_URL = (process.env.FSHIP_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
const FSHIP_KEY = (process.env.FSHIP_SIGNATURE || process.env.FSHIP_API_KEY || '').trim();
const FSHIP_PICKUP_ID = process.env.FSHIP_PICKUP_ID || '0';
const FSHIP_AUTH_HEADER = process.env.FSHIP_AUTH_HEADER || 'signature';
const FSHIP_AUTH_PREFIX = process.env.FSHIP_AUTH_PREFIX || ''; // e.g. 'Bearer '

if (!FSHIP_KEY) {
    console.warn('[SHIPMENT] WARNING: FSHIP API key/signature is not set (FSHIP_SIGNATURE or FSHIP_API_KEY). Requests will likely 401.');
}

const fshipClient = axios.create({
    baseURL: FSHIP_BASE_URL,
    timeout: 15000,
});

// Interceptor to handle headers and improved request logging
fshipClient.interceptors.request.use((config) => {
    const fullUrl = `${config.baseURL}${config.url}`;

    // Use configured header name
    config.headers['Content-Type'] = 'application/json';
    if (FSHIP_KEY) {
        const authValue = `${FSHIP_AUTH_PREFIX || ''}${FSHIP_KEY}`;
        config.headers[FSHIP_AUTH_HEADER] = authValue;
    }

    const bodyPreview = config.data ? (typeof config.data === 'string' ? config.data : JSON.stringify(config.data)) : '';
    console.log(`Fship Request: [${(config.method || 'POST').toUpperCase()}] ${fullUrl}`);
    console.log(`Fship Auth: header '${FSHIP_AUTH_HEADER}' length=${FSHIP_KEY.length}`);
    if (bodyPreview) console.log(`Fship Body Preview: ${bodyPreview.substring(0, 512)}`);

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
        const path = process.env.FSHIP_PATH_CREATE_FORWARD_ORDER || '/api/createforwardorder';
        const response = await fshipClient.post(path, orderData);
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
        const path = process.env.FSHIP_PATH_SHIPMENT_SUMMARY || '/api/shipmentsummary';
        const response = await fshipClient.post(path, { waybill });
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
        const path = process.env.FSHIP_PATH_TRACKING_HISTORY || '/api/trackinghistory';
        const response = await fshipClient.post(path, { waybill });
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
        const path = process.env.FSHIP_PATH_REGISTER_PICKUP || '/api/registerpickup';
        const response = await fshipClient.post(path, { waybills });
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
        const path = process.env.FSHIP_PATH_SHIPPING_LABEL_BY_PICKUP_ID || '/api/shippinglabelbypickupid';
        const response = await fshipClient.post(path, { pickupOrderId });
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
        const path = process.env.FSHIP_PATH_CREATE_REVERSE_ORDER || '/api/createreverseorder';
        const response = await fshipClient.post(path, reverseOrderData);
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
        const path = process.env.FSHIP_PATH_SERVICEABILITY || '/v1/courier/serviceability';
        // Many APIs use camelCase; include both variants if needed by server (harmless extra fields in most cases)
        const payload = {
            source_Pincode: sourcePincode,
            destination_Pincode: destinationPincode,
            sourcePincode: sourcePincode,
            destinationPincode: destinationPincode
        };
        const response = await fshipClient.post(path, payload);
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
            pick_Address_ID: process.env.FSHIP_PICKUP_ID || FSHIP_PICKUP_ID,
            return_Address_ID: process.env.FSHIP_PICKUP_ID || FSHIP_PICKUP_ID,
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
        if (error.response?.headers) {
            console.log('[SHIPMENT] Fship Response Headers:', JSON.stringify(error.response.headers, null, 2));
        }
        if (error.data) {
            console.error(`[SHIPMENT] Fship API Response Data:`, JSON.stringify(error.data, null, 2));
        }
        throw error;
    }
};

export default fshipClient;
