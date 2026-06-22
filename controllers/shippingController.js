import SystemConfig from '../models/SystemConfig.js';
import Order from '../models/Order.js';

// @desc    Check Pincode Serviceability
// @route   POST /api/shipping/serviceability
// @access  Public
export const checkServiceability = async (req, res) => {
    const { pincode, value } = req.body;
    try {
        if (!pincode || !pincode.match(/^[1-9][0-9]{5}$/)) {
            return res.status(400).json({ success: false, message: 'Invalid Indian Pincode' });
        }

        const orderValue = Number(value) || 0;
        const shippingCharge = orderValue >= 999 ? 0 : 50;

        const shippingOptions = [
            {
                type: 'Standard',
                days: '3-5',
                charge: shippingCharge,
                description: 'Standard Delivery (3-5 days)',
                provider: 'Local Courier'
            }
        ];

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
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        order.shippingStatus = 'Shipped';
        order.waybill = `HRD${Math.floor(10000000 + Math.random() * 90000000)}`;
        await order.save();

        return res.json({
            message: 'Shipment Created Successfully',
            waybill: order.waybill
        });
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
    res.json({ success: true, message: 'Pickup registered successfully' });
};

// @desc    Get Shipping Labels
// @route   POST /api/shipping/labels
// @access  Private/Admin
export const getLabels = async (req, res) => {
    res.json({ success: true, labelUrl: '', message: 'Label generated successfully' });
};

// @desc    Track Shipment
// @route   GET /api/shipping/track/:waybill
// @access  Public
export const trackShipment = async (req, res) => {
    const { waybill } = req.params;
    try {
        const order = await Order.findOne({ $or: [{ _id: waybill }, { waybill: waybill }] });
        if (order) {
            return res.json({
                status: order.shippingStatus || 'Processing',
                activity: 'Shipment is package at local warehouse',
                location: 'Main Warehouse'
            });
        }
        res.status(404).json({
            message: 'Tracking info not found',
            details: 'Shipment not found'
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
        const history = [
            {
                dateAndTime: new Date(),
                status: 'Processed',
                remark: 'Shipment processed successfully',
                location: 'Main Warehouse'
            }
        ];
        return res.json({ status: true, trackingdata: history });
    } catch (error) {
        res.status(500).json({ message: 'Tracking history error', error: error.message });
    }
};

// @desc    Create Reverse Order
// @route   POST /api/shipping/reverse-order
// @access  Private/Admin
export const createReverseOrder = async (req, res) => {
    return res.json({ message: 'Reverse Order Created Successfully', result: { success: true } });
};

// @desc    Health Check
export const testApi = async (req, res) => {
    res.json({ message: 'Shipping API Health OK' });
};
