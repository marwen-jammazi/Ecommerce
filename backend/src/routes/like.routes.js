import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { likeProduct, unlikeProduct, myLikes } from '../controllers/like.controller.js';

const router = Router();

router.post('/products/:id/like', protect, likeProduct);
router.delete('/products/:id/like', protect, unlikeProduct);
router.get('/me/likes', protect, myLikes);

export default router;