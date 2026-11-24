import { Router } from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import { cacheRoute } from '../middleware/cache.js';
import {
  summary,
  revenueSeries,
  paymentSplit,
  topProducts,
  revenueByCategory,
  insights,
  exportOrders,
} from '../controllers/dashboard.controller.js';

const router = Router();
router.use(protect, restrictTo('admin'));

// cached 60s in Redis (admin-only, so no private data leaks to other users)
const ttl = 60;
router.get('/summary', cacheRoute('dashboard', ttl), summary);
router.get('/revenue', cacheRoute('dashboard', ttl), revenueSeries);
router.get('/payment-split', cacheRoute('dashboard', ttl), paymentSplit);
router.get('/top-products', cacheRoute('dashboard', ttl), topProducts);
router.get('/categories', cacheRoute('dashboard', ttl), revenueByCategory);
router.get('/insights', cacheRoute('dashboard', ttl), insights);
router.get('/export', exportOrders);

export default router;