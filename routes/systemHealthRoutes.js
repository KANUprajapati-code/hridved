import express from 'express';
import { runSystemAudit, autoFixSystemIssues } from '../controllers/systemHealthController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/audit', protect, admin, runSystemAudit);
router.post('/auto-fix', protect, admin, autoFixSystemIssues);

export default router;
