import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';

// usage: npm run seed:admin            (creates the admin, or promotes the existing user)
//        npm run seed:admin -- --reset-password   (also sets the password from ADMIN_PASSWORD)
const resetPassword = process.argv.includes('--reset-password');
const email = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'Admin12345';

try {
  await connectDB(); // same connection code as the API, including the Atlas DNS workaround
  console.log(`Database: "${mongoose.connection.name}" on ${mongoose.connection.host}`);

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    await User.create({ name: process.env.ADMIN_NAME || 'Admin', email, password, role: 'admin' });
    console.log(`Admin created: ${email}`);
    console.log('Password: the ADMIN_PASSWORD value in your .env (default Admin12345)');
  } else {
    user.role = 'admin';
    if (resetPassword) user.password = password; // hashed by the model before saving
    await user.save();
    console.log(`${email} is now an admin${resetPassword ? ' and its password was reset' : ''}`);
  }
  console.log(`Users in this database: ${await User.countDocuments()}`);
} catch (e) {
  console.error('Seed failed:', e.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}