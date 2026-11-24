import { Router } from 'express';
import { z } from 'zod';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createStripeCheckout,
  createFlouciCheckout,
  verifyFlouci,
  flouciWebhook,
} from '../controllers/payment.controller.js';

const router = Router();

const orderIdSchema = z.object({ orderId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id') });

// the Stripe webhook is mounted in app.js (needs the raw body)
router.post('/stripe/checkout', protect, validate(orderIdSchema), createStripeCheckout);
router.post('/flouci/checkout', protect, validate(orderIdSchema), createFlouciCheckout);
router.post('/flouci/verify', protect, validate(orderIdSchema), verifyFlouci);
router.post('/flouci/webhook', flouciWebhook);

export default router;