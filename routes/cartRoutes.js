
import express from 'express';
import {
    getCart,
    addToCart,
    removeFromCart,
    clearCart,
    mergeCart,
} from '../controllers/cartController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, getCart)
    .post(protect, addToCart)
    .delete(protect, clearCart);

router.post('/merge', protect, mergeCart);

router.route('/:id').delete(protect, removeFromCart);

export default router;
