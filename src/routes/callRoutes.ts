import express from 'express';
import { initiateCall, respondToCall } from '../controllers/callController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/initiate', authMiddleware, initiateCall);
router.post('/respond', authMiddleware, respondToCall);

export default router;
