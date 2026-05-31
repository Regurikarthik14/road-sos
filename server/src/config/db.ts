import mongoose from 'mongoose';

let _isConnected = false;

export function isConnected(): boolean {
  return _isConnected;
}

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️  MONGODB_URI not set — running without database. Auth routes will return 503.');
    return;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    _isConnected = true;
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    console.warn('⚠️  Starting server without database. Auth routes will return 503.');
  }
}
