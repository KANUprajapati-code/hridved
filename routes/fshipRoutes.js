import express from 'express';
import * as fshipController from '../controllers/fshipController.js';

const router = express.Router();

// Defined routes for Fship
router.post('/create-order', fshipController.createOrder);
router.post('/tracking', fshipController.getTracking);
router.post('/summary', fshipController.getSummary);

export default router;
