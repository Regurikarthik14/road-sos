import { Router } from 'express';
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

const router = Router();

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/create-password', createPassword);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authenticateToken, getProfile);

export default router;
