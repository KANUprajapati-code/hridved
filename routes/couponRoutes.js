import express from 'express';
const router = express.Router();
import {
    validateCoupon,
    getActiveCoupons,
    getCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon,
} from '../controllers/couponController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

router.get('/active', getActiveCoupons);
router.post('/validate', validateCoupon);

router.route('/')
    .get(protect, admin, getCoupons)
    .post(protect, admin, createCoupon);

router.route('/:id')
    .put(protect, admin, updateCoupon)
    .delete(protect, admin, deleteCoupon);

export default router;
