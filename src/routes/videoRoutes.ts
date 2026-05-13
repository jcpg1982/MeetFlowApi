import { Router } from 'express';
import { getFeedVideos, getUserVideos, uploadVideo, toggleLike, toggleFavorite, getFollowersFeed, trackInteraction } from '../controllers/videoController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.get('/feed', getFeedVideos);
router.get('/followers', authMiddleware, getFollowersFeed);
router.post('/track', trackInteraction);
router.get('/user/:userId', getUserVideos);
router.post('/upload', authMiddleware, uploadVideo);
router.post('/:videoId/like', authMiddleware, toggleLike);
router.post('/:videoId/favorite', authMiddleware, toggleFavorite);

export default router;
