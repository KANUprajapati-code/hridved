import axios from 'axios';
import dotenv from 'dotenv';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const VAMASHIP_BASE_URL = (process.env.VAMASHIP_BASE_URL || 'https://ecom.vamaship.com/ecom/api/v1').replace(/\/+$/, '');
const VAMASHIP_TOKEN = process.env.VAMASHIP_TOKEN;

console.log(`[VAMASHIP] Service Configured. BaseURL: ${VAMASHIP_BASE_URL}`);

export const vamashipClient = axios.create({
  baseURL: VAMASHIP_BASE_URL,
  timeout: 60000,
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
// Endpoints: 
// GET /track/:order_ids (for Vamaship Order IDs)
// GET /trackawb/:trackIds (for AWB Numbers)
// -----------------------------------------------
export const trackVamashipShipment = async (trackId) => {
  try {
    // Basic logic to guess if it's an AWB or Order ID
    // AWBs are usually longer or contain specific prefixes, but we can just try /trackawb first
    // as it's the most common for 'tracking' links
    console.log(`[VAMASHIP] Tracking ID: ${trackId}`);
    
    try {
      // Try AWB tracking first (most common for surface)
      const respAwb = await vamashipClient.get(`/trackawb/${encodeURIComponent(trackId)}`);
      if (respAwb.data && respAwb.data.status === 'success' && respAwb.data.data) {
        return respAwb.data;
      }
    } catch (awbErr) {
      console.log(`[VAMASHIP] AWB tracking failed for ${trackId}, trying Order ID tracking...`);
    }

    // Fallback to Order ID tracking
    const respOrder = await vamashipClient.get(`/track/${encodeURIComponent(trackId)}`);
    return respOrder.data;
  } catch (error) {
    console.error(`[VAMASHIP] Tracking failed for ${trackId}:`, error.message);
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
    // We send ONE shipment with multiple line items, not multiple shipments
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
        // COD value must be the full amount to collect
        cod_value: order.paymentMethod === 'COD' ? Math.round(order.totalPrice) : 0,
        
        // Vamaship requires product_value >= cod_value
        // We set product_value to the total order price to include shipping/taxes in the declared value
        product: order.orderItems.map(i => i.name).join(', ').substring(0, 100),
        product_value: Math.max(Math.round(order.totalPrice), Math.round(order.itemsPrice)),
        
        quantity: order.orderItems.reduce((acc, item) => acc + item.qty, 0),
        weight: String(order.orderItems.reduce((acc, item) => acc + (item.weight || 0.5) * item.qty, 0)),
        length: '10',
        breadth: '10',
        height: '10',
        unit: 'cm',
        surface_category: 'b2c',
        reference1: order.orderId || order._id.toString(),

        // Map all order items to line_items inside this single shipment
        // Important: Add shipping and taxes as line items if it's a COD order 
        // to ensure product_value matches the cod_value
        line_items: [
          ...order.orderItems.map(item => ({
            product_name: item.name,
            quantity: item.qty,
            weight: item.weight || 0.1,
            weight_unit: 'kg',
            price: Math.round(item.price)
          })),
          ...(order.shippingPrice > 0 ? [{
            product_name: 'Shipping Charges',
            quantity: 1,
            weight: 0,
            weight_unit: 'kg',
            price: Math.round(order.shippingPrice)
          }] : []),
          ...(order.taxPrice > 0 ? [{
            product_name: 'Tax/GST',
            quantity: 1,
            weight: 0,
            weight_unit: 'kg',
            price: Math.round(order.taxPrice)
          }] : [])
        ]
      }]
    };

    // Fetch rates to automatically select the cheapest supplier (excluding Amazon if possible)
    let cheapestSupplierId = null;
    try {
      const ratePayload = {
        destination: order.shippingAddress.pincode,
        weight: payload.shipments[0].weight,
        value: payload.shipments[0].product_value,
        buyerCity: order.shippingAddress.city,
        buyerState: order.shippingAddress.state
      };
      const rates = await getVamashipRates(ratePayload);
      if (rates && rates.success && rates.quotes && rates.quotes.length > 0) {
        const suppliers = rates.quotes[0].suppliers || [];
        // Filter out Amazon as requested by user ("amazon ko nhi")
        const validSuppliers = suppliers.filter(s => !s.supplier.toLowerCase().includes('amazon'));
        const sourceSuppliers = validSuppliers.length > 0 ? validSuppliers : suppliers;

        if (sourceSuppliers.length > 0) {
          const cheapest = sourceSuppliers.reduce((prev, curr) => 
            (Number(prev.shipping_cost || prev.charge || 9999) < Number(curr.shipping_cost || curr.charge || 9999)) ? prev : curr
          );
          cheapestSupplierId = cheapest.supplier_id;
          console.log(`[VAMASHIP] Automatically selected cheapest supplier: ${cheapest.supplier} (ID: ${cheapest.supplier_id}) at cost: ${cheapest.shipping_cost || cheapest.charge}`);
        }
      }
    } catch (rateErr) {
      console.warn('[VAMASHIP] Could not fetch rates for auto-selection, proceeding with default...', rateErr.message);
    }

    if (cheapestSupplierId) {
      payload.shipments[0].supplier_id = cheapestSupplierId;
    }

    console.log(`[VAMASHIP] PAYLOAD:`, JSON.stringify(payload, null, 2));
    const result = await createVamashipForwardOrder(payload);
    console.log(`[VAMASHIP] FULL API RESPONSE:`, JSON.stringify(result, null, 2));

    // Check for success (status_code 200 or 300 for pending)
    // Surface API often returns success inside a 'quotes' or 'shipments' array
    const isSuccess = result && (result.success === true || result.status_code === 200);
    
    if (isSuccess) {
      const shipData = (result.shipments && result.shipments[0]) || (result.quotes && result.quotes[0]);
      
      if (shipData && shipData.success !== false) {
        order.waybill = shipData.awb || shipData.waybill || order.waybill;
        order.apiOrderId = String(shipData.order_id || shipData.id || shipData.refid || result.id || '');
        
        if (order.waybill) {
          order.shippingStatus = 'Shipped';
        } else {
          order.shippingStatus = 'Shipping Pending';
        }
        
        order.shippingProvider = 'Vamaship';
        await order.save();
        console.log(`[VAMASHIP] Saved AWB: ${order.waybill}, RefID: ${order.apiOrderId}`);
        return { success: true, waybill: order.waybill, refid: order.apiOrderId };
      }
    }

    // Fail case with details
    const failedMsg = result?.quotes?.[0]?.messages?.[0] || result?.message || 'Shipment booking failed';
    console.warn(`[VAMASHIP] Booking failed with: ${failedMsg}`);

    // Final fallback: check for any identifying fields in the top level of the response
    if (result && !order.apiOrderId) {
        order.apiOrderId = String(result.id || result.order_id || result.shipment_id || result.refid || '');
        if (order.apiOrderId && order.apiOrderId !== 'undefined') {
            order.shippingStatus = 'Shipping Pending';
            order.shippingProvider = 'Vamaship';
            await order.save();
            console.log(`[VAMASHIP] Saved fallback ID: ${order.apiOrderId}`);
            return { success: true, refid: order.apiOrderId, waybill: null };
        }
    }

    return { success: false, details: result, message: failedMsg };
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
