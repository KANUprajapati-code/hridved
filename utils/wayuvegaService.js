import axios from 'axios';
import Order from '../models/Order.js';

const IAM_BASE_URL = process.env.WAYUVEGA_IAM_BASE_URL || 'https://iam.api.wayuvega.in';
const OMS_BASE_URL = process.env.WAYUVEGA_OMS_BASE_URL || 'https://oms.api.wayuvega.in';

let cachedToken = null;
let tokenExpiresAt = null;
let cachedMerchantId = null;

/**
 * 1. Authenticate with Wayuvega IAM and cache JWT token (valid for 1 hour)
 */
export const getWayuvegaAuthToken = async () => {
    const username = process.env.WAYUVEGA_USERNAME;
    const password = process.env.WAYUVEGA_PASSWORD;

    if (!username || !password) {
        console.warn('[WAYUVEGA] Credentials not configured in environment variables');
        return null;
    }

    // Return cached token if still valid (with 5-minute safety buffer)
    if (cachedToken && tokenExpiresAt && Date.now() < (tokenExpiresAt - 5 * 60 * 1000)) {
        return cachedToken;
    }

    try {
        console.log('[WAYUVEGA] Requesting new auth token from IAM...');
        const response = await axios.post(`${IAM_BASE_URL}/v1/iam/token/auth`, {
            username: username.trim(),
            password: password.trim(),
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000,
        });

        if (response.data && response.data.auth_token) {
            cachedToken = response.data.auth_token;
            // Token is valid for 1 hour
            tokenExpiresAt = Date.now() + 60 * 60 * 1000;

            // Extract merchantId claims from JWT if possible
            try {
                const parts = cachedToken.split('.');
                if (parts.length === 3) {
                    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                    while (payload.length % 4) { payload += '='; }
                    const claims = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
                    if (claims.merchantId) cachedMerchantId = claims.merchantId;
                    if (claims.exp) tokenExpiresAt = claims.exp * 1000;
                }
            } catch (jwtErr) {
                console.warn('[WAYUVEGA] Could not parse JWT claims:', jwtErr.message);
            }

            console.log('[WAYUVEGA] Auth token acquired successfully. Merchant ID:', cachedMerchantId || process.env.WAYUVEGA_MERCHANT_ID);
            return cachedToken;
        }

        console.warn('[WAYUVEGA] Authentication failed, response:', response.data);
        return null;
    } catch (error) {
        console.error('[WAYUVEGA] Authentication error:', error.response?.data || error.message);
        return null;
    }
};

/**
 * 2. Check Serviceability for a Pickup -> Drop Pincode pair
 * @param {string} pickupPincode 
 * @param {string} dropPincode 
 */
export const checkWayuvegaServiceability = async (pickupPincode = '380001', dropPincode) => {
    const cleanPickup = String(pickupPincode).replace(/\D/g, '').slice(0, 6);
    const cleanDrop = String(dropPincode).replace(/\D/g, '').slice(0, 6);

    const token = await getWayuvegaAuthToken();
    if (!token) {
        // Fallback simulation when credentials are not yet entered
        return {
            serviceable: true,
            simulated: true,
            zone: '3',
            couriers: [
                { name: 'DELHIVERY SURFACE', minDays: 2, maxDays: 4, cod: true, prepaid: true },
                { name: 'XPRESSBEES SURFACE', minDays: 3, maxDays: 5, cod: true, prepaid: true }
            ]
        };
    }

    try {
        const response = await axios.post(`${OMS_BASE_URL}/v3/oms/check-merchant-serviceability`, {
            pickup_pincode: cleanPickup,
            drop_pincode: cleanDrop,
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });

        const list = response.data?.merchant_domestic_serviceabilities || [];
        const isServiceable = list.length > 0;

        return {
            serviceable: isServiceable,
            zone: response.data?.zone_id || null,
            couriers: list.map(c => ({
                name: c.carrier_partner_identifier_string,
                accountCode: c.carrier_partner_account_code,
                minDays: c.min_tat_in_days,
                maxDays: c.max_tat_in_days,
                cod: !!c.cod_serviceability_details?.is_serviceable,
                prepaid: !!c.prepaid_serviceability_details?.is_serviceable,
            }))
        };
    } catch (error) {
        console.error('[WAYUVEGA] Serviceability error:', error.response?.data || error.message);
        return { serviceable: true, error: error.message };
    }
};

