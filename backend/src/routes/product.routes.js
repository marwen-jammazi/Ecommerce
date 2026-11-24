import { Router } from 'express';
import { z } from 'zod';
import { protect, restrictTo } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { cacheRoute } from '../middleware/cache.js';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller.js';

const router = Router();

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const base = z.object({
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().min(10).max(5000),
  price: z.number().positive(),
  discountPrice: z.number().positive().optional(),
  images: z.array(z.object({ url: z.string().url(), publicId: z.string().optional() })).max(8).default([]),
  category: objectId,
  stock: z.number().int().min(0).default(0),
  isActive: z.boolean().optional(),
});

const discountOk = (d) => d.discountPrice === undefined || d.price === undefined || d.discountPrice < d.price;
const discountMsg = { message: 'discountPrice must be lower than price', path: ['discountPrice'] };

const createSchema = base.refine(discountOk, discountMsg);
const updateSchema = base.partial().refine(discountOk, discountMsg);

// public
router.get('/', cacheRoute('products', 120), listProducts);
router.get('/:id', cacheRoute('products', 300), getProduct);

// admin
router.post('/', protect, restrictTo('admin'), validate(createSchema), createProduct);
router.put('/:id', protect, restrictTo('admin'), validate(updateSchema), updateProduct);
router.delete('/:id', protect, restrictTo('admin'), deleteProduct);

export default router;