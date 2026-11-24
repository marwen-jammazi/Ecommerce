import { Router } from 'express';
import { z } from 'zod';
import { createLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { register, login, refresh, logout, me } from '../controllers/auth.controller.js';

const router = Router();

const authLimiter = createLimiter({ windowMs: 15 * 60 * 1000, limit: 20, prefix: 'auth' });

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', protect, me);

export default router;