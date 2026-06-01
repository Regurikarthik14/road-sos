import mongoose from 'mongoose';

let _lastError: string | null = null;
let _connectionPromise: Promise<void> | null = null;

export function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export function getDBDiagnostics() {
  return {
    connected: isConnected(),
    readyState: mongoose.connection.readyState,
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

  // If already connected, resolve immediately
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // If currently connecting, return the existing connection promise
  if (mongoose.connection.readyState === 2 && _connectionPromise) {
    return _connectionPromise;
  }

  // Otherwise, create a new connection promise
  _connectionPromise = (async () => {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      _lastError = null;
      console.log('✅ Connected to MongoDB');
    } catch (err) {
      _lastError = (err as Error).message;
      console.error('❌ MongoDB connection error:', err);
      _connectionPromise = null; // Clear connection promise so we can retry on next request
      throw err;
    }
  })();

  return _connectionPromise;
}

