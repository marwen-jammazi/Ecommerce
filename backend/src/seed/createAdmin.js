import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';

await mongoose.connect(process.env.MONGO_URI);

const email = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
const existing = await User.findOne({ email });

if (existing) {
  existing.role = 'admin';
  await existing.save({ validateBeforeSave: false });
  console.log(`Existing user ${email} promoted to admin`);
} else {
  await User.create({
    name: process.env.ADMIN_NAME || 'Admin',
    email,
    password: process.env.ADMIN_PASSWORD || 'Admin12345',
    role: 'admin',
  });
  console.log(`Admin created: ${email}`);
}

await mongoose.disconnect();