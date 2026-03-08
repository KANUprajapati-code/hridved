import {
    getVamashipRates,
    processVamashipShipment,
    trackVamashipShipment,
    processVamashipReverseShipment
} from '../utils/vamashipService.js';
import SystemConfig from '../models/SystemConfig.js';
import Order from '../models/Order.js';

// @desc    Check Pincode Serviceability
// @route   POST /api/shipping/serviceability
// @access  Public
export const checkServiceability = async (req, res) => {
    const { pincode, sourcePincode = '383325' } = req.body;
    try {
        let shippingOptions = [];
        const config = await SystemConfig.findOne() || { shipping: { vamashipEnabled: true } };

        // Vamaship Rates
        if (config.shipping.vamashipEnabled) {
            try {
                const vamashipPayload = {
                    type: "prepaid",
                    subtype: "general",
                    origin: sourcePincode,
                    destination: pincode,
                    weight: 0.5,
                    seller: {
                        name: "Hridved Ayurveda",
                        pincode: sourcePincode,
                        city: "Dhansura",
                        state: "Gujarat",
                        country: "India",
                        phone: "9876543210",
                        email: "hridved@gmail.com",
                        address: "Plot No. 123, Modasa Road"
                    },
                    shipments: [{
                        weight: 0.5,
                        length: 10,
                        width: 10,
                        height: 10,
                        value: 500
                    }]
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
                if (vamashipError.data) {
                    console.warn('Vamaship Error Data:', JSON.stringify(vamashipError.data, null, 2));
                }
            }
        }

        // Fallback if no shipping options were found
        if (shippingOptions.length === 0) {
            console.log('[SHIPPING] Using fallback rates');
            shippingOptions.push(
                {
                    type: 'Standard',
                    days: '3-5',
                    charge: 0,
                    description: 'Standard Delivery (3-5 days)',
                    provider: 'Vamaship'
                },
                {
                    type: 'Express',
                    days: '1-2',
                    charge: 99,
                    description: 'Express Delivery (1-2 days)',
                    provider: 'Vamaship'
                }
            );
        }

        res.json({
            success: true,
            shippingOptions
        });
    } catch (error) {
        console.error('Serviceability Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create Shipment
// @route   POST /api/shipping/create-shipment
// @access  Private/Admin
export const createShipment = async (req, res) => {
    const { orderId } = req.body;

    try {
        const result = await processVamashipShipment(orderId);

        if (result.success) {
            return res.json({
                message: 'Vamaship Shipment Created Successfully',
                waybill: result.waybill
            });
        } else {
            return res.status(400).json({
                message: 'Vamaship API failed to create shipment',
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

// @desc    Register Pickup (Simplifed for Vamaship)
// @route   POST /api/shipping/register-pickup
// @access  Private/Admin
export const registerPickup = async (req, res) => {
    res.json({ success: true, message: 'Vamaship typically handles pickup via booking API' });
};

// @desc    Get Shipping Labels
// @route   POST /api/shipping/labels
// @access  Private/Admin
export const getLabels = async (req, res) => {
    res.status(501).json({ message: 'Vamaship label generation pending integration' });
};

// @desc    Track Shipment
// @route   GET /api/shipping/track/:waybill
// @access  Public
export const trackShipment = async (req, res) => {
    let { waybill } = req.params;
    try {
        if (waybill && waybill.match(/^[0-9a-fA-F]{24}$/)) {
            const order = await Order.findById(waybill);
            if (order && order.waybill) {
                waybill = order.waybill;
            } else if (order) {
                return res.status(400).json({ message: 'Order found but no Waybill assigned yet.' });
            }
        }

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

        res.status(404).json({
            message: 'Tracking info not found',
            details: 'Waybill not recognized by Vamaship'
        });
    } catch (error) {
        console.error("Tracking Error:", error);
        res.status(500).json({
            message: 'Tracking error',
            error: error.message
        });
    }
};

// @desc    Get Full Tracking History
// @route   GET /api/shipping/tracking-history/:waybill
// @access  Public
export const getTrackingHistory = async (req, res) => {
    const { waybill } = req.params;
    try {
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

        res.status(404).json({ message: 'Tracking history not found' });
    } catch (error) {
        res.status(500).json({ message: 'Tracking history error', error: error.message });
    }
};

// @desc    Create Reverse Order
// @route   POST /api/shipping/reverse-order
// @access  Private/Admin
export const createReverseOrder = async (req, res) => {
    const { waybill } = req.body;
    try {
        const result = await processVamashipReverseShipment(waybill);
        return res.json({ message: 'Vamaship Reverse Order Created', result });
    } catch (error) {
        res.status(500).json({ message: 'Reverse Order error', error: error.message });
    }
};

// @desc    Health Check
export const testApi = async (req, res) => {
    res.json({ message: 'Shipping API Health OK' });
};
