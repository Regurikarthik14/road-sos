import app from '../server/src/app.js';
import { connectDB } from '../server/src/config/db.js';

// Initialize JSON DB on cold start — sync, no config needed
connectDB();

export default app;
