import express from 'express';
import {
    getConcerns,
    getConcernBySlug,
    createConcern,
    updateConcern,
    deleteConcern,
} from '../controllers/concernController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(getConcerns)
    .post(protect, admin, createConcern);

router.route('/slug/:slug')
    .get(getConcernBySlug);

router.route('/:id')
    .put(protect, admin, updateConcern)
    .delete(protect, admin, deleteConcern);

export default router;

