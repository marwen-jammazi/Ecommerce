import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  signAccessToken,
  signRefreshToken,
  hashToken,
  setRefreshCookie,
  clearRefreshCookie,
} from '../utils/tokens.js';

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role });

async function issueTokens(user, res) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });
  setRefreshCookie(res, refreshToken);
  return accessToken;
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.exists({ email })) throw new AppError('Email already registered', 409);

  const user = await User.create({ name, email, password, role: 'user' });
  const accessToken = await issueTokens(user, res);
  res.status(201).json({ success: true, accessToken, user: publicUser(user) });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password +refreshTokenHash');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }
  if (user.isBlocked) throw new AppError('Account is blocked', 403);

  const accessToken = await issueTokens(user, res);
  res.json({ success: true, accessToken, user: publicUser(user) });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw new AppError('No refresh token', 401);

  const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  const user = await User.findById(payload.id).select('+refreshTokenHash');
  if (!user || user.isBlocked) throw new AppError('Invalid session', 401);

  // rotation + reuse detection: a stale token kills the whole session
  if (user.refreshTokenHash !== hashToken(token)) {
    user.refreshTokenHash = undefined;
    await user.save({ validateBeforeSave: false });
    clearRefreshCookie(res);
    throw new AppError('Refresh token reuse detected', 401);
  }

  const accessToken = await issueTokens(user, res);
  res.json({ success: true, accessToken });
});

export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    const decoded = jwt.decode(token);
    if (decoded?.id) await User.updateOne({ _id: decoded.id }, { $unset: { refreshTokenHash: 1 } });
  }
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Logged out' });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});