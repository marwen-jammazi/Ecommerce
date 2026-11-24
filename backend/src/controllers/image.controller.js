import Product from '../models/Product.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { delByPrefix } from '../services/cache.js';
import { uploadImage, deleteImages } from '../services/cloudinary.js';

const MAX_IMAGES = 8;

// upload one image and get {url, publicId} back, to use when creating a new product
export const uploadSingleImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('No image uploaded (field name: image)', 400);
  const data = await uploadImage(req.file.buffer);
  res.status(201).json({ success: true, data });
});

// add up to 5 images to an existing product
export const addProductImages = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) throw new AppError('No images uploaded (field name: images)', 400);

  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  if (product.images.length + files.length > MAX_IMAGES) {
    throw new AppError(`A product can have at most ${MAX_IMAGES} images (it has ${product.images.length})`, 400);
  }

  const results = await Promise.allSettled(files.map((f) => uploadImage(f.buffer)));
  const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (ok.length !== files.length) {
    await deleteImages(ok); // all or nothing, no orphaned files
    throw new AppError('Image upload failed, nothing was saved', 502);
  }

  product.images.push(...ok);
  await product.save();
  await delByPrefix('products:');
  res.status(201).json({ success: true, data: product.images });
});

// DELETE /products/:id/images?publicId=ecommerce/products/abc123
export const removeProductImage = asyncHandler(async (req, res) => {
  const publicId = String(req.query.publicId || '');
  if (!publicId) throw new AppError('publicId query parameter is required', 400);

  const before = await Product.findOneAndUpdate(
    { _id: req.params.id, 'images.publicId': publicId },
    { $pull: { images: { publicId } } }
  );
  if (!before) throw new AppError('Image not found on this product', 404);

  await deleteImages([{ publicId }]);
  await delByPrefix('products:');
  const product = await Product.findById(req.params.id).select('images').lean();
  res.json({ success: true, data: product.images });
});

// PUT /products/:id/images/order  body: { "publicIds": [...] }  (first one is the main image)
export const reorderProductImages = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);

  const wanted = req.body.publicIds;
  const current = product.images.map((i) => i.publicId);
  if (
    wanted.length !== current.length ||
    new Set(wanted).size !== wanted.length ||
    !wanted.every((id) => current.includes(id))
  ) {
    throw new AppError('publicIds must list every current image exactly once', 400);
  }

  product.images = wanted.map((id) => product.images.find((i) => i.publicId === id));
  await product.save();
  await delByPrefix('products:');
  res.json({ success: true, data: product.images });
});