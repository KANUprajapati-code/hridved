import express from 'express';
const router = express.Router();
import {
    getTips,
    getTipById,
    deleteTip,
    createTip,
    updateTip,
} from '../controllers/tipController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

router.route('/').get(getTips).post(protect, admin, createTip);
router
    .route('/:id')
    .get(getTipById)
    .delete(protect, admin, deleteTip)
    .put(protect, admin, updateTip);

export default router;
