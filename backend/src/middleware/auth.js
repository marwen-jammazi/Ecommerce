import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError('Not authenticated', 401);

  const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  const user = await User.findById(payload.id).select('name email role isBlocked').lean();
  if (!user) throw new AppError('User no longer exists', 401);
  if (user.isBlocked) throw new AppError('Account is blocked', 403);

  req.user = user;
  next();
});

export const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return next(new AppError('Forbidden', 403));
  next();
};