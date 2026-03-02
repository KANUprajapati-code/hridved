import axios from 'axios';
import dotenv from 'dotenv';
import https from 'https';
dotenv.config();

/* ======================================================
   FSHIP CONFIGURATION (Staging/Production)
====================================================== */
const DEFAULT_BASE = 'https://capi-qc.fship.in'; // Staging default

const FSHIP_BASE_URL = (
    process.env.FSHIP_BASE_URL || DEFAULT_BASE
).replace(/\/+$/, '');

// Signature key from environment variables
const FSHIP_KEY = (process.env.FSHIP_SIGNATURE || '').trim();

const FSHIP_PICKUP_ID = Number(process.env.FSHIP_PICKUP_ID || 0);

// Fship requires header name exactly: signature
const FSHIP_AUTH_HEADER = 'signature';

// Authentication prefix: default to 'bearer ' if likely for production CAPI
const FSHIP_AUTH_PREFIX = (
    process.env.FSHIP_AUTH_PREFIX !== undefined
        ? process.env.FSHIP_AUTH_PREFIX
        : (FSHIP_BASE_URL.includes('fship.in') && !FSHIP_BASE_URL.includes('-qc') ? 'bearer ' : '')
);

if (!FSHIP_KEY) {
    console.warn(
        '[FSHIP] WARNING: FSHIP_SIGNATURE is not set in .env. Requests will fail with 401.'
    );
}

/* ======================================================
   AXIOS CLIENT
====================================================== */
const fshipClient = axios.create({
    baseURL: FSHIP_BASE_URL,
    timeout: 20000,
    headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 Hridved-Backend/1.0',
    }
});

/* ======================================================
   REQUEST INTERCEPTOR
====================================================== */

console.log("FSHIP KEY EXISTS:", !!FSHIP_KEY);
console.log("FSHIP KEY LENGTH:", FSHIP_KEY.length);

fshipClient.interceptors.request.use((config) => {
    config.headers['Content-Type'] = 'application/json';

    // Only set default signature if not already manually set (e.g. during retries)
    if (FSHIP_KEY && !config.headers[FSHIP_AUTH_HEADER] && !config.headers['Authorization'] && !config.headers['authorization']) {
        config.headers[FSHIP_AUTH_HEADER] = `${FSHIP_AUTH_PREFIX || ''}${FSHIP_KEY} `;
    }

    const actualHeaderValue = config.headers[FSHIP_AUTH_HEADER] || config.headers['Authorization'] || config.headers['authorization'] || 'NONE';
    const isBearer = String(actualHeaderValue).toLowerCase().startsWith('bearer');

    console.log(`\n[FSHIP REQUEST] ${config.method?.toUpperCase()} ${config.baseURL}${config.url} `);
    console.log(`[FSHIP HEADER] signature length: ${FSHIP_KEY.length}, isBearer: ${isBearer} `);

    if (config.data) {
        // Obfuscate sensitive body data if needed, but for debugging we show it
        console.log('[FSHIP BODY]', typeof config.data === 'string' ? config.data : JSON.stringify(config.data, null, 2));
    }

    return config;
});

/* ======================================================
   RESPONSE INTERCEPTOR: Retry once with alternate prefixes
   when we receive 401 Unauthorized to probe accepted format
====================================================== */
fshipClient.interceptors.response.use(null, async (error) => {
    const status = error.response?.status;
    const cfg = error.config;

    if (status === 401 && cfg && !cfg.__fship_retried) {
        // Log response body and headers for debugging
        try {
            console.log('[FSHIP 401 BODY]', JSON.stringify(error.response?.data || {}));
            console.log('[FSHIP 401 HEADERS]', JSON.stringify(error.response?.headers || {}));
        } catch (e) {
            /* ignore logging errors */
        }

        // REDUCED: Focus on high-probability production candidates ONLY
        const prefixes = ['bearer ', 'Bearer ', ''];
        const headerCandidates = ['signature', 'Authorization'];
        const tried = new Set();
        const alternateBases = [FSHIP_BASE_URL, 'https://capi.fship.in'];
        const pathCandidates = ['/api/v1/order', '/api/createforwardorder'];

        for (const baseUrl of alternateBases) {
            for (const path of pathCandidates) {
                for (const headerName of headerCandidates) {
                    for (const p of prefixes) {
                        const key = `${baseUrl}::${path}::${headerName}::${p} `;
                        if (tried.has(key)) continue;
                        tried.add(key);
                        try {
                            const retryConfig = { ...cfg, __fship_retried: true };
                            retryConfig.baseURL = baseUrl;
                            retryConfig.headers = { ...retryConfig.headers };

                            // IMPORTANT: axios data in interceptor is already transformed (e.g. to JSON string).
                            // We must NOT let axios re-transform it, so we use a new axios instance or handle it carefully.
                            // Instead of full retryConfig, we manually rebuild what's needed for a clean request.

                            const cleanHeaders = {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'User-Agent': 'Mozilla/5.0 Hridved-Backend/1.0',
                                [headerName]: `${p}${FSHIP_KEY} `
                            };

                            const rawUrl = `${baseUrl}${path} `;
                            console.log(`[FSHIP RETRY] Trying URL = '${rawUrl}' header = '${headerName}' prefix = '${p}'`);

                            // Use a fresh axios call to avoid interceptor recursion or double-transform
                            // If cfg.data is already stringified, we pass it as is.
                            const finalData = typeof cfg.data === 'string' ? cfg.data : JSON.stringify(cfg.data);

                            const resp = await axios({
                                method: cfg.method,
                                url: rawUrl,
                                data: finalData,
                                headers: cleanHeaders,
                                timeout: 3000, // Reduced to avoid global timeout
                                httpsAgent: new https.Agent({ rejectUnauthorized: false })
                            });

                            console.log(`[FSHIP RETRY] Success with header = '${headerName}' prefix = '${p}'`);
                            return resp;
                        } catch (err) {
                            console.log(`[FSHIP RETRY]FAILED: ${headerName} with prefix '${p}' -> ${err.response?.status || err.message} `);
                        }
                    }
                }
            }
        }
    }

    return Promise.reject(error);
});

