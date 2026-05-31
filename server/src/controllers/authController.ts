import jwt from 'jsonwebtoken';
import { type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  createUser,
  findUserByEmail,
  findUserByPhone,
  findUserById,
  findUserByResetToken,
  updateUser,
  createOtp,
  findOtp,
  deleteOtp,
} from '../config/jsonDb.js';
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
    const identifier = email || phone;

    if (!identifier) {
      res.status(400).json({ error: 'Email or phone number is required' });
      return;
    }

    const isEmail = !!email;
    const contact = isEmail ? email.toLowerCase().trim() : phone;

    // Check if already registered
    const existingUser = isEmail
      ? findUserByEmail(contact)
      : findUserByPhone(contact);
    if (existingUser) {
      const label = isEmail ? 'This email' : 'This phone number';
      res.status(409).json({ error: `${label} is already registered. Please login instead.` });
      return;
    }

    // Generate OTP
    const code = generateOtpCode();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP with the contact as identifier
    createOtp({ phone: contact, code, expiresAt, createdAt: Date.now() });

    // Always log OTP to console
    console.log(`\n🔐 OTP for ${contact}: ${code} (expires in 10 min)\n`);

    // Send OTP via the chosen method
    if (isEmail) {
      try {
        await sendEmailOtp(email, code);
      } catch (emailErr) {
        console.error('Email OTP failed:', emailErr);
        console.log('⚠️  Email not configured — use the OTP code printed above to verify');
      }
    } else {
      try {
        await sendSmsOtp(phone, code);
      } catch (smsErr) {
        console.warn('SMS failed:', smsErr);
        console.log('⚠️  SMS not configured — use the OTP code printed above to verify');
      }
    }

    const response: Record<string, unknown> = {
      message: 'Verification code sent',
      [isEmail ? 'email' : 'phone']: contact,
    };
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
    const { email, phone, code } = req.body;
    const contact = email || phone;

    if (!contact || !code) {
      res.status(400).json({ error: 'Email/phone and code are required' });
      return;
    }

    const otpRecord = findOtp(contact, code);

    if (!otpRecord) {
      res.status(400).json({ error: 'Invalid verification code' });
      return;
    }

    // Clean up used OTP
    deleteOtp(otpRecord._id);

    // Return temp token for password creation
    const tempToken = signTempToken({ uid: contact, type: 'temp' });

    res.json({ message: 'Verified', tempToken });
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
    const identifier = email || phone;

    if (!identifier || !password) {
      res.status(400).json({ error: 'Email/phone and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const isEmail = !!email;
    const contact = isEmail ? email.toLowerCase().trim() : phone;

    // Validate temp token
    const authHeader = req.headers.authorization;
    const tempToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!tempToken) {
      res.status(401).json({ error: 'Verification required. Please verify your OTP first.' });
      return;
    }
    try {
      const decoded = jwt.verify(tempToken, JWT_SECRET) as JwtPayload;
      if (decoded.type !== 'temp') {
        res.status(401).json({ error: 'Invalid verification token.' });
        return;
      }
      if (decoded.uid !== contact) {
        res.status(403).json({ error: 'Contact mismatch. Please verify again.' });
        return;
      }
    } catch {
      res.status(401).json({ error: 'Verification expired. Please verify again.' });
      return;
    }

    // Check for existing user
    if (email) {
      const existingByEmail = findUserByEmail(email.toLowerCase().trim());
      if (existingByEmail) {
        res.status(409).json({ error: 'An account with this email already exists' });
        return;
      }
    }
    if (phone) {
      const existingByPhone = findUserByPhone(phone);
      if (existingByPhone) {
        res.status(409).json({ error: 'An account with this phone already exists' });
        return;
      }
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 12);
    const uniqueId = generateUniqueId();

    const now = Date.now();
    const user = createUser({
      email: email ? email.toLowerCase().trim() : undefined,
      phone: phone || undefined,
      password: hashedPassword,
      uniqueId,
      displayName: '',
      medicalInfo: {
        bloodType: '',
        emergencyContact: '',
        allergies: '',
        medications: '',
      },
      createdAt: now,
      lastLoginAt: now,
    });

    const token = signToken({ uid: user._id, type: 'auth' });

    res.status(201).json({
      message: `Account created! Your unique ID: ${uniqueId}`,
      token,
      user: {
        uid: user._id,
        uniqueId: user.uniqueId,
        email: user.email || '',
        phone: user.phone || '',
        displayName: user.displayName,
        medicalInfo: user.medicalInfo,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
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
      user = findUserByEmail(email.toLowerCase().trim());
    } else {
      // Clean phone: strip everything except digits, prepend +
      const cleanPhone = '+' + email.replace(/[^0-9]/g, '');
      user = findUserByPhone(cleanPhone);
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
    updateUser(user._id, { lastLoginAt: Date.now() });

    const token = signToken({ uid: user._id, type: 'auth' });

    res.json({
      message: 'Welcome back!',
      token,
      user: {
        uid: user._id,
        uniqueId: user.uniqueId,
        email: user.email || '',
        phone: user.phone || '',
        displayName: user.displayName,
        medicalInfo: user.medicalInfo,
        createdAt: user.createdAt,
        lastLoginAt: Date.now(),
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

    const user = findUserByEmail(email.toLowerCase());
    if (!user) {
      // Don't reveal whether email exists — just respond success
      res.json({ message: 'If an account exists, a password reset link has been sent.' });
      return;
    }

    const resetToken = generateResetToken();
    updateUser(user._id, {
      resetToken,
      resetTokenExpires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

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

    const user = findUserByEmail(email.toLowerCase());
    if (!user || user.resetToken !== token || !user.resetTokenExpires || user.resetTokenExpires < Date.now()) {
      res.status(400).json({ error: 'Invalid or expired reset link' });
      return;
    }

    // Update password
    const hashedPassword = await bcrypt.hash(password, 12);
    updateUser(user._id, {
      password: hashedPassword,
      resetToken: undefined,
      resetTokenExpires: undefined,
    });

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

    const user = findUserById(req.user.uid);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        uid: user._id,
        uniqueId: user.uniqueId,
        email: user.email || '',
        phone: user.phone || '',
        displayName: user.displayName,
        medicalInfo: user.medicalInfo,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (err) {
    console.error('getProfile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
}
