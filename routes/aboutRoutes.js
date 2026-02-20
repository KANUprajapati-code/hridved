import express from 'express';
const router = express.Router();
import {
    getAbout,
    updateAbout,
} from '../controllers/aboutController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

router.route('/').get(getAbout).put(protect, admin, updateAbout);

export default router;
