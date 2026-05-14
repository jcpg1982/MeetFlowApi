import { Router } from 'express';
import { getUsers, getProfile, updateProfile, uploadMedia, updateFcmToken, followUser } from '../controllers/userController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { upload } from '../utils/cloudinary';

const router = Router();

router.get('/', getUsers);
router.post('/upload', authMiddleware, upload.single('file'), uploadMedia);
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);
router.post('/fcm-token', authMiddleware, updateFcmToken);
router.post('/follow', authMiddleware, followUser);

export default router;
