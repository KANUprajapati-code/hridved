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
    const { pincode, value, sourcePincode = '383325' } = req.body;
    try {
        let shippingOptions = [];
        const config = await SystemConfig.findOne() || { shipping: { vamashipEnabled: true } };
        const orderValue = Number(value) || 0;
        const shippingCharge = orderValue >= 999 ? 0 : 50;

        // Use a flat ₹50 charge (₹0 if free shipping applies)
        shippingOptions.push({
            type: 'Standard',
            days: '3-5',
            charge: shippingCharge,
            description: 'Standard Delivery (3-5 days)',
            provider: 'Vamaship'
        });

        // Still check Vamaship for serviceability if enabled, but don't use their rates
        if (config.shipping.vamashipEnabled) {
            try {
                const vamashipPayload = {
                    destination: pincode,
                    weight: Number(req.body.weight) || 0.5,
                    value: orderValue || 500
                };
                // We call it just to ensure the destination is valid/serviceable
                await getVamashipRates(vamashipPayload);
            } catch (vamashipError) {
                console.warn('Vamaship serviceability check failed:', vamashipError.message);
            }
        }

        // Fallback if no shipping options were found
        if (shippingOptions.length === 0) {
            console.log('[SHIPPING] Using fallback rates');
            shippingOptions.push(
                {
                    type: 'Standard',
                    days: '3-5',
                    charge: shippingCharge,
                    description: 'Standard Delivery (3-5 days)',
                    provider: 'Vamaship'
                },
                {
                    type: 'Express',
                    days: '1-2',
                    charge: shippingCharge === 0 ? 49 : 99, // Lower express if standard is free
                    description: 'Express Delivery (1-2 days)',
                    provider: 'Vamaship'
                }
            );
        }

        res.json({
            success: true,
            serviceability: true,
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
            } else if (order && order.apiOrderId) {
                // Try fetching AWB on-demand if we have a refid/order_id but no waybill
                try {
                    const { getVamashipOrderDetails } = await import('../utils/vamashipService.js');
                    const details = await getVamashipOrderDetails(order.apiOrderId);
                    
                    // Documentation says shipments is an array, let's look for awb there
                    if (details && details.success && details.shipments && details.shipments.length > 0) {
                        const shipData = details.shipments[0];
                        if (shipData.awb) {
                            console.log(`[TRACKING] Successfully polled AWB: ${shipData.awb} for Order: ${order._id}`);
                            order.waybill = shipData.awb;
                            // Also update Vamaship's internal Order ID if it was just a RefID before
                            if (shipData.order_id) {
                                order.apiOrderId = String(shipData.order_id);
                            }
                            order.shippingStatus = 'Shipped';
                            await order.save();
                            waybill = order.waybill;
                        } else {
                            console.log(`[TRACKING] Polled but no AWB yet for RefID: ${order.apiOrderId}`);
                            return res.status(202).json({ 
                                message: 'Booking is still being processed by Vamaship. AWB not yet assigned.',
                                status: 'Processing'
                            });
                        }
                    } else {
                        return res.status(202).json({ 
                            message: 'Booking details received but no shipment data found. Checking again later.',
                            status: 'Processing'
                        });
                    }
                } catch (err) {
                    console.error('On-demand polling error:', err);
                    return res.status(400).json({ message: 'Error checking shipment status with Vamaship.' });
                }
            } else if (order) {
                // If apiOrderId is missing, try to trigger the shipment creation now
                try {
                    console.log(`[TRACKING] No ID found for order ${order._id}, triggering shipment creation now.`);
                    const { processVamashipShipment } = await import('../utils/vamashipService.js');
                    const result = await processVamashipShipment(order._id);
                    
                    if (result.success && result.waybill) {
                        waybill = result.waybill;
                    } else if (result.success && (result.refid || result.id || result.order_id)) {
                        return res.status(202).json({ 
                            message: 'Shipment booking initiated. Please check back in a few minutes.',
                            status: 'Processing'
                        });
                    } else {
                        return res.status(400).json({ 
                            message: result.message || 'Order found but shipment booking failed. Please contact support.',
                            details: result.details
                        });
                    }
                } catch (shipError) {
                    console.error('[TRACKING] Failed to auto-trigger shipment:', shipError);
                    return res.status(400).json({ message: 'Order found but no Waybill assigned yet.' });
                }
            }
        }

        const { trackVamashipShipment } = await import('../utils/vamashipService.js');
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
        if (result && result.success && result.data?.history) {
            const history = result.data.history.map(item => ({
                dateAndTime: new Date(item.date_time || item.timestamp || Date.now()),
                status: item.status || 'Processed',
                remark: item.activity || item.remark || 'Shipment status updated',
                location: item.location || 'In Transit'
            }));
            await Order.findOneAndUpdate({ waybill }, { trackingHistory: history });
            return res.json({ status: true, trackingdata: history });
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
