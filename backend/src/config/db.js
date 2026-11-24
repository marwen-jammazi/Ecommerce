import mongoose from 'mongoose';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 5000,
  });
  console.log('[mongo] connected');
}