import { Router } from 'express';
import { z } from 'zod';
import { protect, restrictTo } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createOrder,
  myOrders,
  getOrder,
  cancelMyOrder,
  listAllOrders,
  updateOrderStatus,
} from '../controllers/order.controller.js';

const router = Router();
router.use(protect);

const createSchema = z.object({
  paymentMethod: z.enum(['COD', 'ONLINE']),
  shippingAddress: z.object({
    fullName: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(6).max(20),
    street: z.string().trim().min(3).max(200),
    city: z.string().trim().min(2).max(80),
    postalCode: z.string().trim().max(20).optional(),
    country: z.string().trim().max(60).default('Tunisia'),
  }),
});

const statusSchema = z
  .object({
    orderStatus: z.enum(['Confirmed', 'Shipped', 'Delivered', 'Cancelled']).optional(),
    paymentStatus: z.enum(['Pending', 'Paid', 'Failed', 'Refunded']).optional(),
  })
  .refine((d) => d.orderStatus || d.paymentStatus, { message: 'Provide orderStatus or paymentStatus' });

// customer
router.post('/', validate(createSchema), createOrder);
router.get('/my', myOrders);

// admin (must stay before '/:id')
router.get('/', restrictTo('admin'), listAllOrders);
router.put('/:id/status', restrictTo('admin'), validate(statusSchema), updateOrderStatus);

// customer / admin
router.put('/:id/cancel', cancelMyOrder);
router.get('/:id', getOrder);

export default router;