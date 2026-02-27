import express from 'express';
import { getShippingConfig, updateShippingConfig } from '../controllers/configController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/shipping', getShippingConfig);
router.put('/shipping', protect, admin, updateShippingConfig);

export default router;
