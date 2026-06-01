import jwt from 'jsonwebtoken';
import { type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Otp } from '../models/Otp.js';
import { sendSmsOtp, sendTwilioVerify, checkTwilioVerify } from '../services/sms.js';
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
      ? await User.findOne({ email: contact })
      : await User.findOne({ phone: contact });
    if (existingUser) {
      const label = isEmail ? 'This email' : 'This phone number';
      res.status(409).json({ error: `${label} is already registered. Please login instead.` });
      return;
    }
    const useTwilioVerify = !isEmail && !!process.env.TWILIO_VERIFY_SERVICE_SID;

    // Generate OTP
    const code = useTwilioVerify ? 'twilio_verify' : generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP with the contact as identifier
    await Otp.create({ phone: contact, code, expiresAt });

    // Always log OTP to console
    console.log(`\n🔐 OTP for ${contact}: ${code} (expires in 10 min)\n`);

    // Send OTP via the chosen method
    let deliveryFailed = false;
    let deliveryError = '';
    if (isEmail) {
      try {
        await sendEmailOtp(email, code);
      } catch (emailErr: any) {
        deliveryFailed = true;
        deliveryError = emailErr.message || 'Resend error';
        console.error('Email OTP failed:', emailErr);
        console.log('⚠️  Email not configured — use the OTP code printed above to verify');
      }
    } else if (useTwilioVerify) {
      try {
        await sendTwilioVerify(phone);
      } catch (verifyErr: any) {
        deliveryFailed = true;
        deliveryError = verifyErr.message || 'Twilio Verify error';
        console.error('Twilio Verify send failed:', verifyErr);
      }
    } else {
      try {
        await sendSmsOtp(phone, code);
      } catch (smsErr: any) {
        deliveryFailed = true;
        deliveryError = smsErr.message || 'Twilio error';
        console.warn('SMS failed:', smsErr);
        console.log('⚠️  SMS not configured — use the OTP code printed above to verify');
      }
    }

    const response: Record<string, unknown> = {
      message: 'Verification code sent',
      [isEmail ? 'email' : 'phone']: contact,
      deliveryFailed,
      deliveryError: deliveryFailed ? deliveryError : undefined,
    };

    if (deliveryFailed && useTwilioVerify) {
      const fallbackCode = generateOtpCode();
      await Otp.updateOne({ phone: contact, code: 'twilio_verify' }, { code: fallbackCode });
      response.devOtp = fallbackCode;
    } else {
      response.devOtp = useTwilioVerify ? 'Twilio Verify Active (SMS sent to device)' : code;
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

    const otpRecord = await Otp.findOne({ phone: contact });

    if (!otpRecord) {
      res.status(400).json({ error: 'Invalid verification code' });
      return;
    }

    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: otpRecord._id });
      res.status(400).json({ error: 'Verification code expired. Please request a new one.' });
      return;
    }

    if (otpRecord.code === 'twilio_verify') {
      try {
        const isApproved = await checkTwilioVerify(contact, code);
        if (!isApproved) {
          res.status(400).json({ error: 'Invalid verification code' });
          return;
        }
      } catch (verifyErr: any) {
        console.error('Twilio Verify check failed:', verifyErr);
        res.status(400).json({ error: verifyErr.message || 'Verification failed. Please check your code.' });
        return;
      }
    } else {
      if (otpRecord.code !== code) {
        res.status(400).json({ error: 'Invalid verification code' });
        return;
      }
    }

    // Clean up used OTP
    await Otp.deleteOne({ _id: otpRecord._id });

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
    const { email, phone, password, displayName, age, bloodType, emergencyContact } = req.body;
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
    const orConditions: Record<string, unknown>[] = [];
    if (email) orConditions.push({ email: email.toLowerCase().trim() });
    if (phone) orConditions.push({ phone });

    if (orConditions.length > 0) {
      const existing = await User.findOne({ $or: orConditions });
      if (existing) {
        res.status(409).json({ error: 'An account with this email or phone already exists' });
        return;
      }
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 12);
    const uniqueId = generateUniqueId();

    const userData: Record<string, unknown> = {
      password: hashedPassword,
      uniqueId,
      displayName: displayName || '',
      medicalInfo: {
        bloodType: bloodType || '',
        emergencyContact: emergencyContact || '',
        allergies: '',
        medications: '',
        age: age || '',
      },
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };
    if (email) userData.email = email.toLowerCase().trim();
    if (phone) userData.phone = phone;

    const user = await User.create(userData);

    const token = signToken({ uid: user._id.toString(), type: 'auth' });

    res.status(201).json({
      message: `Account created! Your unique ID: ${uniqueId}`,
      token,
      user: {
        uid: user._id.toString(),
        uniqueId: user.uniqueId,
        email: user.email || '',
        phone: user.phone || '',
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
        email: user.email || '',
        phone: user.phone || '',
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
        email: user.email || '',
        phone: user.phone || '',
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

// =========================================================
// PUT /api/auth/profile
// =========================================================
export async function updateProfile(req: Request, res: Response) {
  try {
    if (!req.user?.uid) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { displayName, age, bloodType, emergencyContact, allergies, medications } = req.body;

    const user = await User.findById(req.user.uid);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (displayName !== undefined) user.displayName = displayName;
    if (!user.medicalInfo) {
      user.medicalInfo = { bloodType: '', emergencyContact: '', allergies: '', medications: '', age: '' };
    }
    if (bloodType !== undefined) user.medicalInfo.bloodType = bloodType;
    if (emergencyContact !== undefined) user.medicalInfo.emergencyContact = emergencyContact;
    if (allergies !== undefined) user.medicalInfo.allergies = allergies;
    if (medications !== undefined) user.medicalInfo.medications = medications;
    if (age !== undefined) user.medicalInfo.age = age;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        uid: user._id.toString(),
        uniqueId: user.uniqueId,
        email: user.email || '',
        phone: user.phone || '',
        displayName: user.displayName,
        medicalInfo: user.medicalInfo,
        createdAt: user.createdAt.getTime(),
        lastLoginAt: user.lastLoginAt.getTime(),
      },
    });
  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}
