import rateLimit from 'express-rate-limit';
import redis from '../config/redis.js';

// Used whenever Redis is not ready, so requests are still rate limited and the log stays quiet.
class MemoryCounter {
  constructor() {
    this.hits = new Map();
    setInterval(() => {
      const now = Date.now();
      for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    }, 60_000).unref();
  }
  increment(key, windowMs) {
    const now = Date.now();
    let e = this.hits.get(key);
    if (!e || e.resetAt <= now) {
      e = { totalHits: 0, resetAt: now + windowMs };
      this.hits.set(key, e);
    }
    e.totalHits++;
    return { totalHits: e.totalHits, resetTime: new Date(e.resetAt) };
  }
  decrement(key) {
    const e = this.hits.get(key);
    if (e && e.totalHits > 0) e.totalHits--;
  }
  resetKey(key) {
    this.hits.delete(key);
  }
}

// Counters live in Redis so every API instance shares one limit.
class RedisLimitStore {
  constructor(prefix) {
    this.prefix = `rl:${prefix}:`;
    this.mem = new MemoryCounter();
  }
  init(options) {
    this.windowMs = options.windowMs;
  }
  async increment(key) {
    if (redis.status === 'ready') {
      try {
        const k = this.prefix + key;
        const res = await redis.multi().incr(k).pttl(k).exec();
        if (!res || res[0][0] || res[1][0]) throw new Error('redis pipeline failed');
        const totalHits = Number(res[0][1]);
        let ttl = Number(res[1][1]);
        if (ttl < 0) {
          await redis.pexpire(k, this.windowMs);
          ttl = this.windowMs;
        }
        return { totalHits, resetTime: new Date(Date.now() + ttl) };
      } catch {
        /* fall through to the in-memory counter */
      }
    }
    return this.mem.increment(key, this.windowMs);
  }
  async decrement(key) {
    this.mem.decrement(key);
    if (redis.status === 'ready') await redis.decr(this.prefix + key).catch(() => {});
  }
  async resetKey(key) {
    this.mem.resetKey(key);
    if (redis.status === 'ready') await redis.del(this.prefix + key).catch(() => {});
  }
}

export function createLimiter({ windowMs, limit, prefix }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true,
    ...(redis && { store: new RedisLimitStore(prefix) }),
  });
}