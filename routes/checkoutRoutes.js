import express from 'express';
import {
    createCheckoutOrder,
    getCheckoutOrder,
    confirmPayment,
} from '../controllers/checkoutController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // All checkout routes require authentication

router.post('/create-order', createCheckoutOrder);
router.get('/order/:orderId', getCheckoutOrder);
router.put('/confirm-payment/:orderId', confirmPayment);

export default router;
