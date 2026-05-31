import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import {
  sendOtp,
  verifyOtp,
  createPassword,
  login,
  forgotPassword,
  resetPassword,
  getProfile,
} from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
import { isConnected } from '../config/db.js';

const router = Router();

// Middleware: return 503 if database is not connected
function requireDB(_req: Request, res: Response, next: NextFunction): void {
  if (!isConnected()) {
    res.status(503).json({ error: 'Service unavailable — database not configured. Set MONGODB_URI environment variable and redeploy.' });
    return;
  }
  next();
}

router.post('/send-otp', requireDB, sendOtp);
router.post('/verify-otp', requireDB, verifyOtp);
router.post('/create-password', requireDB, createPassword);
router.post('/login', requireDB, login);
router.post('/forgot-password', requireDB, forgotPassword);
router.post('/reset-password', requireDB, resetPassword);
router.get('/me', authenticateToken, requireDB, getProfile);

export default router;
