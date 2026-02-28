// import axios from 'axios';
// import dotenv from 'dotenv';
// dotenv.config();

// const DEFAULT_BASE = 'https://api.fship.in';
// const FSHIP_BASE_URL = (process.env.FSHIP_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
// const FSHIP_KEY = (process.env.FSHIP_SIGNATURE || process.env.FSHIP_API_KEY || '').trim();
// const FSHIP_PICKUP_ID = process.env.FSHIP_PICKUP_ID || '0';
// const FSHIP_AUTH_HEADER = process.env.FSHIP_AUTH_HEADER || 'signature';
// const FSHIP_AUTH_PREFIX = process.env.FSHIP_AUTH_PREFIX || ''; // e.g. 'Bearer '

// if (!FSHIP_KEY) {
//     console.warn('[SHIPMENT] WARNING: FSHIP API key/signature is not set (FSHIP_SIGNATURE or FSHIP_API_KEY). Requests will likely 401.');
// }

// const fshipClient = axios.create({
//     baseURL: FSHIP_BASE_URL,
//     timeout: 15000,
// });

// // Interceptor to handle headers and improved request logging
// fshipClient.interceptors.request.use((config) => {
//     const fullUrl = `${config.baseURL}${config.url}`;

//     // Use configured header name
//     config.headers['Content-Type'] = 'application/json';
//     if (FSHIP_KEY) {
//         const authValue = `${FSHIP_AUTH_PREFIX || ''}${FSHIP_KEY}`;
//         config.headers[FSHIP_AUTH_HEADER] = authValue;
//     }

//     const bodyPreview = config.data ? (typeof config.data === 'string' ? config.data : JSON.stringify(config.data)) : '';
//     console.log(`Fship Request: [${(config.method || 'POST').toUpperCase()}] ${fullUrl}`);
//     console.log(`Fship Auth: header '${FSHIP_AUTH_HEADER}' length=${FSHIP_KEY.length}`);
//     if (bodyPreview) console.log(`Fship Body Preview: ${bodyPreview.substring(0, 512)}`);

//     return config;
// });

// const formatAxiosError = (error) => {
//     return {
//         message: error.message,
//         status: error.response?.status,
//         data: error.response?.data,
//         config: {
//             url: error.config?.url,
//             method: error.config?.method,
//             data: error.config?.data
//         }
//     };
// };

// /**
//  * 1. Create Forward Order
//  * @param {Object} orderData 
//  */
// export const createFshipForwardOrder = async (orderData) => {
//     try {
//         const path = process.env.FSHIP_PATH_CREATE_FORWARD_ORDER || '/api/createforwardorder';
//         const response = await fshipClient.post(path, orderData);
//         return response.data;
//     } catch (error) {
//         throw formatAxiosError(error);
//     }
// };

// /**
//  * 2. Shipment Summary (Latest Status)
//  * @param {string} waybill 
//  */
// export const getFshipShipmentSummary = async (waybill) => {
//     try {
//         const path = process.env.FSHIP_PATH_SHIPMENT_SUMMARY || '/api/shipmentsummary';
//         const response = await fshipClient.post(path, { waybill });
//         return response.data;
//     } catch (error) {
//         throw formatAxiosError(error);
//     }
// };

// /**
//  * 3. Tracking History (Full Timeline)
//  * @param {string} waybill 
//  */
// export const getFshipTrackingHistory = async (waybill) => {
//     try {
//         const path = process.env.FSHIP_PATH_TRACKING_HISTORY || '/api/trackinghistory';
//         const response = await fshipClient.post(path, { waybill });
//         return response.data;
//     } catch (error) {
//         throw formatAxiosError(error);
//     }
// };

// /**
//  * 4. Register Pickup
//  * @param {Array<string>} waybills 
//  */
// export const registerFshipPickup = async (waybills) => {
//     try {
//         const path = process.env.FSHIP_PATH_REGISTER_PICKUP || '/api/registerpickup';
//         const response = await fshipClient.post(path, { waybills });
//         return response.data;
//     } catch (error) {
//         throw formatAxiosError(error);
//     }
// };

