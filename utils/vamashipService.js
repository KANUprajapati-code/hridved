import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Vamaship client helper
 *
 * Defaults to staging credentials provided in the chat. Override via env:
 * - VAMASHIP_BASE_URL
 * - VAMASHIP_TOKEN
 * - VAMASHIP_AUTH_PREFIX (e.g. 'Bearer ' or 'Token ')
 */

const DEFAULT_BASE = (
    process.env.VAMASHIP_BASE_URL ||
    'https://ecom3stagingapi.vamaship.com/ecom/api/v1/'
).replace(/\/+$/, '');

const VAMASHIP_TOKEN = (
    process.env.VAMASHIP_TOKEN ||
    'nsaGISQu2jnUy3cpxZk0VI4XdkOgUmDKwU426JtN3'
).trim();

const VAMASHIP_AUTH_PREFIX = process.env.VAMASHIP_AUTH_PREFIX !== undefined
    ? process.env.VAMASHIP_AUTH_PREFIX
    : 'Bearer ';

const vamashipClient = axios.create({
    baseURL: DEFAULT_BASE,
    timeout: 20000,
});

vamashipClient.interceptors.request.use((config) => {
    config.headers = config.headers || {};
    config.headers['Content-Type'] = 'application/json';
    if (VAMASHIP_TOKEN) {
        config.headers['Authorization'] = `${VAMASHIP_AUTH_PREFIX || ''}${VAMASHIP_TOKEN}`;
    }
    console.log(`\n[VAMASHIP REQUEST] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
});

const formatAxiosError = (error) => ({
    message: error.message,
    status: error.response?.status,
    data: error.response?.data,
});

/**
 * Generic request helper
 * @param {'get'|'post'|'put'|'patch'|'delete'} method
 * @param {string} path - path relative to baseURL (leading slash optional)
 * @param {object} [data]
 */
export const vamashipRequest = async (method, path, data) => {
    try {
        const url = path.replace(/^\//, '');
        const response = await vamashipClient.request({
            method,
            url,
            data,
        });
        return response.data;
    } catch (error) {
        throw formatAxiosError(error);
    }
};

/**
 * Create a Vamaship order (shipment)
 * Note: confirm exact path with your Vamaship docs — adjust `/orders` if needed.
 */
export const createVamashipOrder = async (orderPayload) => {
    return vamashipRequest('post', '/orders', orderPayload);
};

/**
 * Get rates/quotes from Vamaship
 * Path may be `/rates` or `/quote` depending on API version — adjust if needed.
 */
export const getVamashipRates = async (ratesPayload) => {
    return vamashipRequest('post', '/rates', ratesPayload);
};

/**
 * Track consignment by id — adjust path if your API uses different route.
 */
export const trackVamashipConsignment = async (consignmentId) => {
    return vamashipRequest('get', `/consignments/${consignmentId}`);
};

export default vamashipClient;

/**
 * Usage notes:
 * - To test staging, either leave defaults or set:
 *     VAMASHIP_BASE_URL=https://ecom3stagingapi.vamaship.com/ecom/api/v1/
 *     VAMASHIP_TOKEN=<staging token>
 * - For production, set VAMASHIP_BASE_URL and VAMASHIP_TOKEN to production values.
 * - If the API expects a different auth header (e.g. `Token `), set `VAMASHIP_AUTH_PREFIX`.
 */
import axios from 'axios';
import dotenv from 'dotenv';
import https from 'https';
dotenv.config();

const VAMASHIP_BASE_URL = (process.env.VAMASHIP_BASE_URL || 'https://api.vamaship.com/ecom/v1').replace(/\/+$/, '');
const VAMASHIP_TOKEN = process.env.VAMASHIP_TOKEN || '';

export const vamashipClient = axios.create({
    baseURL: VAMASHIP_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
        'X-Vamaship-Token': VAMASHIP_TOKEN
    },
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    })
});

// Debug log for tokens (identifying placeholders)
console.log(`[VAMASHIP] Client Configured. BaseURL: ${VAMASHIP_BASE_URL}`);

vamashipClient.interceptors.request.use((config) => {
    const token = config.headers['X-Vamaship-Token'] || '';
    if (token.startsWith('YOUR_') || token.length === 26) {
        console.warn(`[VAMASHIP] WARNING: Token might be a placeholder or incorrect length: ${token.substring(0, 5)}... (Length: ${token.length})`);
    }
    console.log(`[VAMASHIP] Request: ${config.method.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
});

// Helper to format errors
const formatVamashipError = (error) => {
    return {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        config: {
            url: error.config?.url,
            method: error.config?.method
        }
    };
};

/**
 * Get Shipping Rates
 * Docs: POST /shipping-quote
 */
export const getVamashipRates = async (rateData) => {
    try {
        const response = await vamashipClient.post('/shipping-quote', rateData);
        return response.data;
    } catch (error) {
        throw formatVamashipError(error);
    }
};

/**
 * Book Forward Shipment
 * Docs: POST /shipments/book
 */
export const createVamashipForwardOrder = async (shipmentData) => {
    try {
        const response = await vamashipClient.post('/shipments/book', shipmentData);
        return response.data;
    } catch (error) {
        throw formatVamashipError(error);
    }
};

/**
 * Track Shipment
 * Docs: GET /shipments/track
 */
export const trackVamashipShipment = async (awb) => {
    try {
        const response = await vamashipClient.get(`/shipments/track?awb=${awb}`);
        return response.data;
    } catch (error) {
        throw formatVamashipError(error);
    }
};

/**
 * Cancel Shipment
 * Docs: POST /shipments/cancel
 */
export const cancelVamashipShipment = async (awb) => {
    try {
        const response = await vamashipClient.post('/shipments/cancel', { awb });
        return response.data;
    } catch (error) {
        throw formatVamashipError(error);
    }
};

/**
 * Process Vamaship Shipment Helpber
 */
export const processVamashipShipment = async (orderId) => {
    try {
        const Order = (await import('../models/Order.js')).default;
        const order = await Order.findById(orderId).populate('user', 'email name');

        if (!order) throw new Error('Order not found');
        if (order.waybill) {
            console.log(`[VAMASHIP] Already exists for Order: ${order._id}. Skipping.`);
            return { success: true, waybill: order.waybill };
        }

        console.log(`[VAMASHIP] Initiating Vamaship booking for: ${order._id}`);

        // Prepare Vamaship payload based on documentation
        const payload = {
            seller: {
                name: "Hridved Ayurveda",
                phone: "9876543210", // Placeholder
                email: "hridved@gmail.com",
                address: "Plot No. 123, Modasa Road",
                city: "Dhansura",
                state: "Gujarat",
                pincode: process.env.VAMASHIP_PICKUP_PINCODE || "383325",
                country: "India"
            },
            shipments: [{
                type: order.paymentMethod === 'COD' ? 'cod' : 'prepaid',
                subtype: "general",
                consignee: {
                    name: order.shippingAddress.fullName,
                    phone: order.shippingAddress.mobileNumber,
                    email: order.user?.email || 'customer@example.com',
                    address: order.shippingAddress.houseNumber,
                    city: order.shippingAddress.city,
                    state: order.shippingAddress.state,
                    pincode: order.shippingAddress.pincode,
                    country: "India"
                },
                order_id: order.orderId || `ORD${Date.now()}`,
                total_value: Math.round(order.totalPrice),
                item_details: order.orderItems.map(item => ({
                    name: item.name,
                    quantity: item.qty,
                    value: item.price,
                    weight: 0.5,
                    length: 10,
                    width: 10,
                    height: 10
                })),
                is_cod: order.paymentMethod === 'COD'
            }]
        };

        const result = await createVamashipForwardOrder(payload);

        // Vamaship response typically contains shipments array
        if (result && result.status === "success" && result.data?.shipments?.[0]) {
            const shipData = result.data.shipments[0];
            order.waybill = shipData.awb_number;
            order.apiOrderId = shipData.vamaship_order_id;
            order.shippingStatus = 'Shipped';
            order.shippingProvider = 'Vamaship';
            await order.save();
            console.log(`[VAMASHIP] SUCCESS. AWB: ${shipData.awb_number}`);
            return { success: true, waybill: shipData.awb_number };
        }

        console.error(`[VAMASHIP] API Failure:`, result);
        order.shippingStatus = 'Shipping Pending';
        await order.save();
        return { success: false, details: result };
    } catch (error) {
        console.error(`[VAMASHIP] CRITICAL ERROR matching order ${orderId}:`, error.message);
        throw error;
    }
};

/**
 * Process Vamaship Reverse Shipment
 */
export const processVamashipReverseShipment = async (forwardWaybill) => {
    try {
        const Order = (await import('../models/Order.js')).default;
        const forwardOrder = await Order.findOne({ waybill: forwardWaybill });

        if (!forwardOrder) throw new Error('Forward order not found');

        const payload = {
            seller: {
                name: forwardOrder.shippingAddress.fullName,
                phone: forwardOrder.shippingAddress.mobileNumber,
                email: "customer@example.com",
                address: forwardOrder.shippingAddress.houseNumber,
                city: forwardOrder.shippingAddress.city,
                state: forwardOrder.shippingAddress.state,
                pincode: forwardOrder.shippingAddress.pincode,
                country: "India"
            },
            shipments: [{
                type: "reverse",
                subtype: "general",
                consignee: {
                    name: "Hridved Ayurveda",
                    phone: "9876543210",
                    email: "hridved@gmail.com",
                    address: "Plot No. 123, Modasa Road",
                    city: "Dhansura",
                    state: "Gujarat",
                    pincode: process.env.VAMASHIP_PICKUP_PINCODE || "383325",
                    country: "India"
                },
                order_id: "REV" + (forwardOrder.orderId || forwardOrder._id),
                total_value: Math.round(forwardOrder.totalPrice),
                item_details: forwardOrder.orderItems.map(item => ({
                    name: item.name,
                    quantity: item.qty,
                    value: item.price,
                    weight: 0.5,
                    length: 10,
                    width: 10,
                    height: 10
                }))
            }]
        };

        return await createVamashipForwardOrder(payload);
    } catch (error) {
        console.error(`[VAMASHIP] Reverse Error:`, error.message);
        throw error;
    }
};

export default vamashipClient;
