import express from 'express';
import { checkServiceability, createShipment, trackShipment, testFshipApi } from '../controllers/shippingController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Health check for fship API
router.get('/health', testFshipApi);

// Public route for checking serviceability and getting shipping rates
router.post('/serviceability', checkServiceability);

// Protected routes
router.post('/create-shipment', protect, admin, createShipment); // Typically admin triggers manually or webhook automatic
router.get('/track/:orderId', protect, trackShipment);

// Trigger restart: 1234
export default router;