// /**
//  * 5. Shipping Label by Pickup ID
//  * @param {Array<number>} pickupOrderId 
//  */
// export const getFshipShippingLabelByPickupId = async (pickupOrderId) => {
//     try {
//         const path = process.env.FSHIP_PATH_SHIPPING_LABEL_BY_PICKUP_ID || '/api/shippinglabelbypickupid';
//         const response = await fshipClient.post(path, { pickupOrderId });
//         return response.data;
//     } catch (error) {
//         throw formatAxiosError(error);
//     }
// };

// /**
//  * 6. Create Reverse Order
//  * @param {Object} reverseOrderData 
//  */
// export const createFshipReverseOrder = async (reverseOrderData) => {
//     try {
//         const path = process.env.FSHIP_PATH_CREATE_REVERSE_ORDER || '/api/createreverseorder';
//         const response = await fshipClient.post(path, reverseOrderData);
//         return response.data;
//     } catch (error) {
//         throw formatAxiosError(error);
//     }
// };

// /**
//  * Legacy/Utility: Check Serviceability
//  */
// export const checkFshipServiceability = async (sourcePincode, destinationPincode) => {
//     try {
//         const path = process.env.FSHIP_PATH_SERVICEABILITY || '/v1/courier/serviceability';
//         // Many APIs use camelCase; include both variants if needed by server (harmless extra fields in most cases)
//         const payload = {
//             source_Pincode: sourcePincode,
//             destination_Pincode: destinationPincode,
//             sourcePincode: sourcePincode,
//             destinationPincode: destinationPincode
//         };
//         const response = await fshipClient.post(path, payload);
//         return response.data;
//     } catch (error) {
//         throw formatAxiosError(error);
//     }
// };


// /**
//  * Centralized Shipment Creation Helper
//  * Handles payload preparation, API call, and DB update
//  * @param {string} orderId - Database Order ID
//  */
// export const processFshipShipment = async (orderId) => {
//     try {
//         const Order = (await import('../models/Order.js')).default;
//         const order = await Order.findById(orderId).populate('user', 'email name');

//         if (!order) throw new Error('Order not found');
//         if (order.waybill) {
//             console.log(`[SHIPMENT] Already exists for Order: ${order._id}. Skipping.`);
//             return { success: true, waybill: order.waybill };
//         }

//         console.log(`[SHIPMENT] Initiating Fship order for: ${order._id}`);

//         const payload = {
//             customer_Name: order.shippingAddress.fullName,
//             customer_Mobile: order.shippingAddress.mobileNumber,
//             customer_Emailid: order.user?.email || 'customer@example.com',
//             customer_Address: order.shippingAddress.houseNumber,
//             landMark: order.shippingAddress.landmark || '',
//             customer_Address_Type: order.shippingAddress.addressType || 'Home',
//             customer_PinCode: order.shippingAddress.pincode,
//             customer_City: order.shippingAddress.city,
//             orderId: order.orderId || `ORD${Date.now()}`,
//             invoice_Number: order.orderId || `ORD${Date.now()}`,
//             payment_Mode: order.paymentMethod === 'COD' ? 1 : 2, // 1=COD, 2=PREPAID
//             express_Type: order.deliveryOption === 'Express' ? 'air' : 'surface',
//             order_Amount: Math.round(order.totalPrice),
//             total_Amount: Math.round(order.totalPrice),
//             cod_Amount: order.paymentMethod === 'COD' ? Math.round(order.totalPrice) : 0,
//             shipment_Weight: 0.5,
//             shipment_Length: 10,
//             shipment_Width: 10,
//             shipment_Height: 10,
//             pick_Address_ID: process.env.FSHIP_PICKUP_ID || FSHIP_PICKUP_ID,
//             return_Address_ID: process.env.FSHIP_PICKUP_ID || FSHIP_PICKUP_ID,
//             products: order.orderItems.map(item => ({
//                 productName: item.name,
//                 unitPrice: item.price,
//                 quantity: item.qty,
//                 sku: String(item.product)
//             }))
//         };

//         const result = await createFshipForwardOrder(payload);

//         if (result && result.status === true) {
//             order.waybill = result.waybill;
//             order.apiOrderId = result.apiorderid;
//             order.shippingStatus = 'Shipped';
//             order.shippingProvider = 'Fship';
//             await order.save();
//             console.log(`[SHIPMENT] SUCCESS. Waybill: ${result.waybill}`);
//             return { success: true, waybill: result.waybill };
//         }

