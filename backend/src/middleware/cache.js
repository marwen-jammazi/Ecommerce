import { getCache, setCache } from '../services/cache.js';

// cache-aside for GET routes. prefix lets us invalidate groups of keys later.
export const cacheRoute = (prefix, ttl = 300) => async (req, res, next) => {
  if (req.method !== 'GET') return next();
  const key = `${prefix}:${req.originalUrl}`;

  const hit = await getCache(key);
  if (hit) {
    res.set('X-Cache', 'HIT');
    return res.json(hit);
  }

  res.set('X-Cache', 'MISS');
  const original = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200) setCache(key, body, ttl);
    return original(body);
  };
  next();
};