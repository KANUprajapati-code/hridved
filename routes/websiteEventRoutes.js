import express from 'express';
import rateLimit from 'express-rate-limit';
import { collectWebsiteEvent, getWebsiteEventSummary } from '../controllers/websiteEventController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();
const collectLimit = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
router.post('/collect', collectLimit, collectWebsiteEvent);
router.get('/admin/summary', protect, admin, getWebsiteEventSummary);

export default router;
