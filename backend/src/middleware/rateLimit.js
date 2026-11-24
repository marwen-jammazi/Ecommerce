import rateLimit from 'express-rate-limit';
import redis from '../config/redis.js';

class RedisLimitStore {
  constructor(prefix) {
    this.prefix = `rl:${prefix}:`;
  }
  init(options) {
    this.windowMs = options.windowMs;
  }
  async increment(key) {
    const k = this.prefix + key;
    const res = await redis.multi().incr(k).pttl(k).exec();
    const totalHits = Number(res[0][1]);
    let ttl = Number(res[1][1]);
    if (ttl < 0) {
      await redis.pexpire(k, this.windowMs);
      ttl = this.windowMs;
    }
    return { totalHits, resetTime: new Date(Date.now() + ttl) };
  }
  async decrement(key) {
    await redis.decr(this.prefix + key);
  }
  async resetKey(key) {
    await redis.del(this.prefix + key);
  }
}

export function createLimiter({ windowMs, limit, prefix }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true, // if Redis blips, let requests through instead of failing them
    ...(redis && { store: new RedisLimitStore(prefix) }),
  });
}