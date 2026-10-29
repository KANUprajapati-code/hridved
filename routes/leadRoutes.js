import express from 'express';
import {
    trackLead,
    getLeadsAdmin,
    updateLeadAdmin,
    deleteLeadAdmin,
    exportLeadsCSV,
} from '../controllers/leadController.js';
import { protect, admin, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Tracking route - public or authenticated
router.post('/track', optionalAuth, trackLead);

// Admin routes
router.get('/admin', protect, admin, getLeadsAdmin);
router.get('/admin/export', protect, admin, exportLeadsCSV);
router.put('/admin/:id', protect, admin, updateLeadAdmin);
router.delete('/admin/:id', protect, admin, deleteLeadAdmin);

export default router;
