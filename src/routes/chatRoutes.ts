import { Router } from 'express';
import { getMessages, sendMessage, uploadChatFile, getConversations } from '../controllers/chatController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { uploadCloudinary } from '../utils/cloudinary';

const router = Router();

router.get('/conversations', authMiddleware, getConversations);
router.get('/messages/:otherUserId', authMiddleware, getMessages);
router.post('/send', authMiddleware, sendMessage);
router.post('/upload', authMiddleware, uploadCloudinary.single('file'), uploadChatFile);

export default router;
