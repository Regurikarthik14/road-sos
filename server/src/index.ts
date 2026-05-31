import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB, isConnected } from './config/db.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', db: isConnected() ? 'connected' : 'disconnected', timestamp: Date.now() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Start server
async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Raksha server running on port ${PORT}`);
  });
}

start().catch(console.error);
