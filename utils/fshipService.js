import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const FSHIP_BASE_URL = (process.env.FSHIP_BASE_URL || 'https://api.fship.in/v1').replace(/\/+$/, '');
const FSHIP_API_KEY = process.env.FSHIP_API_KEY || '';

const fshipClient = axios.create({
    baseURL: FSHIP_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
        ...(FSHIP_API_KEY ? { 'signature': FSHIP_API_KEY } : {}),
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

export const createFshipOrder = async (order) => {
    if (!order) throw new Error('Order object is required');
    if (order.shipmentId) return { message: 'Shipment already exists', already: true };

    const payload = {
        order_id: order._id?.toString?.() || String(order._id),
        consignee_name: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
        consignee_phone: order.shippingAddress.phone,
        consignee_address: order.shippingAddress.address,
        consignee_city: order.shippingAddress.city,
        consignee_state: order.shippingAddress.state,
        consignee_pincode: order.shippingAddress.postalCode,
        payment_mode: order.paymentMethod === 'COD' ? 'COD' : 'Prepaid',
        cod_amount: order.paymentMethod === 'COD' ? order.totalPrice : 0,
        products: order.orderItems.map((item) => ({
            name: item.name,
            qty: item.qty,
            price: item.price,
            sku: item.product ? item.product.toString() : (item._id?.toString?.() || ''),
        })),
        weight: 0.5,
    };

    try {
        const response = await fshipClient.post('/orders/create', payload);
        return response.data;
    } catch (error) {
        const err = formatAxiosError(error);
        console.error('Fship create order error:', err);
        throw err;
    }
};

export const checkFshipServiceability = async (pincode, weight = 0.5, cod = 0) => {
    try {
        const response = await fshipClient.post('/courier/serviceability', { pincode, weight, cod });
        return response.data;
    } catch (error) {
        const err = formatAxiosError(error);
        console.error('Fship serviceability error:', err);
        if (error.response?.data) {
            console.error('Fship serviceability error data:', JSON.stringify(error.response.data, null, 2));
        }
        throw err;
    }
};

export const trackFshipShipment = async (trackingIds) => {
    try {
        // trackingIds can be a single ID or comma-separated
        const response = await fshipClient.post('/orders/tracking', { awb_number: trackingIds });
        return response.data;
    } catch (error) {
        const err = formatAxiosError(error);
        console.error('Fship tracking error:', err);
        throw err;
    }
};

export default fshipClient;
