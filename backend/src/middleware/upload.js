import multer from 'multer';
import AppError from '../utils/AppError.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

// files stay in memory and are streamed straight to Cloudinary (nothing is written to disk)
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) =>
    ALLOWED.has(file.mimetype)
      ? cb(null, true)
      : cb(new AppError('Only JPG, PNG or WebP images are allowed', 400)),
});