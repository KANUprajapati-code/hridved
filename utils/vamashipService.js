import axios from 'axios';
import dotenv from 'dotenv';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const VAMASHIP_BASE_URL = (process.env.VAMASHIP_BASE_URL || 'https://api.vamaship.com/ecom/v1').replace(/\/+$/, '');
const VAMASHIP_TOKEN = process.env.VAMASHIP_TOKEN;

console.log(`[VAMASHIP] Service Configured. BaseURL: ${VAMASHIP_BASE_URL}`);

export const vamashipClient = axios.create({
  baseURL: VAMASHIP_BASE_URL,
  timeout: 25000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${VAMASHIP_TOKEN}`
  },
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

const formatVamashipError = (error) => ({
  message: error.message,
  status: error.response?.status,
  data: error.response?.data,
  config: { url: error.config?.url, method: error.config?.method }
});

// -----------------------------------------------
// GET SHIPPING RATES (Quote)
// Endpoint: POST /surface/quote
// -----------------------------------------------
export const getVamashipRates = async (rateData) => {
  // Build the correct payload structure per the official docs
  const payload = {
    seller: {
      name: process.env.SELLER_NAME || 'Hridved Ayurveda',
      phone: process.env.SELLER_PHONE || '9876543210',
      email: process.env.SELLER_EMAIL || 'hridved@gmail.com',
      address: process.env.SELLER_ADDRESS || 'Plot No. 123, Modasa Road',
      city: process.env.SELLER_CITY || 'Dhansura',
      state: process.env.SELLER_STATE || 'Gujarat',
      country: 'India',
      pincode: process.env.VAMASHIP_PICKUP_PINCODE || '383325',
      get_all_quotes: true
    },
    shipments: [{
      address: rateData.buyerAddress || 'Customer Address',
      name: 'Customer',
      phone: '9999999999',
      city: rateData.buyerCity || 'Mumbai',
      state: rateData.buyerState || 'Maharashtra',
      country: 'India',
      pincode: String(rateData.destination || rateData.pincode),
      email: 'customer@hridved.com',
      weight: String(rateData.weight || 0.5),
      length: String(rateData.length || 10),
      breadth: String(rateData.breadth || rateData.width || 10),
      height: String(rateData.height || 10),
      unit: 'cm',
      product: 'Ayurvedic Products',
      product_value: rateData.value || 500,
      quantity: 1,
      is_cod: false,
      surface_category: 'b2c'
    }]
  };

  try {
    console.log(`[VAMASHIP] Fetching rates via /surface/quote`);
    const { data } = await vamashipClient.post('/surface/quote', payload);
    console.log(`[VAMASHIP] Rates response status_code: ${data?.status_code}`);
    return data;
  } catch (error) {
    console.warn(`[VAMASHIP] Rate fetch failed: ${error.response?.status || error.message}`);
    if (error.response?.data) {
      console.warn(`[VAMASHIP RATE ERROR DATA]:`, JSON.stringify(error.response.data));
    }
    throw formatVamashipError(error);
  }
};

// -----------------------------------------------
// CREATE SHIPMENT BOOKING
// Endpoint: POST /surface/book
// -----------------------------------------------
export const createVamashipForwardOrder = async (shipmentData) => {
  try {
    console.log(`[VAMASHIP] Booking shipment via /surface/book`);
    const response = await vamashipClient.post('/surface/book', shipmentData);
    console.log(`[VAMASHIP] Booking response status_code: ${response.data?.status_code}`);
    return response.data;
  } catch (error) {
    console.warn(`[VAMASHIP] Booking failed: ${error.response?.status || error.message}`);
    if (error.response?.data) {
      console.warn(`[VAMASHIP BOOK ERROR DATA]:`, JSON.stringify(error.response.data));
    }
    throw formatVamashipError(error);
  }
};

// -----------------------------------------------
// TRACK SHIPMENT
// Endpoint: GET /track/{order_ids}
// -----------------------------------------------
export const trackVamashipShipment = async (awb) => {
  try {
    // Try tracking by AWB first, then by order_id
    const response = await vamashipClient.get(`/track/${encodeURIComponent(awb)}`);
    return response.data;
  } catch (error) {
    throw formatVamashipError(error);
  }
};

// -----------------------------------------------
// CANCEL SHIPMENT
// -----------------------------------------------
export const cancelVamashipShipment = async (awb) => {
  try {
    const response = await vamashipClient.post('/shipments/cancel', { awb });
    return response.data;
  } catch (error) {
    throw formatVamashipError(error);
  }
};

// -----------------------------------------------
// GET ORDER DETAILS (for Polling AWB)
// Endpoint: GET /surface/details/{id} or /details/{id}
// -----------------------------------------------
export const getVamashipOrderDetails = async (id) => {
  try {
    console.log(`[VAMASHIP] Fetching details for ID: ${id}`);
    // Try surface details first
    try {
      const response = await vamashipClient.get(`/surface/details/${encodeURIComponent(id)}`);
      return response.data;
    } catch (e) {
      // Fallback to generic details
      const response = await vamashipClient.get(`/details/${encodeURIComponent(id)}`);
      return response.data;
    }
  } catch (error) {
    throw formatVamashipError(error);
  }
};

// -----------------------------------------------
// PROCESS FULL SHIPMENT BOOKING for an Order
// -----------------------------------------------
export const processVamashipShipment = async (orderId) => {
  try {
    const Order = (await import('../models/Order.js')).default;
    const order = await Order.findById(orderId).populate('user', 'email name');

    if (!order) throw new Error('Order not found');
    if (order.waybill) return { success: true, waybill: order.waybill };

    console.log(`[VAMASHIP] Processing shipment for Order: ${order.orderId || order._id}`);

    // Build payload using official Vamaship Surface API structure
    const payload = {
      seller: {
        name: process.env.SELLER_NAME || 'Hridved Ayurveda',
        phone: process.env.SELLER_PHONE || '9876543210',
        email: process.env.SELLER_EMAIL || 'hridved@gmail.com',
        address: process.env.SELLER_ADDRESS || 'Plot No. 123, Modasa Road',
        city: process.env.SELLER_CITY || 'Dhansura',
        state: process.env.SELLER_STATE || 'Gujarat',
        country: 'India',
        pincode: process.env.VAMASHIP_PICKUP_PINCODE || '383325'
      },
      shipments: order.orderItems.map(item => ({
        // Consignee details (flat structure per Vamaship API spec)
        name: order.shippingAddress.fullName,
        phone: order.shippingAddress.mobileNumber,
        email: order.user?.email || 'customer@hridved.com',
        address: order.shippingAddress.houseNumber,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state || '',
        country: 'India',
        pincode: String(order.shippingAddress.pincode),

        // Shipment details
        is_cod: order.paymentMethod === 'COD',
        cod_value: order.paymentMethod === 'COD' ? Math.round(order.totalPrice) : 0,
        product: item.name,
        product_value: Math.round(item.price * item.qty),
        quantity: item.qty,
        weight: String(item.weight || 0.5),
        length: '10',
        breadth: '10',
        height: '10',
        unit: 'cm',
        surface_category: 'b2c',
        reference1: order.orderId || order._id.toString(),

        // Line items
        line_items: [{
          product_name: item.name,
          quantity: item.qty,
          weight: item.weight || 0.5,
          weight_unit: 'kg',
          price: item.price
        }]
      }))
    };

    const result = await createVamashipForwardOrder(payload);
    console.log(`[VAMASHIP] API Result:`, JSON.stringify(result));

    // Check for success (status_code 200 or 300 for pending)
    if (result && (result.status_code === 200 || result.success === true)) {
      if (result.shipments && result.shipments.length > 0) {
        const shipData = result.shipments[0];
        order.waybill = shipData.awb || order.waybill;
        order.apiOrderId = String(shipData.order_id || '');
        
        if (order.waybill) {
          order.shippingStatus = 'Shipped';
        } else {
          order.shippingStatus = 'Shipping Pending';
          // If no AWB but we have order_id, we'll poll for it
        }
        
        order.shippingProvider = 'Vamaship';
        await order.save();
        return { success: true, waybill: order.waybill, refid: order.apiOrderId };
      } else if (result.refid) {
        // Processing asynchronously, save refid for polling
        order.apiOrderId = String(result.refid);
        order.shippingStatus = 'Shipping Pending';
        order.shippingProvider = 'Vamaship';
        await order.save();
        return { success: true, refid: result.refid, waybill: null };
      }
    }

    // Even if it failed to return an AWB immediately, we mark as pending if we got some ID
    if (result && result.details?.refid) {
        order.apiOrderId = String(result.details.refid);
        order.shippingStatus = 'Shipping Pending';
        await order.save();
        return { success: true, refid: order.apiOrderId, waybill: null };
    }

    return { success: false, details: result };
  } catch (error) {
    console.error('[VAMASHIP] Shipment Processing Error:', error.message || error);
    throw error;
  }
};

// -----------------------------------------------
// PROCESS REVERSE SHIPMENT
// -----------------------------------------------
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
        country: 'India',
        pincode: process.env.VAMASHIP_PICKUP_PINCODE || '383325'
      },
      shipments: [{
        name: forwardOrder.shippingAddress.fullName,
        phone: forwardOrder.shippingAddress.mobileNumber,
        email: forwardOrder.user?.email || 'customer@hridved.com',
        address: forwardOrder.shippingAddress.houseNumber,
        city: forwardOrder.shippingAddress.city,
        state: forwardOrder.shippingAddress.state || '',
        country: 'India',
        pincode: String(forwardOrder.shippingAddress.pincode),
        is_cod: false,
        product: 'Return - Ayurvedic Products',
        product_value: Math.round(forwardOrder.totalPrice),
        quantity: 1,
        weight: '0.5',
        length: '10',
        breadth: '10',
        height: '10',
        unit: 'cm',
        surface_category: 'b2c',
        reference1: `REV${forwardOrder.orderId || forwardOrder._id}`
      }]
    };

    return await createVamashipForwardOrder(payload);
  } catch (error) {
    console.error('[VAMASHIP] Reverse Shipment Error:', error.message || error);
    throw error;
  }
};

export default vamashipClient;
