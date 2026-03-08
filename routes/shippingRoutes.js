import express from 'express';
import {
    checkServiceability,
    createShipment,
    trackShipment,
    getTrackingHistory,
    registerPickup,
    getLabels,
    createReverseOrder,
    testApi
} from '../controllers/shippingController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Health check
router.get('/health', testApi);

// Public/User routes
router.post('/serviceability', checkServiceability);
router.get('/track/:waybill', trackShipment);
router.get('/tracking-history/:waybill', getTrackingHistory);

// Protected Admin routes
router.post('/create-shipment', protect, admin, createShipment);
router.post('/register-pickup', protect, admin, registerPickup);
router.post('/labels', protect, admin, getLabels);
router.post('/reverse-order', protect, admin, createReverseOrder);

export default router;
