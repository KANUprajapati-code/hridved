import express from 'express';
import {
    createCheckoutOrder,
    getCheckoutOrder,
} from '../controllers/checkoutController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/create-order', optionalAuth, createCheckoutOrder);
router.get('/order/:orderId', optionalAuth, getCheckoutOrder);

export default router;
