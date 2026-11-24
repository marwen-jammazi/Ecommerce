import { Router } from 'express';
import { z } from 'zod';
import { protect, restrictTo } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { cacheRoute } from '../middleware/cache.js';
import { upload } from '../middleware/upload.js';
import { cloudName } from '../services/cloudinary.js';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller.js';
import {
  addProductImages,
  removeProductImage,
  reorderProductImages,
} from '../controllers/image.controller.js';

const router = Router();

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

// when Cloudinary is configured, only images uploaded through our endpoints are accepted
const fromOurCloud = (u) => {
  const name = cloudName();
  return !name || u.startsWith(`https://res.cloudinary.com/${name}/`);
};

const base = z.object({
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().min(10).max(5000),
  price: z.number().positive(),
  discountPrice: z.number().positive().optional(),
  images: z
    .array(
      z.object({
        url: z.string().url().refine(fromOurCloud, 'Image must be uploaded through the upload endpoint'),
        publicId: z.string().min(1),
      })
    )
    .max(8)
    .default([]),
  category: objectId,
  stock: z.number().int().min(0).default(0),
  isActive: z.boolean().optional(),
});

const discountOk = (d) => d.discountPrice === undefined || d.price === undefined || d.discountPrice < d.price;
const discountMsg = { message: 'discountPrice must be lower than price', path: ['discountPrice'] };

const createSchema = base.refine(discountOk, discountMsg);
const updateSchema = base.partial().refine(discountOk, discountMsg);
const orderSchema = z.object({ publicIds: z.array(z.string().min(1)).min(1).max(8) });

// public
router.get('/', cacheRoute('products', 120), listProducts);
router.get('/:id', cacheRoute('products', 300), getProduct);

// admin: product CRUD
router.post('/', protect, restrictTo('admin'), validate(createSchema), createProduct);
router.put('/:id', protect, restrictTo('admin'), validate(updateSchema), updateProduct);
router.delete('/:id', protect, restrictTo('admin'), deleteProduct);

// admin: images (auth runs before the upload is parsed)
router.post('/:id/images', protect, restrictTo('admin'), upload.array('images', 5), addProductImages);
router.delete('/:id/images', protect, restrictTo('admin'), removeProductImage);
router.put('/:id/images/order', protect, restrictTo('admin'), validate(orderSchema), reorderProductImages);

export default router;