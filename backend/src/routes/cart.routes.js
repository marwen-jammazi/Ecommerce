import { Router } from 'express';
import { z } from 'zod';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getCart, addItem, updateItem, removeItem, clearCart } from '../controllers/cart.controller.js';

const router = Router();
router.use(protect);

const addSchema = z.object({
  productId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id'),
  quantity: z.number().int().min(1).max(20).default(1),
});
const qtySchema = z.object({ quantity: z.number().int().min(1).max(20) });

router.get('/', getCart);
router.post('/items', validate(addSchema), addItem);
router.put('/items/:productId', validate(qtySchema), updateItem);
router.delete('/items/:productId', removeItem);
router.delete('/', clearCart);

export default router;