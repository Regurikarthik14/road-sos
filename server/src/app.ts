import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { isConnected, getDBDiagnostics, connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';

const app = express();

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Request logger middleware for debugging
app.use((req, _res, next) => {
  console.log(`\n📥 ${req.method} ${req.url} - body:`, JSON.stringify(req.body));
  next();
});

// Middleware to ensure DB connection is active before executing database queries
app.use(async (req, res, next) => {
  // Allow health checks to proceed regardless of DB connection status
  if (req.path === '/api/health') {
    return next();
  }

  // If not connected, try to establish/await connection
  if (!isConnected()) {
    console.log(`📡 Database disconnected. Attempting to connect before processing ${req.method} ${req.url}...`);
    try {
      // Wait for a maximum of 4 seconds to establish the connection
      const connectionPromise = connectDB();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database connection timed out')), 4000)
      );
      await Promise.race([connectionPromise, timeoutPromise]);
    } catch (err: any) {
      console.error(`❌ DB connection check failed for ${req.method} ${req.url}:`, err.message);
      res.status(503).json({
        error: 'Database connection error',
        message: 'The database is currently unavailable. Please verify your MONGODB_URI environment variable and ensure your MongoDB Atlas IP Access List is configured correctly (e.g. allowing access from 0.0.0.0/0).',
        diagnostics: getDBDiagnostics(),
      });
      return;
    }
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Health check (shared by local server AND Vercel serverless)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    db: isConnected() ? 'connected' : 'disconnected',
    diagnostics: getDBDiagnostics(),
    timestamp: Date.now(),
  });
});

// Global error handler — prevents uncaught exceptions from crashing the function
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

export default app;
