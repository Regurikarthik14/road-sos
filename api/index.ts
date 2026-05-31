import app from '../server/src/app.js';
import { connectDB } from '../server/src/config/db.js';

// Initialize DB connection on cold start
connectDB();

export default app;
