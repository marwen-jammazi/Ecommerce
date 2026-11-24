import { Router } from 'express';
import { z } from 'zod';
import { protect, restrictTo } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listUsers, updateUser } from '../controllers/user.controller.js';

const router = Router();
router.use(protect, restrictTo('admin'));

const updateSchema = z
  .object({ role: z.enum(['user', 'admin']).optional(), isBlocked: z.boolean().optional() })
  .refine((d) => d.role !== undefined || d.isBlocked !== undefined, { message: 'Nothing to update' });

router.get('/', listUsers);
router.put('/:id', validate(updateSchema), updateUser);

export default router;