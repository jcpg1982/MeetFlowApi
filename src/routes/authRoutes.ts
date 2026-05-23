import { Router } from 'express';
import { register, login, refresh, logout, saveSocialUser } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/social', saveSocialUser);
router.post('/refresh', refresh);
router.post('/logout', authMiddleware, logout);
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

export default router;
