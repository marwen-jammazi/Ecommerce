import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { delByPrefix } from '../services/cache.js';
import { deleteImages } from '../services/cloudinary.js';
import { deleteImages } from '../services/cloudinary.js';

const SORTS = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  rating: { ratingAvg: -1, ratingCount: -1 },
};

export const listProducts = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 50);

  const filter = { isActive: true };
  if (req.query.category && mongoose.isValidObjectId(req.query.category)) {
    filter.category = req.query.category;
  }
  if (req.query.search) filter.$text = { $search: String(req.query.search).slice(0, 100) };

  const min = Number(req.query.minPrice);
  const max = Number(req.query.maxPrice);
  if (!Number.isNaN(min) || !Number.isNaN(max)) {
    filter.price = {};
    if (!Number.isNaN(min) && req.query.minPrice !== undefined) filter.price.$gte = min;
    if (!Number.isNaN(max) && req.query.maxPrice !== undefined) filter.price.$lte = max;
    if (!Object.keys(filter.price).length) delete filter.price;
  }

  const sort = SORTS[req.query.sort] || SORTS.newest;

  const [data, total] = await Promise.all([
    Product.find(filter)
      .select('-__v')
      .populate('category', 'name slug')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const getProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = mongoose.isValidObjectId(id) ? { _id: id } : { slug: id };
  const data = await Product.findOne({ ...query, isActive: true })
    .populate('category', 'name slug')
    .lean();
  if (!data) throw new AppError('Product not found', 404);
  res.json({ success: true, data });
});

export const createProduct = asyncHandler(async (req, res) => {
  if (!(await Category.exists({ _id: req.body.category }))) {
    throw new AppError('Category does not exist', 400);
  }
  const data = await Product.create(req.body);
  await delByPrefix('products:');
  res.status(201).json({ success: true, data });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);

  if (req.body.category && !(await Category.exists({ _id: req.body.category }))) {
    throw new AppError('Category does not exist', 400);
  }
  product.set(req.body);
  if (product.discountPrice !== undefined && product.discountPrice >= product.price) {
    throw new AppError('discountPrice must be lower than price', 400);
  }
  await product.save();
  await delByPrefix('products:');
  res.json({ success: true, data: product });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (product) await deleteImages(product.images);
  if (product) await deleteImages(product.images);
  if (!product) throw new AppError('Product not found', 404);
  await delByPrefix('products:');
  res.json({ success: true, message: 'Product deleted' });
});