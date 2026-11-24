import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export const signAccessToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });

export const signRefreshToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

export const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

const cookieOpts = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/v1/auth',
});

export const setRefreshCookie = (res, token) =>
  res.cookie('refreshToken', token, { ...cookieOpts(), maxAge: 7 * 24 * 60 * 60 * 1000 });

export const clearRefreshCookie = (res) => res.clearCookie('refreshToken', cookieOpts());