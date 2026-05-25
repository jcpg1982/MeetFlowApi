import { Router } from 'express';
import { getUsers, getProfile, updateProfile, uploadMedia, updateFcmToken, followUser, getFollowers, getFollowing, logout } from '../controllers/userController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { uploadCloudinary } from '../utils/cloudinary';

const router = Router();

router.get('/', getUsers);
router.post('/upload', authMiddleware, uploadCloudinary.single('file'), uploadMedia);
router.get('/profile/:id?', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);
router.post('/fcm-token', authMiddleware, updateFcmToken);
router.post('/follow', authMiddleware, followUser);
router.get('/followers', authMiddleware, getFollowers);
router.get('/following', authMiddleware, getFollowing);
router.post('/logout', authMiddleware, logout);

export default router;
