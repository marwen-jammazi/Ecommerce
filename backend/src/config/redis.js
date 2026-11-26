import Redis from 'ioredis';

let redis = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 500, 5000), // keeps retrying quietly in the background
  });

  // log an outage once, not on every retry
  let down = false;
  redis.on('error', (e) => {
    if (down) return;
    down = true;
    console.error(`[redis] unavailable (${e.code || e.message}), running without cache until it is back`);
  });
  redis.on('ready', () => {
    console.log(down ? '[redis] back online' : '[redis] connected');
    down = false;
  });
} else {
  console.log('[redis] REDIS_URL not set, caching disabled');
}

export default redis;