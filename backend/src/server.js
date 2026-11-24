import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';
import redis from './config/redis.js';
import { connectDB } from './config/db.js';
import { startReleaseJob } from './jobs/releaseUnpaid.js';

for (const key of ['MONGO_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing env variable: ${key}`);
    process.exit(1);
  }
}

const PORT = process.env.PORT || 5000;

await connectDB();
const server = app.listen(PORT, () => console.log(`[api] listening on http://localhost:${PORT}`));
startReleaseJob();

async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down`);
  server.close(async () => {
    await mongoose.connection.close();
    if (redis) redis.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));