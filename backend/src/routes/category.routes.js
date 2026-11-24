import { Router } from 'express';
import { z } from 'zod';
import { protect, restrictTo } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { cacheRoute } from '../middleware/cache.js';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller.js';

const router = Router();

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const base = z.object({
  name: z.string().trim().min(2).max(60),
  parent: objectId.nullable().optional(),
});

router.get('/', cacheRoute('categories', 3600), listCategories);
router.post('/', protect, restrictTo('admin'), validate(base), createCategory);
router.put('/:id', protect, restrictTo('admin'), validate(base.partial()), updateCategory);
router.delete('/:id', protect, restrictTo('admin'), deleteCategory);

export default router;