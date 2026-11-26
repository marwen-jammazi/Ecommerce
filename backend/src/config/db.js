import dns from 'node:dns';
import mongoose from 'mongoose';

// some routers/ISPs refuse the SRV lookup that mongodb+srv:// needs, so ask public DNS directly
if (process.env.MONGO_URI?.startsWith('mongodb+srv://')) {
  dns.setServers((process.env.MONGO_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(','));
}

export async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 8000,
  });
  console.log('[mongo] connected');
}