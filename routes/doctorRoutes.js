import express from 'express';
const router = express.Router();
import {
    getDoctors,
    getDoctorById,
    deleteDoctor,
    updateDoctor,
    createDoctor,
} from '../controllers/doctorController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

router.route('/').get(getDoctors).post(protect, admin, createDoctor);
router
    .route('/:id')
    .get(getDoctorById)
    .delete(protect, admin, deleteDoctor)
    .put(protect, admin, updateDoctor);

export default router;
