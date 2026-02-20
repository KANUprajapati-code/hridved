import { createFshipOrder, checkFshipServiceability, trackFshipShipment } from '../utils/fshipService.js';
import fshipClient from '../utils/fshipService.js';
import Order from '../models/Order.js';

// @desc    Check Pincode Serviceability and Get Shipping Rates
// @route   POST /api/shipping/serviceability
// @access  Public
export const checkServiceability = async (req, res) => {
    const { pincode, weight = 0.5, cod = 0 } = req.body;

    // Default Shipping Options (Fallback)
    const defaultShippingOptions = [
        {
            type: 'Standard',
            days: '3-5',
            charge: 40,
            description: 'Standard Delivery',
        },
        {
            type: 'Express',
            days: '1-2',
            charge: 100,
            description: 'Express Delivery',
        }
    ];

    try {
        // Check if pincode is serviceable via FShip
        const fshipData = await checkFshipServiceability(pincode, weight, cod);

        // If Fship returns valid keys, use them, otherwise check serviceable flag
        // Some APIs might return success but saying "not serviceable"

        if (fshipData && fshipData.serviceable !== false) {
            const shippingOptions = [
                {
                    type: 'Standard',
                    days: '3-5',
                    charge: Math.min(40, Math.round(fshipData?.standard_charge || 40)),
                    description: 'Standard Delivery',
                },
                {
                    type: 'Express',
                    days: '1-2',
                    charge: Math.min(100, Math.round(fshipData?.express_charge || 100)),
                    description: 'Express Delivery',
                }
            ];

            return res.json({
                serviceable: true,
                shippingOptions: shippingOptions,
                pincode: pincode,
            });
        }
    } catch (error) {
        console.error('Fship Check Failed (Using Fallback):', error.message);
        // Fallback to default options on error, don't crash
    }

    // Return default options if Fship failed or not serviceable (could add flag to UI if needed)
    res.json({
        serviceable: true, // Allow order anyway with default shipping
        shippingOptions: defaultShippingOptions,
        pincode: pincode,
        warning: 'Standard shipping rates applied'
    });
};

// @desc    Create Shipment (Manual Trigger)
// @route   POST /api/shipping/create-shipment
// @access  Private/Admin
export const createShipment = async (req, res) => {
    const { orderId } = req.body;

    try {
        const order = await Order.findById(orderId).populate('user', 'name email');
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (order.shipmentId) return res.status(400).json({ message: 'Shipment already created' });

        const shipmentData = await createFshipOrder(order);

        if (shipmentData && shipmentData.success) {
            order.shipmentId = shipmentData.shipment_id;
            order.trackingId = shipmentData.awb_number;
            order.courierName = shipmentData.courier_name;
            order.shippingStatus = 'Shipped';
            await order.save();
            res.json({ message: 'Shipment Created', shipment: shipmentData });
        } else {
            res.status(400).json({ message: 'Failed to create shipment', details: shipmentData });
        }

    } catch (error) {
        res.status(500).json({ message: 'Shipment creation failed', error: error.message });
    }
};

// @desc    Track Shipment
// @route   GET /api/shipping/track/:orderId
// @access  Private
export const trackShipment = async (req, res) => {
    const { orderId } = req.params;

    try {
        const order = await Order.findById(orderId);
        if (!order || !order.trackingId) {
            return res.status(404).json({ message: 'Order or Tracking ID not found' });
        }

        const data = await trackFshipShipment(order.trackingId);
        res.json(data);

    } catch (error) {
        res.status(500).json({ message: 'Tracking failed', error: error.message });
    }
};

// @desc    Test FShip API Health
// @route   GET /api/shipping/health
// @access  Public
export const testFshipApi = async (req, res) => {
    const tests = {
        apiKey: !!process.env.FSHIP_API_KEY,
        baseUrl: process.env.FSHIP_BASE_URL || 'https://capi.fship.in',
        results: {},
    };

    try {
        // Test 1: Serviceability Check
        try {
            const serviceabilityResult = await checkFshipServiceability('560001', 0.5, 0);
            tests.results.serviceability = {
                status: 'success',
                data: serviceabilityResult,
            };
        } catch (error) {
            tests.results.serviceability = {
                status: 'failed',
                error: error.message || 'Unknown error',
                details: error.data,
            };
        }

        // Test 2: Test with another pincode
        try {
            const serviceabilityResult2 = await checkFshipServiceability('400001', 0.5, 0);
            tests.results.serviceability2 = {
                status: 'success',
                pincode: '400001',
                data: serviceabilityResult2,
            };
        } catch (error) {
            tests.results.serviceability2 = {
                status: 'failed',
                pincode: '400001',
                error: error.message || 'Unknown error',
            };
        }

        // Overall status
        const hasSuccessfulTest = Object.values(tests.results).some(
            (test) => test.status === 'success'
        );

        res.json({
            message: 'FShip API Health Check',
            timestamp: new Date().toISOString(),
            apiConfigured: tests.apiKey,
            baseUrl: tests.baseUrl,
            status: hasSuccessfulTest ? 'healthy' : 'unhealthy',
            tests: tests.results,
        });
    } catch (error) {
        res.status(500).json({
            message: 'FShip API Health Check Failed',
            timestamp: new Date().toISOString(),
            error: error.message,
            status: 'error',
        });
    }
};