console.log("========== FSHIP DEBUG ==========");
console.log("BASE URL:", FSHIP_BASE_URL);
console.log("SIGNATURE EXISTS:", !!FSHIP_KEY);
console.log("SIGNATURE LENGTH:", FSHIP_KEY?.length);
console.log("=================================");

/* ======================================================
   ERROR FORMATTER
====================================================== */
const formatAxiosError = (error) => {
    return {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
    };
};

/* ======================================================
   1. CREATE FORWARD ORDER
====================================================== */
export const createFshipForwardOrder = async (orderData) => {
    try {
        const response = await fshipClient.post(
            '/api/createforwardorder',
            orderData
        );
        return response.data;
    } catch (error) {
        throw formatAxiosError(error);
    }
};

/* ======================================================
   2. SHIPMENT SUMMARY
====================================================== */
export const getFshipShipmentSummary = async (waybill) => {
    try {
        const response = await fshipClient.post(
            '/api/shipmentsummary',
            { waybill }
        );
        return response.data;
    } catch (error) {
        throw formatAxiosError(error);
    }
};

/* ======================================================
   3. TRACKING HISTORY
====================================================== */
export const getFshipTrackingHistory = async (waybill) => {
    try {
        const response = await fshipClient.post(
            '/api/trackinghistory',
            { waybill }
        );
        return response.data;
    } catch (error) {
        throw formatAxiosError(error);
    }
};

/* ======================================================
   4. REGISTER PICKUP
====================================================== */
export const registerFshipPickup = async (waybills) => {
    try {
        const response = await fshipClient.post(
            '/api/registerpickup',
            { waybills }
        );
        return response.data;
    } catch (error) {
        throw formatAxiosError(error);
    }
};

/* ======================================================
   5. SHIPPING LABEL BY PICKUP ID
====================================================== */
export const getFshipShippingLabelByPickupId = async (pickupOrderId) => {
    try {
        const response = await fshipClient.post(
            '/api/shippinglabelbypickupid',
            { pickupOrderId }
        );
        return response.data;
    } catch (error) {
        throw formatAxiosError(error);
    }
};

/* ======================================================
   6. CREATE REVERSE ORDER
====================================================== */
export const createFshipReverseOrder = async (reverseOrderData) => {
    try {
        const response = await fshipClient.post(
            '/api/createreverseorder',
            reverseOrderData
        );
        return response.data;
    } catch (error) {
        throw formatAxiosError(error);
    }
};

/* ======================================================
   7. CHECK PINCODE SERVICEABILITY (FIXED ENDPOINT)
====================================================== */
export const checkFshipServiceability = async (
    sourcePincode,
    destinationPincode
) => {
    try {
        const payload = {
            source_Pincode: sourcePincode,
            destination_Pincode: destinationPincode,
        };

        const response = await fshipClient.post(
            '/api/pincodeserviceability',
            payload
        );

        return response.data;
    } catch (error) {
        throw formatAxiosError(error);
    }
};

/* ======================================================
   CENTRAL SHIPMENT PROCESSOR
====================================================== */
export const processFshipShipment = async (orderId) => {
    try {
        const Order = (await import('../models/Order.js')).default;
        const order = await Order.findById(orderId).populate(
            'user',
            'email name'
        );

        if (!order) throw new Error('Order not found');

        if (order.waybill) {
            return { success: true, waybill: order.waybill };
        }

        const payload = {
            customer_Name: order.shippingAddress.fullName,
            customer_Mobile: order.shippingAddress.mobileNumber,
            customer_Emailid: order.user?.email || 'customer@example.com',
            customer_Address: order.shippingAddress.houseNumber,
            landMark: order.shippingAddress.landmark || '',
            customer_Address_Type:
                order.shippingAddress.addressType || 'Home',
            customer_PinCode: order.shippingAddress.pincode,
            customer_City: order.shippingAddress.city,

            // Use Mongo ID as external order ID (SAFE)
            orderId: order._id.toString(),
            invoice_Number: order._id.toString(),

            payment_Mode: order.paymentMethod === 'COD' ? 1 : 2,
            express_Type:
                order.deliveryOption === 'Express'
                    ? 'air'
                    : 'surface',

            order_Amount: Math.round(order.totalPrice),
            total_Amount: Math.round(order.totalPrice),

            cod_Amount:
                order.paymentMethod === 'COD'
                    ? Math.round(order.totalPrice)
                    : 0,

            shipment_Weight: 0.5,
            shipment_Length: 10,
            shipment_Width: 10,
            shipment_Height: 10,

            pick_Address_ID: FSHIP_PICKUP_ID,
            return_Address_ID: FSHIP_PICKUP_ID,

            products: order.orderItems.map((item) => ({
                productName: item.name,
                unitPrice: item.price,
                quantity: item.qty,
                sku: String(item.product),
            })),
        };

        const result = await createFshipForwardOrder(payload);

        if (result?.status === true) {
            order.waybill = result.waybill;
            order.apiOrderId = result.apiorderid;
            order.shippingStatus = 'Shipped';
            order.shippingProvider = 'Fship';
            await order.save();

            return { success: true, waybill: result.waybill };
        }

        return { success: false, details: result };
    } catch (error) {
        console.error('[FSHIP ERROR]', error);
        throw error;
    }
};


export default fshipClient;