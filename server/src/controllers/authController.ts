import jwt from 'jsonwebtoken';
import { type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Otp } from '../models/Otp.js';
import { sendSmsOtp } from '../services/sms.js';
import { sendResetEmail, sendEmailOtp } from '../services/email.js';
import { generateOtpCode, generateUniqueId, generateResetToken } from '../services/otpService.js';
import { signToken, signTempToken, JWT_SECRET } from '../middleware/auth.js';
import type { JwtPayload } from '../types/index.js';

// =========================================================
// POST /api/auth/send-otp
// =========================================================
export async function sendOtp(req: Request, res: Response) {
  try {
    const { email, phone } = req.body;

    if (!email || !phone) {
      res.status(400).json({ error: 'Email and phone are required' });
      return;
    }

    // Check if email already registered
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({ error: 'This email is already registered. Please login instead.' });
      return;
    }

    // Generate OTP
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in DB
    await Otp.create({ phone, code, expiresAt });

    // Always log OTP to console for development/testing
    console.log(`\n🔐 OTP for ${phone}: ${code} (expires in 10 min)\n`);

    // Send OTP via SMS
    try {
      await sendSmsOtp(phone, code);
    } catch (smsErr) {
      // If SMS fails, fall back to email OTP
      console.warn('SMS failed, sending OTP via email:', smsErr);
      try {
        await sendEmailOtp(email, code);
      } catch (emailErr) {
        console.error('Both SMS and email failed');
        console.log('⚠️  No SMS/email configured — use the OTP code printed above to verify');
        // Don't fail — let dev testing proceed with the console-printed code
      }
    }

    // In dev mode, return OTP in response for easy testing
    const response: Record<string, unknown> = { message: 'Verification code sent', phone };
    if (process.env.NODE_ENV !== 'production') {
      response.devOtp = code;
    }
    res.json(response);
  } catch (err) {
    console.error('sendOtp error:', err);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
}

// =========================================================
// POST /api/auth/verify-otp
// =========================================================
export async function verifyOtp(req: Request, res: Response) {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      res.status(400).json({ error: 'Phone and code are required' });
      return;
    }

    const otpRecord = await Otp.findOne({ phone, code });

    if (!otpRecord) {
      res.status(400).json({ error: 'Invalid verification code' });
      return;
    }

    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: otpRecord._id });
      res.status(400).json({ error: 'Verification code expired. Please request a new one.' });
      return;
    }

    // Clean up used OTP
    await Otp.deleteOne({ _id: otpRecord._id });

    // Return temp token for password creation
    const tempToken = signTempToken({ uid: phone, type: 'temp' });

    res.json({ message: 'Phone verified', tempToken });
  } catch (err) {
    console.error('verifyOtp error:', err);
    res.status(500).json({ error: 'Failed to verify code' });
  }
}

// =========================================================
// POST /api/auth/create-password
// =========================================================
export async function createPassword(req: Request, res: Response) {
  try {
    const { email, phone, password } = req.body;

    if (!email || !phone || !password) {
      res.status(400).json({ error: 'Email, phone, and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    // Validate temp token from Authorization header
    const authHeader = req.headers.authorization;
    const tempToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!tempToken) {
      res.status(401).json({ error: 'Phone verification required. Please verify your OTP first.' });
      return;
    }
    try {
      const decoded = jwt.verify(tempToken, JWT_SECRET) as JwtPayload;
      if (decoded.type !== 'temp') {
        res.status(401).json({ error: 'Invalid verification token.' });
        return;
      }
      // Ensure the phone in the token matches the request
      if (decoded.uid !== phone) {
        res.status(403).json({ error: 'Phone number mismatch. Please verify again.' });
        return;
      }
    } catch {
      res.status(401).json({ error: 'Verification expired. Please verify your phone again.' });
      return;
    }

    // Check for existing user again (in case of race condition)
    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }],
    });

    if (existing) {
      res.status(409).json({ error: 'An account with this email or phone already exists' });
      return;
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 12);
    const uniqueId = generateUniqueId();

    const user = await User.create({
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      uniqueId,
      displayName: '',
      medicalInfo: {
        bloodType: '',
        emergencyContact: '',
        allergies: '',
        medications: '',
      },
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });

    // Generate auth token
    const token = signToken({ uid: user._id.toString(), type: 'auth' });

    res.status(201).json({
      message: `Account created! Your unique ID: ${uniqueId}`,
      token,
      user: {
        uid: user._id.toString(),
        uniqueId: user.uniqueId,
        email: user.email,
        phone: user.phone,
        displayName: user.displayName,
        medicalInfo: user.medicalInfo,
        createdAt: user.createdAt.getTime(),
        lastLoginAt: user.lastLoginAt.getTime(),
      },
    });
  } catch (err) {
    console.error('createPassword error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
}

// =========================================================
// POST /api/auth/login
// =========================================================
export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email/phone and password are required' });
      return;
    }

    // Detect whether the input is an email or phone number
    const isEmail = email.includes('@');
    let user;

    if (isEmail) {
      user = await User.findOne({ email: email.toLowerCase().trim() });
    } else {
      // Clean phone: strip everything except digits, prepend +
      const cleanPhone = '+' + email.replace(/[^0-9]/g, '');
      user = await User.findOne({ phone: cleanPhone });
    }

    if (!user) {
      res.status(401).json({ error: 'Invalid email/phone or password' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email/phone or password' });
      return;
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken({ uid: user._id.toString(), type: 'auth' });

    res.json({
      message: 'Welcome back!',
      token,
      user: {
        uid: user._id.toString(),
        uniqueId: user.uniqueId,
        email: user.email,
        phone: user.phone,
        displayName: user.displayName,
        medicalInfo: user.medicalInfo,
        createdAt: user.createdAt.getTime(),
        lastLoginAt: user.lastLoginAt.getTime(),
      },
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
}

// =========================================================
// POST /api/auth/forgot-password
// =========================================================
export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal whether email exists — just respond success
      res.json({ message: 'If an account exists, a password reset link has been sent.' });
      return;
    }

    const resetToken = generateResetToken();
    user.resetToken = resetToken;
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}?resetToken=${resetToken}&email=${encodeURIComponent(email)}`;

    try {
      await sendResetEmail(email, resetLink);
    } catch (emailErr) {
      console.error('Failed to send reset email:', emailErr);
    }

    res.json({ message: 'If an account exists, a password reset link has been sent.' });
  } catch (err) {
    console.error('forgotPassword error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
}

// =========================================================
// POST /api/auth/reset-password
// =========================================================
export async function resetPassword(req: Request, res: Response) {
  try {
    const { email, token, password } = req.body;

    if (!email || !token || !password) {
      res.status(400).json({ error: 'Email, token, and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      resetToken: token,
      resetTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired reset link' });
      return;
    }

    // Update password
    user.password = await bcrypt.hash(password, 12);
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful. You can now login.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
}

// =========================================================
// GET /api/auth/me
// =========================================================
export async function getProfile(req: Request, res: Response) {
  try {
    if (!req.user?.uid) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await User.findById(req.user.uid);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        uid: user._id.toString(),
        uniqueId: user.uniqueId,
        email: user.email,
        phone: user.phone,
        displayName: user.displayName,
        medicalInfo: user.medicalInfo,
        createdAt: user.createdAt.getTime(),
        lastLoginAt: user.lastLoginAt.getTime(),
      },
    });
  } catch (err) {
    console.error('getProfile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
}
