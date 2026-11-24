import Redis from 'ioredis';

let redis = null;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });
  redis.on('error', (e) => console.error('[redis]', e.message));
  redis.on('connect', () => console.log('[redis] connected'));
} else {
  console.log('[redis] REDIS_URL not set, caching disabled');
}

export default redis;