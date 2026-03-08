import express from 'express';
const router = express.Router();
import {
    getDoctorCategories,
    createDoctorCategory,
    deleteDoctorCategory
} from '../controllers/doctorCategoryController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

router.route('/').get(getDoctorCategories).post(protect, admin, createDoctorCategory);
router.route('/:id').delete(protect, admin, deleteDoctorCategory);

export default router;
