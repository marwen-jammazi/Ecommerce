import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);

  const filter = {};
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(String(req.query.search).slice(0, 50)), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  if (['user', 'admin'].includes(req.query.role)) filter.role = req.query.role;

  const [data, total] = await Promise.all([
    User.find(filter).select('name email role isBlocked createdAt').sort('-createdAt').skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const updateUser = asyncHandler(async (req, res) => {
  if (String(req.user._id) === req.params.id) {
    throw new AppError('You cannot change your own role or block yourself', 400);
  }
  const user = await User.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true })
    .select('name email role isBlocked')
    .lean();
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, data: user });
});