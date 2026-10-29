import express from 'express';
import {
    getNotificationLogs,
    getProvidersStatus,
    runAbandonedCartSweep,
    registerOptOut,
} from '../controllers/notificationController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public opt-out route
router.post('/opt-out', registerOptOut);

// Admin-protected audit & automation routes
router.get('/logs', protect, admin, getNotificationLogs);
router.get('/providers', protect, admin, getProvidersStatus);
router.post('/abandoned-cart/run', protect, admin, runAbandonedCartSweep);

export default router;
