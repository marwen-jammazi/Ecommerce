import { Router } from 'express';
import { z } from 'zod';
import { protect, restrictTo } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listReviews, listAllReviews, createReview, updateReview, deleteReview } from '../controllers/review.controller.js';

const router = Router();

const createSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).default(''),
});
const updateSchema = createSchema.partial();

router.get('/reviews', protect, restrictTo('admin'), listAllReviews); // admin: every review
router.get('/products/:id/reviews', listReviews);
router.post('/products/:id/reviews', protect, validate(createSchema), createReview);
router.put('/reviews/:id', protect, validate(updateSchema), updateReview);
router.delete('/reviews/:id', protect, deleteReview); // owner or admin

export default router;