/**
 * 3. Book Shipment on Wayuvega (Create Order)
 * @param {Object} order - Hridved Order document
 * @param {Object} options - Custom pickup or carrier overrides
 */
export const createWayuvegaOrder = async (order, options = {}) => {
    const token = await getWayuvegaAuthToken();
    const orderRef = `HRD-${order._id.toString().slice(-8).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    if (!token) {
        console.log('[WAYUVEGA DEMO] Generating realistic shipment allocation for Order', order._id);
        const mockAwb = `WAYU${Math.floor(1000000000 + Math.random() * 9000000000)}`;
        return {
            success: true,
            simulated: true,
            waybill: mockAwb,
            orderReferenceNumber: orderRef,
            shipmentOrderId: `wv_sim_${order._id}`,
            courierName: 'DELHIVERY SURFACE',
            labelUrl: null,
            status: 'ORDER_PLACED (30)',
        };
    }

    try {
        const pickupPhone = process.env.ORDER_PHONE || '7990934095';
        const defaultPickup = {
            pickup_poc: 'Hridved Fulfillment Desk',
            pickup_organisation: 'Hridved Ayurveda',
            pickup_address: 'Hridved Ayurvedic Herbarium, Opp. Science City',
            pickup_city: 'Ahmedabad',
            pickup_state: 'Gujarat',
            pickup_postal_code: '380060',
            pickup_country_code: 'IN',
            pickup_address_type: 'WAREHOUSE',
            pickup_poc_email: 'care@hridved.com',
            pickup_poc_contact_dialing_code: '+91',
            pickup_poc_contact_number: pickupPhone.slice(-10),
        };

        const dropPhone = String(order.shippingAddress?.mobileNumber || '').replace(/\D/g, '').slice(-10);
        const dropDetails = {
            drop_poc: order.shippingAddress?.fullName || 'Customer',
            drop_address: `${order.shippingAddress?.houseNumber || ''}, ${order.shippingAddress?.landmark || ''}`.trim(),
            drop_city: order.shippingAddress?.city || 'Ahmedabad',
            drop_state: order.shippingAddress?.state || 'Gujarat',
            drop_postal_code: String(order.shippingAddress?.pincode || '380001').replace(/\D/g, '').slice(0, 6),
            drop_country_code: 'IN',
            drop_address_type: (order.shippingAddress?.addressType || 'HOME').toUpperCase(),
            drop_poc_contact_dialing_code: '+91',
            drop_poc_contact_number: dropPhone,
            drop_poc_email: order.email || undefined,
        };

        // Calculate package weight and items
        const items = (order.orderItems || []).map((item, idx) => ({
            item_id: item.product?.toString() || `ITEM-${idx + 1}`,
            quantity: item.qty || 1,
            item_general_details: {
                item_name: item.name || 'Ayurvedic Herb Medicine',
                sku: `HRD-${idx + 1}`,
            },
            item_payment_details: {
                currency: 'INR',
                unit_price: Number(item.price) || 499,
                final_amount_paid: Number((item.price || 499) * (item.qty || 1)),
                taxable_value: Math.round(Number(item.price) * 0.88),
            }
        }));

        const isCod = order.paymentMethod === 'COD';
        const invoiceVal = Number(order.totalPrice) || 999;

        const payload = {
            shipment_order_type: 'FORWARD',
            process_shipment_order_in_async: false,
            bypass_confirmation: true,
            market_place_channel_name: 'WEBSITE',
            marketplace_channel_order_number: String(order._id).slice(-8).toUpperCase(),
            order_source: 'MERCHANT_API',
            pickup_details: options.pickupDetails || defaultPickup,
            drop_details: dropDetails,
            shipment_details: {
                shipment_carrier_details: {
                    carrier_partner_account_code: null,
                    carrier_partner_public_name: null, // automatic optimal courier selection
                },
                order_details: {
                    order_id: String(order._id),
                    order_reference_number: orderRef,
                    order_create_datetime: new Date().toISOString(),
                    order_type: isCod ? 'COD' : 'PREPAID',
                    cod_amount_details: isCod ? {
                        value: invoiceVal,
                        currency: 'INR',
                    } : null,
                    order_invoice_details: {
                        invoice_date: new Date().toISOString().split('T')[0],
                        invoice_currency: 'INR',
                        invoice_value: invoiceVal,
                    }
                },
                shipment_packages: [
                    {
                        dimensions: {
                            length: 20,
                            breadth: 15,
                            height: 10,
                            unit: 'cm',
                        },
                        weight: {
                            value: 500, // 500g default for herbal packages
                            unit: 'gm',
                        },
                        items: items,
                    }
                ]
            },
            shipper_tax_details: {
                gst: {
                    shipper_gstin: process.env.GST_NUMBER || null,
                }
            }
        };

        const response = await axios.post(`${OMS_BASE_URL}/v2/oms/order`, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            timeout: 15000,
        });

        const data = response.data;
        if (data && (data.metadata?.status === 200 || data.metadata?.success === true) && data.result) {
            console.log(`[WAYUVEGA] Order booked successfully! AWB: ${data.result.waybill}, Courier: ${data.result.courier_name}`);
            return {
                success: true,
                waybill: data.result.waybill,
                orderReferenceNumber: data.result.order_reference_number,
                shipmentOrderId: data.result.shipment_order_id,
                courierName: data.result.courier_name,
                labelUrl: data.result.label_url,
                invoiceUrl: data.result.commercial_invoice_url,
            };
        }

        console.warn('[WAYUVEGA] Order booking returned non-200:', data);
        return {
            success: false,
            message: data.metadata?.message || 'Shipment allocation pending',
            data,
        };
    } catch (err) {
        console.error('[WAYUVEGA] Create Order Error:', err.response?.data || err.message);
        return {
            success: false,
            error: err.response?.data?.message || err.message,
        };
    }
};

/**
 * 4. Status Code Dictionary for Amazon/Flipkart/Meesho mapping
 */
export const WAYUVEGA_STATUS_MAP = {
    '0': { label: 'Order Registered', step: 0, status: 'Processing', description: 'Order registered in logistics system' },
    '23': { label: 'Confirmation Awaited', step: 0, status: 'Processing', description: 'Customer confirmation pending' },
    '30': { label: 'Order Confirmed', step: 0, status: 'Processing', description: 'Order manifested & verified' },
    '40': { label: 'Packed & Ready', step: 1, status: 'Packed', description: 'Herbal medicine packed & pickup scheduled' },
    '50': { label: 'Pickup Reattempt', step: 1, status: 'Packed', description: 'Carrier pickup in progress' },
    '60': { label: 'Shipped & Picked Up', step: 2, status: 'Shipped', description: 'Parcel picked up by courier' },
    '70': { label: 'In Transit', step: 2, status: 'Shipped', description: 'On the way to destination city' },
    '340': { label: 'Origin Hub In', step: 2, status: 'Shipped', description: 'Arrived at origin processing center' },
    '350': { label: 'Origin Hub Out', step: 2, status: 'Shipped', description: 'Departed from origin facility' },
    '330': { label: 'Destination Hub In', step: 3, status: 'Shipped', description: 'Arrived at destination city hub' },
    '80': { label: 'Out for Delivery', step: 3, status: 'Shipped', description: 'Out with delivery executive - Arriving today' },
    '100': { label: 'Delivered', step: 4, status: 'Delivered', description: 'Delivered safely to customer' },
    '110': { label: 'Delivery Attempted', step: 3, status: 'Shipped', description: 'Consignee unavailable, reattempt scheduled' },
    '120': { label: 'Cancelled', step: 0, status: 'Cancelled', description: 'Shipment cancelled' },
    '140': { label: 'RTO Initiated', step: 2, status: 'RTO', description: 'Returning to origin warehouse' },
    '160': { label: 'Returned to Origin', step: 4, status: 'RTO', description: 'Returned back to warehouse' },
};

/**
 * 5. Track Order History Timeline (Detailed live tracking like Amazon / Flipkart)
 * @param {string} awbOrRef 
 */
export const trackWayuvegaHistory = async (awbOrRef) => {
    if (!awbOrRef) return null;
    const cleanId = String(awbOrRef).trim();

    const token = await getWayuvegaAuthToken();
    if (!token) {
        // Return structured timeline for local order simulation
        return null;
    }

    try {
        const isAwb = /^\d{8,16}$/.test(cleanId) || cleanId.startsWith('WAYU') || cleanId.startsWith('149');
        const payload = isAwb 
            ? { awb_number: cleanId, order_reference_number: null }
            : { awb_number: null, order_reference_number: cleanId };

        const response = await axios.post(`${OMS_BASE_URL}/v2/oms/order/tracking/history`, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });

        const data = response.data;
        if (!data) return null;

        const timeline = (data.order_processing_business_status_codes || []).map(event => {
            const mapped = WAYUVEGA_STATUS_MAP[event.order_status_code] || {
                label: event.order_status_description || 'In Transit',
                step: 2,
                status: 'Shipped',
                description: event.order_remarks || 'Shipment update'
            };

            return {
                code: event.order_status_code,
                status: mapped.label,
                stage: mapped.status,
                step: mapped.step,
                description: event.order_remarks || event.order_status_description || mapped.description,
                location: event.order_location || 'Central Sorting Hub',
                timestamp: event.order_status_time || event.created_date_time,
                carrierEdd: event.carrier_partner_edd,
            };
        });

        // Determine current status
        const latestEvent = timeline[timeline.length - 1];
        const currentMapped = latestEvent ? WAYUVEGA_STATUS_MAP[latestEvent.code] : null;

        return {
            success: true,
            awbNumber: data.awb_number,
            orderReferenceNumber: data.order_reference_number,
            courierName: data.carrier_partner_public_name || 'DELHIVERY SURFACE',
            expectedDeliveryDate: data.expected_delivery_date,
            eddSource: data.edd_source,
            currentStatusCode: latestEvent?.code || '30',
            currentStatus: currentMapped?.label || 'In Transit',
            currentShippingStatus: currentMapped?.status || 'Shipped',
            currentStep: currentMapped?.step !== undefined ? currentMapped.step : 2,
            latestLocation: latestEvent?.location || 'Logistics Hub',
            timeline: timeline,
        };
    } catch (error) {
        console.warn('[WAYUVEGA] Tracking history error:', error.response?.data?.message || error.message);
        return null;
    }
};

/**
 * 6. Cancel Order
 * @param {string} waybill 
 */
export const cancelWayuvegaOrder = async (waybill) => {
    if (!waybill) return { success: false, message: 'Waybill is required' };
    const token = await getWayuvegaAuthToken();
    if (!token) {
        return { success: true, simulated: true, message: 'Cancellation recorded' };
    }

    try {
        const response = await axios.post(`${OMS_BASE_URL}/v2/oms/request-cancel-order`, {
            waybill: waybill.trim(),
            shipment_order_id: null,
            merchant_id: null,
            order_reference_number: null,
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });

        return {
            success: response.data?.metadata?.success !== false,
            message: response.data?.metadata?.message || 'Cancellation processed',
            status: response.data?.result?.shipment_order_status,
        };
    } catch (err) {
        console.error('[WAYUVEGA] Cancellation Error:', err.response?.data || err.message);
        return {
            success: false,
            error: err.response?.data?.message || err.message,
        };
    }
};
