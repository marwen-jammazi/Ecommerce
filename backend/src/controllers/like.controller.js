import mongoose from 'mongoose';
import Like from '../models/Like.js';
import Product from '../models/Product.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';

const checkId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid product id', 400);
};

export const likeProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  checkId(id);
  if (!(await Product.exists({ _id: id }))) throw new AppError('Product not found', 404);

  try {
    await Like.create({ user: req.user._id, product: id });
    await Product.updateOne({ _id: id }, { $inc: { likesCount: 1 } });
  } catch (e) {
    if (e.code !== 11000) throw e; // already liked, ignore
  }
  res.json({ success: true, liked: true });
});

export const unlikeProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  checkId(id);

  const r = await Like.deleteOne({ user: req.user._id, product: id });
  if (r.deletedCount) await Product.updateOne({ _id: id }, { $inc: { likesCount: -1 } });
  res.json({ success: true, liked: false });
});

export const myLikes = asyncHandler(async (req, res) => {
  const likes = await Like.find({ user: req.user._id })
    .sort('-createdAt')
    .populate('product', 'name slug price discountPrice images ratingAvg stock')
    .lean();
  res.json({ success: true, data: likes.map((l) => l.product).filter(Boolean) });
});