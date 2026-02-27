import {
    createFshipForwardOrder,
    getFshipShipmentSummary,
    getFshipTrackingHistory,
    registerFshipPickup,
    getFshipShippingLabelByPickupId,
    createFshipReverseOrder,
    checkFshipServiceability as checkFshipServiceabilityService
} from '../utils/fshipService.js';
import {
    getVamashipRates,
    processVamashipShipment,
    trackVamashipShipment,
    processVamashipReverseShipment
} from '../utils/vamashipService.js';
import SystemConfig from '../models/SystemConfig.js';

// @desc    Check Pincode Serviceability
// @route   POST /api/shipping/serviceability
// @access  Public
export const checkServiceability = async (req, res) => {
    const { pincode, sourcePincode = '383325' } = req.body;
    try {
        let shippingOptions = [];
        const config = await SystemConfig.findOne() || { shipping: { fshipEnabled: true, vamashipEnabled: true } };

        // 1. Fship Rates
        if (config.shipping.fshipEnabled) {
            try {
                const data = await checkFshipServiceabilityService(sourcePincode, pincode);

                // Fship returns availability data; transform it into our format
                if (data && data.status === true) {
                    const available = data.availability || {};
                    if (available.surface !== false) {
                        shippingOptions.push({
                            type: 'Standard',
                            days: '3-5',
                            charge: 0,
                            description: 'Standard Delivery (3-5 days)',
                        });
                    }
                    if (available.air !== false) {
                        shippingOptions.push({
                            type: 'Express',
                            days: '1-2',
                            charge: 99,
                            description: 'Express Delivery (1-2 days)',
                        });
                    }
                }
            } catch (fshipError) {
                console.warn('Fship serviceability check failed:', fshipError.message);
            }
        }

        // 2. Vamaship Rates
        if (config.shipping.vamashipEnabled) {
            try {
                const vamashipPayload = {
                    origin_pincode: sourcePincode,
                    destination_pincode: pincode,
                    weight: 0.5,
                    payment_mode: 'Prepaid'
                };
                const vamashipData = await getVamashipRates(vamashipPayload);

                if (vamashipData && vamashipData.status === 'success' && vamashipData.data?.rates) {
                    vamashipData.data.rates.forEach(rate => {
                        shippingOptions.push({
                            type: rate.courier_name,
                            days: rate.estimated_delivery_days || '3-5',
                            charge: rate.total_charge,
                            description: `${rate.courier_name} (${rate.estimated_delivery_days} days)`,
                            provider: 'Vamaship'
                        });
                    });
                }
            } catch (vamashipError) {
                console.warn('Vamaship rates check failed:', vamashipError.message);
            }
        }

        // Always return at least the default options
        if (shippingOptions.length === 0) {
            shippingOptions = [
                {
                    type: 'Standard',
                    days: '3-5',
                    charge: 0,
                    description: 'Standard Delivery (3-5 days)',
                },
                {
                    type: 'Express',
                    days: '1-2',
                    charge: 99,
                    description: 'Express Delivery (1-2 days)',
                }
            ];
        }

        res.json({ shippingOptions });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message, details: error.data });
    }
};

// @desc    Create Fship Shipment (Manual or Auto)
// @route   POST /api/shipping/create-shipment
// @access  Private/Admin
export const createShipment = async (req, res) => {
    const { orderId, provider = 'Fship' } = req.body;

    try {
        let result;
        if (provider === 'Vamaship') {
            result = await processVamashipShipment(orderId);
        } else {
            const { processFshipShipment } = await import('../utils/fshipService.js');
            result = await processFshipShipment(orderId);
        }

        if (result.success) {
            return res.json({
                message: 'Shipment Created Successfully',
                waybill: result.waybill
            });
        } else {
            return res.status(400).json({
                message: 'Fship API failed to create shipment',
                details: result.details
            });
        }
    } catch (error) {
        console.error('Create Shipment Error:', error);
        res.status(500).json({
            message: 'Shipment creation failed',
            error: error.message
        });
    }
};

// @desc    Register Pickup
// @route   POST /api/shipping/register-pickup
// @access  Private/Admin
export const registerPickup = async (req, res) => {
    const { waybills } = req.body;
    try {
        // Find if any of these are Fship waybills
        const orders = await Order.find({ waybill: { $in: waybills } });
        const fshipWaybills = orders.filter(o => o.shippingProvider !== 'Vamaship').map(o => o.waybill);
        const vamashipWaybills = orders.filter(o => o.shippingProvider === 'Vamaship').map(o => o.waybill);

        let results = { fship: null, vamaship: 'Pickup not required for Vamaship API' };

        if (fshipWaybills.length > 0) {
            const result = await registerFshipPickup(fshipWaybills);
            if (result && result.status === true) {
                const pickupData = result.apipickuporderids?.[0];
                if (pickupData) {
                    await Order.updateMany(
                        { waybill: { $in: pickupData.waybills } },
                        { $set: { pickupOrderId: pickupData.pickupOrderId } }
                    );
                }
                results.fship = result;
            }
        }

        res.json({ success: true, results, vamashipWaybills });
    } catch (error) {
        res.status(500).json({ message: 'Pickup registration error', error: error.message });
    }
};

// @desc    Get Shipping Labels
// @route   POST /api/shipping/labels
// @access  Private/Admin
export const getLabels = async (req, res) => {
    const { pickupOrderId } = req.body; // Expects array of IDs
    try {
        const result = await getFshipShippingLabelByPickupId(pickupOrderId);
        // Result contains manifestfile, invoicefile, labelfile
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Label generation failed', error: error.message });
    }
};

