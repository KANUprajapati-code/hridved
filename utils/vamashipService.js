import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const VAMASHIP_BASE_URL = (process.env.VAMASHIP_BASE_URL || 'https://api.vamaship.com/ecom/v1').replace(/\/+$/, '');
const VAMASHIP_API_TOKEN = process.env.VAMASHIP_API_TOKEN || '';

const vamashipClient = axios.create({
    baseURL: VAMASHIP_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
        'Access-Token': VAMASHIP_API_TOKEN,
    },
});

// Interceptor to log full URLs for debugging
vamashipClient.interceptors.request.use((config) => {
    const fullUrl = `${config.baseURL}${config.url}`;
    console.log(`Vamaship Request: [${config.method.toUpperCase()}] ${fullUrl}`);
    return config;
});

const formatAxiosError = (error) => ({
    message: error.message,
    status: error.response?.status,
    data: error.response?.data,
});

/**
 * Check Pincode Coverage / Serviceability
 * @param {string} pincode - Destination pincode
 * @param {string} originPincode - Pickup pincode (defaults to seller's pincode)
 * @param {string} type - 'prepaid' or 'cod'
 */
export const checkVamashipServiceability = async (pincode, originPincode = '380001', type = 'prepaid') => {
    try {
        const response = await vamashipClient.get('/pincode_coverage', {
            params: {
                pincode,
                origin_pincode: originPincode,
                type: type.toLowerCase()
            }
        });
        return response.data;
    } catch (error) {
        const err = formatAxiosError(error);
        console.error('Vamaship serviceability error:', err);
        throw err;
    }
};

/**
 * Create / Book Shipment
 * @param {Object} order - Order object from database
 */
export const createVamashipOrder = async (order) => {
    if (!order) throw new Error('Order object is required');

    const payload = {
        seller: {
            name: "Hridved Authentic Remedies",
            phone: "9999999999", // Should come from config/env
            email: "contact@hridved.in",
            address: "Pickup Address Line 1",
            city: "Ahmedabad",
            state: "Gujarat",
            country: "India",
            pincode: "380001"
        },
        shipments: [
            {
                order_id: order._id?.toString() || String(order._id),
                consignee: {
                    name: order.shippingAddress.fullName,
                    phone: order.shippingAddress.mobileNumber,
                    email: order.user?.email || "",
                    address: `${order.shippingAddress.houseNumber} ${order.shippingAddress.landmark || ''}`.trim(),
                    city: order.shippingAddress.city,
                    state: order.shippingAddress.state,
                    country: "India",
                    pincode: order.shippingAddress.pincode
                },
                shipment_details: {
                    payment_mode: order.paymentMethod === 'COD' ? 'cod' : 'prepaid',
                    cod_amount: order.paymentMethod === 'COD' ? order.totalPrice : 0,
                    total_value: order.totalPrice,
                    weight: 0.5, // Default weight
                    length: 10,
                    width: 10,
                    height: 10,
                    contents: order.orderItems.map(item => item.name).join(', ')
                }
            }
        ]
    };

    try {
        const response = await vamashipClient.post('/book_shipment', payload);
        return response.data;
    } catch (error) {
        const err = formatAxiosError(error);
        console.error('Vamaship create shipment error:', err);
        throw err;
    }
};

/**
 * Track Shipment
 * @param {string} trackingId - AWB or Order ID
 */
export const trackVamashipShipment = async (trackingId) => {
    try {
        const response = await vamashipClient.get('/tracking', {
            params: {
                track_id: trackingId
            }
        });
        return response.data;
    } catch (error) {
        const err = formatAxiosError(error);
        console.error('Vamaship tracking error:', err);
        throw err;
    }
};

export default vamashipClient;
