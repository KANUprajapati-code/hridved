
import express from 'express';
import {
    addOrderItems,
    getOrderById,
    updateOrderToPaid,
    updateOrderToDelivered,
    updateOrderTracking,
    getMyOrders,
    getOrders,
    createWhatsAppOrder,
    trackOrder,
    cancelOrder,
} from '../controllers/orderController.js';
import { protect, admin, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/whatsapp').post(optionalAuth, createWhatsAppOrder);
router.route('/track').post(trackOrder);

router.route('/')
    .post(protect, addOrderItems)
    .get(protect, admin, getOrders);

router.route('/myorders').get(protect, getMyOrders);

router.route('/:id').get(protect, getOrderById);

router.route('/:id/pay').put(protect, updateOrderToPaid);
router.route('/:id/cancel').put(protect, cancelOrder);

router.route('/:id/deliver').put(protect, admin, updateOrderToDelivered);
router.route('/:id/tracking').put(protect, admin, updateOrderTracking);

export default router;
