import express from 'express';
import { initiateCall, respondToCall, checkUserStatus, logCall, getCalls } from '../controllers/callController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/initiate', authMiddleware, initiateCall);
router.post('/respond', authMiddleware, respondToCall);
router.get('/status/:userId', authMiddleware, checkUserStatus);
router.post('/log', authMiddleware, logCall);
router.get('/logs', authMiddleware, getCalls);

export default router;
