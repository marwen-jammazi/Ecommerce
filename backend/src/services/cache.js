import redis from '../config/redis.js';

export async function getCache(key) {
  if (!redis) return null;
  try {
    const v = await redis.get(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export async function setCache(key, value, ttl = 300) {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch {}
}

export async function delByPrefix(prefix) {
  if (!redis) return;
  try {
    const stream = redis.scanStream({ match: `${prefix}*`, count: 100 });
    for await (const keys of stream) {
      if (keys.length) await redis.del(keys);
    }
  } catch {}
}