//         console.error(`[SHIPMENT] Fship API Failure:`, result);
//         order.shippingStatus = 'Shipping Pending';
//         await order.save();
//         return { success: false, details: result };
//     } catch (error) {
//         console.error(`[SHIPMENT] CRITICAL ERROR matching order ${orderId}:`, error.message);
//         if (error.response?.headers) {
//             console.log('[SHIPMENT] Fship Response Headers:', JSON.stringify(error.response.headers, null, 2));
//         }
//         if (error.data) {
//             console.error(`[SHIPMENT] Fship API Response Data:`, JSON.stringify(error.data, null, 2));
//         }
//         throw error;
//     }
// };

// export default fshipClient;
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

/* ======================================================
   CORRECT FSHIP BASE URL (Document Based)
====================================================== */
const DEFAULT_BASE = 'https://capi-qc.fship.in'; // Staging default

const FSHIP_BASE_URL = (
    process.env.FSHIP_BASE_URL || DEFAULT_BASE
).replace(/\/+$/, '');

// NOTE: Temporarily hardcoded client key for quick testing/development.
// Replace with environment variable `FSHIP_SIGNATURE` in production.
const FSHIP_KEY = '569bf88e69255c15f74fcf99f580b55cecb9e725dde939e5e99ee7ad52771ecb';

const FSHIP_PICKUP_ID = Number(process.env.FSHIP_PICKUP_ID || 0);

// Fship requires header name exactly: signature
const FSHIP_AUTH_HEADER = 'signature';

// Authentication prefix: allow overriding via env. If not set, default to
// 'bearer ' for the production capi endpoint which often expects it.
const FSHIP_AUTH_PREFIX = (
    process.env.FSHIP_AUTH_PREFIX !== undefined
        ? process.env.FSHIP_AUTH_PREFIX
        : (FSHIP_BASE_URL.includes('capi.fship.in') ? 'bearer ' : '')
);

if (!FSHIP_KEY) {
    console.warn(
        '[FSHIP] WARNING: FSHIP_SIGNATURE is not set. Requests may fail with 401.'
    );
}

/* ======================================================
   AXIOS CLIENT
====================================================== */
const fshipClient = axios.create({
    baseURL: FSHIP_BASE_URL,
    timeout: 20000,
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
        config.headers[FSHIP_AUTH_HEADER] = `${FSHIP_AUTH_PREFIX || ''}${FSHIP_KEY}`;
    }

    const actualHeaderValue = config.headers[FSHIP_AUTH_HEADER] || config.headers['Authorization'] || config.headers['authorization'] || 'NONE';
    const isBearer = String(actualHeaderValue).toLowerCase().startsWith('bearer');

    console.log(`\n[FSHIP REQUEST] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    console.log(`[FSHIP HEADER] signature length: ${FSHIP_KEY.length}, isBearer: ${isBearer}`);

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

        // Try multiple header-name + prefix combinations to probe accepted auth format
        const prefixes = ['', 'bearer ', 'Bearer '];
        const headerCandidates = [
            FSHIP_AUTH_HEADER,
            'Signature',
            'Authorization',
            'authorization',
            'x-signature',
            'X-Signature',
            'Client-Key',
            'client-key',
            'x-api-key',
            'token'
        ];

        const tried = new Set();

        for (const headerName of headerCandidates) {
            for (const p of prefixes) {
                const key = `${headerName}::${p}`;
                if (tried.has(key)) continue;
                tried.add(key);
                try {
                    const retryConfig = { ...cfg, __fship_retried: true };
                    retryConfig.headers = { ...retryConfig.headers };
                    // remove any existing auth-like headers to avoid duplicates
                    delete retryConfig.headers[FSHIP_AUTH_HEADER];
                    delete retryConfig.headers['Authorization'];
                    delete retryConfig.headers['authorization'];
                    delete retryConfig.headers['x-signature'];
                    delete retryConfig.headers['x-api-key'];
                    delete retryConfig.headers['token'];

                    retryConfig.headers[headerName] = `${p}${FSHIP_KEY}`;
                    console.log(`[FSHIP RETRY] Trying header='${headerName}' prefix='${p}'`);
                    const resp = await fshipClient.request(retryConfig);
                    console.log(`[FSHIP RETRY] Success with header='${headerName}' prefix='${p}'`);
                    return resp;
                } catch (err) {
                    console.log(`[FSHIP RETRY] header='${headerName}' prefix='${p}' failed: ${err.response?.status || err.message}`);
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