import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { isConnected, getDBDiagnostics } from './config/db.js';
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
