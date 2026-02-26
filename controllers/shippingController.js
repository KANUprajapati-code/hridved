import {
    createFshipForwardOrder,
    getFshipShipmentSummary,
    getFshipTrackingHistory,
    registerFshipPickup,
    getFshipShippingLabelByPickupId,
    createFshipReverseOrder,
    checkFshipServiceability as checkFshipServiceabilityService
} from '../utils/fshipService.js';
import Order from '../models/Order.js';

// @desc    Check Pincode Serviceability
// @route   POST /api/shipping/serviceability
// @access  Public
export const checkServiceability = async (req, res) => {
    const { pincode, sourcePincode = '383325' } = req.body;
    try {
        let shippingOptions = [];

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
            console.warn('Fship serviceability check failed, using defaults:', fshipError.message);
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
    const { orderId } = req.body;

    try {
        const { processFshipShipment } = await import('../utils/fshipService.js');
        const result = await processFshipShipment(orderId);

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
        const result = await registerFshipPickup(waybills);
        if (result && result.status === true) {
            // Update orders with pickupOrderId
            const pickupData = result.apipickuporderids?.[0];
            if (pickupData) {
                await Order.updateMany(
                    { waybill: { $in: pickupData.waybills } },
                    { $set: { pickupOrderId: pickupData.pickupOrderId } }
                );
            }
            res.json(result);
        } else {
            res.status(400).json({ message: 'Pickup registration failed', details: result });
        }
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

        const result = await getFshipShipmentSummary(waybill);
        if (result && result.status === true) {
            const summary = result.summary;
            // Optionally update database
            await Order.findOneAndUpdate(
                { waybill },
                {
                    trackingStatus: summary.status,
                    shippingStatus: summary.status === 'Delivered' ? 'Delivered' : 'Shipped'
                }
            );
            res.json(summary);
        } else {
            res.status(404).json({
                message: 'Tracking info not found',
                details: result?.error || result?.message || 'Invalid Waybill'
            });
        }
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
        const result = await getFshipTrackingHistory(waybill);
        if (result && result.status === true) {
            // Update order history in DB
            const history = result.trackingdata.map(item => ({
                dateAndTime: new Date(item.DateandTime),
                status: item.Status,
                remark: item.Remark,
                location: item.Location
            }));
            await Order.findOneAndUpdate({ waybill }, { trackingHistory: history });
            res.json(result);
        } else {
            res.status(404).json({ message: 'Tracking history not found', details: result });
        }
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
            // Logic to handle reverse order save could be added here
            res.json({ message: 'Reverse Order Created', result });
        } else {
            res.status(400).json({ message: 'Reverse Order failed', details: result });
        }
    } catch (error) {
        res.status(500).json({ message: 'Reverse Order error', error: error.message });
    }
};

// @desc    Health Check
export const testFshipApi = async (req, res) => {
    res.json({ message: 'Fship API Health OK', baseURL: process.env.FSHIP_BASE_URL });
};
