import * as fshipService from '../utils/fshipService.js';

/**
 * Create a new Fship Forward Order
 */
export const createOrder = async (req, res) => {
    try {
        const result = await fshipService.createForwardOrder(req.body);
        res.status(200).json(result);
    } catch (error) {
        console.error('[FSHIP] Create Order Error:', error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message,
            details: error.data
        });
    }
};

/**
 * Get Tracking History for a Waybill
 */
export const getTracking = async (req, res) => {
    const { waybill } = req.body;
    if (!waybill) {
        return res.status(400).json({ success: false, message: 'waybill is required' });
    }
    try {
        const result = await fshipService.getTrackingHistory(waybill);
        res.status(200).json(result);
    } catch (error) {
        console.error('[FSHIP] Tracking Error:', error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message,
            details: error.data
        });
    }
};

/**
 * Get Shipment Summary for a Waybill
 */
export const getSummary = async (req, res) => {
    const { waybill } = req.body;
    if (!waybill) {
        return res.status(400).json({ success: false, message: 'waybill is required' });
    }
    try {
        const result = await fshipService.getShipmentSummary(waybill);
        res.status(200).json(result);
    } catch (error) {
        console.error('[FSHIP] Summary Error:', error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message,
            details: error.data
        });
    }
};
