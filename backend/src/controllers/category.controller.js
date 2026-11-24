import Category from '../models/Category.js';
import Product from '../models/Product.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { delByPrefix } from '../services/cache.js';

export const listCategories = asyncHandler(async (req, res) => {
  const data = await Category.find().sort('name').lean();
  res.json({ success: true, data });
});

export const createCategory = asyncHandler(async (req, res) => {
  const data = await Category.create(req.body);
  await delByPrefix('categories:');
  res.status(201).json({ success: true, data });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const cat = await Category.findById(req.params.id);
  if (!cat) throw new AppError('Category not found', 404);
  cat.set(req.body);
  await cat.save();
  await delByPrefix('categories:');
  await delByPrefix('products:');
  res.json({ success: true, data: cat });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  if (await Product.exists({ category: req.params.id })) {
    throw new AppError('Category still has products', 409);
  }
  const cat = await Category.findByIdAndDelete(req.params.id);
  if (!cat) throw new AppError('Category not found', 404);
  await delByPrefix('categories:');
  res.json({ success: true, message: 'Category deleted' });
});