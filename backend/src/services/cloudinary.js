import { v2 as cloudinary } from 'cloudinary';
import AppError from '../utils/AppError.js';

// with CLOUDINARY_URL set, the SDK configures itself
export const cloudinaryConfigured = () => Boolean(process.env.CLOUDINARY_URL);

export function cloudName() {
  try {
    return new URL(process.env.CLOUDINARY_URL).hostname;
  } catch {
    return null;
  }
}

export function uploadImage(buffer, folder = 'ecommerce/products') {
  if (!cloudinaryConfigured()) throw new AppError('Image storage is not configured', 503);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [{ width: 1600, height: 1600, crop: 'limit' }], // never store huge originals
      },
      (err, r) => {
        if (err) {
          console.error('[cloudinary] upload failed:', err.message);
          return reject(new AppError('Image upload failed', 502));
        }
        resolve({
          // f_auto,q_auto = WebP/AVIF + smart compression on delivery
          url: cloudinary.url(r.public_id, { secure: true, version: r.version, fetch_format: 'auto', quality: 'auto' }),
          publicId: r.public_id,
        });
      }
    );
    stream.end(buffer);
  });
}

// best effort: a failed cleanup must never break the request
export async function deleteImages(images = []) {
  if (!cloudinaryConfigured()) return;
  await Promise.allSettled(
    images.filter((i) => i?.publicId).map((i) => cloudinary.uploader.destroy(i.publicId))
  );
}