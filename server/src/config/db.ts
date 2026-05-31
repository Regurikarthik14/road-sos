import mongoose from 'mongoose';

let _isConnected = false;
let _lastError: string | null = null;

export function isConnected(): boolean {
  return _isConnected;
}

export function getDBDiagnostics() {
  return {
    connected: _isConnected,
    uriSet: !!process.env.MONGODB_URI,
    uriPrefix: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 20) + '...' : null,
    lastError: _lastError,
  };
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
    _lastError = (err as Error).message;
    console.error('❌ MongoDB connection error:', err);
    console.warn('⚠️  Starting server without database. Auth routes will return 503.');
  }
}
