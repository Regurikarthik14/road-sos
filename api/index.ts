import app from '../server/src/app.js';
import { connectDB } from '../server/src/config/db.js';

// Initialize DB connection on cold start (catch errors so unhandled rejections don't crash the function)
connectDB().catch((err) => {
  console.error('MongoDB connection failed:', err);
});

export default app;