// @desc    Track Shipment (Latest status)
// @route   GET /api/shipping/track/:waybill
// @access  Public
export const trackShipment = async (req, res) => {
    let { waybill } = req.params;
    try {
        // If the waybill matches a MongoDB ID pattern, try to find the order first
        if (waybill && waybill.match(/^[0-9a-fA-F]{24}$/)) {
            const order = await Order.findById(waybill);
            if (order && order.waybill) {
                waybill = order.waybill;
            } else if (order) {
                return res.status(400).json({ message: 'Order found but no Waybill assigned yet. Shipment might still be processing.' });
            }
        }

        const order = await Order.findOne({ waybill });
        if (order && order.shippingProvider === 'Vamaship') {
            const result = await trackVamashipShipment(waybill);
            if (result && result.status === "success" && result.data) {
                const trackData = result.data;
                const status = trackData.status || 'Shipped';
                await Order.findOneAndUpdate(
                    { waybill },
                    {
                        trackingStatus: status,
                        shippingStatus: status === 'Delivered' ? 'Delivered' : 'Shipped'
                    }
                );
                return res.json(trackData);
            }
        } else {
            const result = await getFshipShipmentSummary(waybill);
            if (result && result.status === true) {
                const summary = result.summary;
                await Order.findOneAndUpdate(
                    { waybill },
                    {
                        trackingStatus: summary.status,
                        shippingStatus: summary.status === 'Delivered' ? 'Delivered' : 'Shipped'
                    }
                );
                return res.json(summary);
            }
        }

        res.status(404).json({
            message: 'Tracking info not found',
            details: 'Waybill not recognized by provider'
        });
    } catch (error) {
        console.error("Tracking Error:", error);
        res.status(error.status || 500).json({
            message: 'Tracking error',
            error: error.message,
            details: error.data
        });
    }
};

// @desc    Get Full Tracking History
// @route   GET /api/shipping/tracking-history/:waybill
// @access  Public
export const getTrackingHistory = async (req, res) => {
    const { waybill } = req.params;
    try {
        const order = await Order.findOne({ waybill });
        if (order && order.shippingProvider === 'Vamaship') {
            const result = await trackVamashipShipment(waybill);
            if (result && result.status === "success" && result.data?.history) {
                const history = result.data.history.map(item => ({
                    dateAndTime: new Date(item.date_time),
                    status: item.status,
                    remark: item.activity,
                    location: item.location
                }));
                await Order.findOneAndUpdate({ waybill }, { trackingHistory: history });
                return res.json({ status: true, trackingdata: result.data.history });
            }
        } else {
            const result = await getFshipTrackingHistory(waybill);
            if (result && result.status === true) {
                const history = result.trackingdata.map(item => ({
                    dateAndTime: new Date(item.DateandTime),
                    status: item.Status,
                    remark: item.Remark,
                    location: item.Location
                }));
                await Order.findOneAndUpdate({ waybill }, { trackingHistory: history });
                return res.json(result);
            }
        }

        res.status(404).json({ message: 'Tracking history not found' });
    } catch (error) {
        res.status(500).json({ message: 'Tracking history error', error: error.message });
    }
};

// @desc    Create Reverse Order
// @route   POST /api/shipping/reverse-order
// @access  Private/Admin
export const createReverseOrder = async (req, res) => {
    const { waybill, qcRequired = false, qcParameters = [] } = req.body;
    try {
        const order = await Order.findOne({ waybill }).populate('user', 'name email');
        if (!order) return res.status(404).json({ message: 'Forward order not found' });

        if (order.shippingProvider === 'Vamaship') {
            const result = await processVamashipReverseShipment(waybill);
            return res.json({ message: 'Vamaship Reverse Order Created', result });
        } else {
            const payload = {
                customer_Name: order.shippingAddress.fullName,
                customer_Mobile: order.shippingAddress.mobileNumber,
                customer_Emailid: order.user?.email || 'customer@example.com',
                customer_Address: order.shippingAddress.houseNumber,
                customer_PinCode: order.shippingAddress.pincode,
                customer_City: order.shippingAddress.city,
                orderId: "REV" + order.orderId,
                order_Amount: order.totalPrice,
                total_Amount: order.totalPrice,
                pickUpAddressId: 0, // Customer address is pickup for reverse
                shipment_Weight: 0.5,
                shipment_Length: 10,
                shipment_Width: 10,
                shipment_Height: 10,
                products: order.orderItems.map(item => ({
                    productName: item.name,
                    quantity: item.qty,
                    unitPrice: item.price,
                    brandName: 'Hridved',
                    color: 'N/A',
                    size: 'N/A',
                    qcParameters: qcParameters
                })),
                isQcRequired: qcRequired
            };

            const result = await createFshipReverseOrder(payload);
            if (result && result.status === true) {
                res.json({ message: 'Fship Reverse Order Created', result });
            } else {
                res.status(400).json({ message: 'Fship Reverse Order failed', details: result });
            }
        }
    } catch (error) {
        res.status(500).json({ message: 'Reverse Order error', error: error.message });
    }
};

// @desc    Health Check
export const testFshipApi = async (req, res) => {
    res.json({ message: 'Fship API Health OK', baseURL: process.env.FSHIP_BASE_URL });
};
