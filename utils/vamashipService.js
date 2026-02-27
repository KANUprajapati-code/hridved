import axios from 'axios';
import dotenv from 'dotenv';
import https from 'https';
dotenv.config();

const VAMASHIP_BASE_URL = (process.env.VAMASHIP_BASE_URL || 'https://ecom3stagingapi.vamaship.com/ecom/api/v1').replace(/\/+$/, '');
const VAMASHIP_TOKEN = process.env.VAMASHIP_TOKEN || 'nsaGISQu2jnUy3cpxZk0VI4XdkOgUmDKwU426JtN3';

export const vamashipClient = axios.create({
  baseURL: VAMASHIP_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    'X-Vamaship-Token': VAMASHIP_TOKEN
  },
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

console.log(`[VAMASHIP] Client Configured. BaseURL: ${VAMASHIP_BASE_URL}`);

vamashipClient.interceptors.request.use((config) => {
  console.log(`[VAMASHIP] Request: ${String(config.method).toUpperCase()} ${config.baseURL}${config.url}`);
  return config;
});

const formatVamashipError = (error) => ({
  message: error.message,
  status: error.response?.status,
  data: error.response?.data,
  config: { url: error.config?.url, method: error.config?.method }
});

export const getVamashipRates = async (rateData) => {
  const candidates = ['/shipping-quote', '/shipping/quote', '/rates', '/quote', '/shipping/rates'];
  let lastErr;
  for (const path of candidates) {
    try {
      console.log(`[VAMASHIP] Trying rates endpoint: ${path}`);
      const response = await vamashipClient.post(path, rateData);
      return response.data;
    } catch (error) {
      lastErr = error;
      console.warn(`[VAMASHIP] Rates endpoint ${path} failed:`, error.response?.status || error.message);
      if (error.response?.data) console.debug('[VAMASHIP] Rates error data:', JSON.stringify(error.response.data));
    }
  }
  throw formatVamashipError(lastErr || new Error('No endpoint candidates tried'));
};

export const createVamashipForwardOrder = async (shipmentData) => {
  const candidates = ['/shipments/book', '/shipments', '/orders', '/shipments/create'];
  let lastErr;
  for (const path of candidates) {
    try {
      console.log(`[VAMASHIP] Trying create endpoint: ${path}`);
      const response = await vamashipClient.post(path, shipmentData);
      return response.data;
    } catch (error) {
      lastErr = error;
      console.warn(`[VAMASHIP] Create endpoint ${path} failed:`, error.response?.status || error.message);
      if (error.response?.data) console.debug('[VAMASHIP] Create error data:', JSON.stringify(error.response.data));
    }
  }
  throw formatVamashipError(lastErr || new Error('No create endpoint candidates tried'));
};

export const trackVamashipShipment = async (awb) => {
  try {
    const response = await vamashipClient.get(`/shipments/track?awb=${encodeURIComponent(awb)}`);
    return response.data;
  } catch (error) {
    throw formatVamashipError(error);
  }
};

export const cancelVamashipShipment = async (awb) => {
  try {
    const response = await vamashipClient.post('/shipments/cancel', { awb });
    return response.data;
  } catch (error) {
    throw formatVamashipError(error);
  }
};

export const processVamashipShipment = async (orderId) => {
  try {
    const Order = (await import('../models/Order.js')).default;
    const order = await Order.findById(orderId).populate('user', 'email name');

    if (!order) throw new Error('Order not found');
    if (order.waybill) return { success: true, waybill: order.waybill };

    const payload = {
      seller: {
        name: process.env.SELLER_NAME || 'Hridved Ayurveda',
        phone: process.env.SELLER_PHONE || '9876543210',
        email: process.env.SELLER_EMAIL || 'hridved@gmail.com',
        address: process.env.SELLER_ADDRESS || 'Plot No. 123, Modasa Road',
        city: process.env.SELLER_CITY || 'Dhansura',
        state: process.env.SELLER_STATE || 'Gujarat',
        pincode: process.env.VAMASHIP_PICKUP_PINCODE || '383325',
        country: 'India'
      },
      shipments: [{
        type: order.paymentMethod === 'COD' ? 'cod' : 'prepaid',
        subtype: 'general',
        consignee: {
          name: order.shippingAddress.fullName,
          phone: order.shippingAddress.mobileNumber,
          email: order.user?.email || 'customer@example.com',
          address: order.shippingAddress.houseNumber,
          city: order.shippingAddress.city,
          state: order.shippingAddress.state || '',
          pincode: order.shippingAddress.pincode,
          country: 'India'
        },
        order_id: order.orderId || order._id.toString(),
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

    if (result && (result.status === 'success' || result.success === true)) {
      const shipData = result.data?.shipments?.[0] || result.shipments?.[0] || result;
      const awb = shipData?.awb_number || shipData?.awb || shipData?.tracking_number;
      order.waybill = awb || order.waybill;
      order.apiOrderId = shipData?.vamaship_order_id || order.apiOrderId;
      order.shippingStatus = 'Shipped';
      order.shippingProvider = 'Vamaship';
      await order.save();
      return { success: true, waybill: order.waybill };
    }

    order.shippingStatus = 'Shipping Pending';
    await order.save();
    return { success: false, details: result };
  } catch (error) {
    console.error('[VAMASHIP] ERROR', error);
    throw error;
  }
};

export const processVamashipReverseShipment = async (forwardWaybill) => {
  try {
    const Order = (await import('../models/Order.js')).default;
    const forwardOrder = await Order.findOne({ waybill: forwardWaybill }).populate('user', 'email name');
    if (!forwardOrder) throw new Error('Forward order not found');

    const payload = {
      seller: {
        name: process.env.SELLER_NAME || 'Hridved Ayurveda',
        phone: process.env.SELLER_PHONE || '9876543210',
        email: process.env.SELLER_EMAIL || 'hridved@gmail.com',
        address: process.env.SELLER_ADDRESS || 'Plot No. 123, Modasa Road',
        city: process.env.SELLER_CITY || 'Dhansura',
        state: process.env.SELLER_STATE || 'Gujarat',
        pincode: process.env.VAMASHIP_PICKUP_PINCODE || '383325',
        country: 'India'
      },
      shipments: [{
        type: 'reverse',
        subtype: 'general',
        consignee: {
          name: forwardOrder.shippingAddress.fullName,
          phone: forwardOrder.shippingAddress.mobileNumber,
          email: forwardOrder.user?.email || 'customer@example.com',
          address: forwardOrder.shippingAddress.houseNumber,
          city: forwardOrder.shippingAddress.city,
          state: forwardOrder.shippingAddress.state || '',
          pincode: forwardOrder.shippingAddress.pincode,
          country: 'India'
        },
        order_id: `REV${forwardOrder.orderId || forwardOrder._id}`,
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
    console.error('[VAMASHIP] Reverse Error', error);
    throw error;
  }
};

export default vamashipClient;
