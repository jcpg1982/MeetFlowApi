import { Router } from 'express';
import { createRequest, getMyRequests, updateRequestStatus } from '../controllers/requestController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.post('/', createRequest);
router.get('/', getMyRequests);
router.put('/:id/status', updateRequestStatus);

export default router;
