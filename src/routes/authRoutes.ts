import { Router } from 'express';
import { register, login, refresh, logout } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', authMiddleware, logout);

export default router;
