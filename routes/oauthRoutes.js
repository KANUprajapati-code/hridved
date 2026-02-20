import express from 'express';
import { googleAuth, facebookAuth, getAuthStatus } from '../controllers/oauthController.js';

const router = express.Router();

// OAuth endpoints
router.post('/google', googleAuth);
router.post('/facebook', facebookAuth);
router.get('/status', getAuthStatus);

export default router;
