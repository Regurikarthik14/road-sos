import { Router } from 'express';
import {
  sendOtp,
  verifyOtp,
  createPassword,
  register,
  login,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
} from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/create-password', createPassword);
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);

export default router;

