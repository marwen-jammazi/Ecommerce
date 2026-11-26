import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { delByPrefix } from '../services/cache.js';

export const listReviews = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid product id', 400);

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);

  const [data, total] = await Promise.all([
    Review.find({ product: id })
      .populate('user', 'name')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Review.countDocuments({ product: id }),
  ]);
  res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const createReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid product id', 400);
  if (!(await Product.exists({ _id: id }))) throw new AppError('Product not found', 404);

  const purchased = await Order.exists({
    user: req.user._id,
    orderStatus: 'Delivered',
    'items.product': id,
  });
  if (!purchased) throw new AppError('You can only review products you received', 403);

  if (await Review.exists({ user: req.user._id, product: id })) {
    throw new AppError('You already reviewed this product', 409);
  }

  const review = await Review.create({
    user: req.user._id,
    product: id,
    rating: req.body.rating,
    comment: req.body.comment,
  });
  await Review.recalc(id);
  await delByPrefix('products:');
  res.status(201).json({ success: true, data: review });
});

export const updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError('Review not found', 404);
  if (String(review.user) !== String(req.user._id)) throw new AppError('Forbidden', 403);

  review.set(req.body);
  await review.save();
  await Review.recalc(review.product);
  await delByPrefix('products:');
  res.json({ success: true, data: review });
});

export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError('Review not found', 404);

  const isOwner = String(review.user) === String(req.user._id);
  if (!isOwner && req.user.role !== 'admin') throw new AppError('Forbidden', 403);

  await review.deleteOne();
  await Review.recalc(review.product);
  await delByPrefix('products:');
  res.json({ success: true, message: 'Review deleted' });
});

// admin: every review in the store, newest first. Optional ?rating=1..5 and ?search=text
export const listAllReviews = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 50);

  const filter = {};
  const rating = parseInt(req.query.rating);
  if (rating >= 1 && rating <= 5) filter.rating = rating;
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
  if (search) filter.comment = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

  const [data, total] = await Promise.all([
    Review.find(filter)
      .populate('user', 'name email')
      .populate('product', 'name slug images')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
  ]);
  res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});
