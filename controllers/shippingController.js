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

/**
 * Helper to generate order ID: ORD + timestamp
 */
const generateOrderId = () => `ORD${Date.now()}`;

// @desc    Check Pincode Serviceability
// @route   POST /api/shipping/serviceability
// @access  Public
export const checkServiceability = async (req, res) => {
    const { pincode, sourcePincode = '380001' } = req.body;
    try {
        const data = await checkFshipServiceabilityService(sourcePincode, pincode);
        res.json(data);
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
        const order = await Order.findById(orderId).populate('user', 'name email');
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (order.waybill) return res.status(400).json({ message: 'Shipment already created with waybill: ' + order.waybill });

        // Prepare Fship Payload
        const payload = {
            customer_Name: order.shippingAddress.fullName,
            customer_Mobile: order.shippingAddress.mobileNumber,
            customer_Emailid: order.user?.email || 'customer@example.com',
            customer_Address: order.shippingAddress.houseNumber,
            landMark: order.shippingAddress.landmark || '',
            customer_Address_Type: order.shippingAddress.addressType || 'Home',
            customer_PinCode: order.shippingAddress.pincode,
            customer_City: order.shippingAddress.city,
            orderId: order.orderId || generateOrderId(),
            payment_Mode: order.paymentMethod === 'COD' ? 1 : 2, // 1=COD, 2=PREPAID
            express_Type: order.deliveryOption === 'Express' ? 'air' : 'surface',
            order_Amount: order.totalPrice,
            total_Amount: order.totalPrice,
            cod_Amount: order.paymentMethod === 'COD' ? order.totalPrice : 0,
            shipment_Weight: 0.5,
            shipment_Length: 10,
            shipment_Width: 10,
            shipment_Height: 10,
            pick_Address_ID: 0, // Should be configured address ID
            return_Address_ID: 0,
            products: order.orderItems.map(item => ({
                productName: item.name,
                unitPrice: item.price,
                quantity: item.qty,
                sku: String(item.product)
            }))
        };

        const result = await createFshipForwardOrder(payload);

        if (result && result.status === true) {
            order.waybill = result.waybill;
            order.apiOrderId = result.apiorderid;
            order.shippingStatus = 'Shipped';
            order.shippingProvider = 'Fship';
            await order.save();
            return res.json({ message: 'Shipment Created Successfully', waybill: result.waybill, apiOrderId: result.apiorderid });
        } else {
            order.shippingStatus = 'Shipping Pending';
            await order.save();
            return res.status(400).json({ message: 'Fship API failed to create order', details: result });
        }

    } catch (error) {
        console.error('Create Shipment Error:', error);
        res.status(500).json({ message: 'Shipment creation failed', error: error.message, details: error.data });
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
    const { waybill } = req.params;
    try {
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
            res.status(404).json({ message: 'Tracking info not found', details: result });
        }
    } catch (error) {
        res.status(500).json({ message: 'Tracking error', error: error.message });
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
