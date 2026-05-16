import { Router } from 'express';
import { getFeedVideos, getUserVideos, uploadVideo, upload, toggleLike, toggleFavorite, getFollowersFeed, trackInteraction, getFavoriteVideos } from '../controllers/videoController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.get('/feed', authMiddleware, getFeedVideos);
router.get('/followers', authMiddleware, getFollowersFeed);
router.get('/favorites', authMiddleware, getFavoriteVideos);
router.post('/track', authMiddleware, trackInteraction);
router.get('/user/:userId', getUserVideos);
router.post('/upload', authMiddleware, upload.single('video'), uploadVideo);
router.post('/:videoId/like', authMiddleware, toggleLike);
router.post('/:videoId/favorite', authMiddleware, toggleFavorite);

export default router;
