import { Router } from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { uploadSingleImage } from '../controllers/image.controller.js';

const router = Router();

router.post('/image', protect, restrictTo('admin'), upload.single('image'), uploadSingleImage);

export default router;