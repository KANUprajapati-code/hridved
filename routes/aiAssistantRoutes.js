import express from 'express';
import { chatWithAssistant } from '../controllers/aiAssistantController.js';

const router = express.Router();

// POST /api/assistant/chat - Public endpoint to chat with Vaidya AI Guide
router.post('/chat', chatWithAssistant);

export default router;

