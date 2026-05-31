/**
 * JSON file-based database — no MongoDB needed.
 * Data stored in server/data/db.json, auto-created on first use.
 * On Vercel, data is ephemeral (resets on redeploy) — perfect for demos.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');
const DATA_FILE = join(DATA_DIR, 'db.json');

// ── Types ──────────────────────────────────────────────
export interface DbUser {
  _id: string;
  email?: string;
  phone?: string;
  password: string;
  uniqueId: string;
  displayName: string;
  medicalInfo: {
    bloodType: string;
    emergencyContact: string;
    allergies: string;
    medications: string;
  };
  resetToken?: string;
  resetTokenExpires?: number;
  createdAt: number;
  lastLoginAt: number;
}

export interface DbOtp {
  _id: string;
  phone: string;
  code: string;
  expiresAt: number;
  createdAt: number;
}

interface DbData {
  users: DbUser[];
  otps: DbOtp[];
}

// ── In-memory cache ────────────────────────────────────
let _db: DbData = { users: [], otps: [] };
let _ready = false;

// Auto-incrementing IDs
let _nextUserId = 1;
let _nextOtpId = 1;

// ── File helpers ───────────────────────────────────────
function ensureDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadDb(): DbData {
  ensureDir();
  if (!existsSync(DATA_FILE)) {
    const initial: DbData = { users: [], otps: [] };
    writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw) as DbData;
  } catch {
    return { users: [], otps: [] };
  }
}

function saveDb() {
  ensureDir();
  writeFileSync(DATA_FILE, JSON.stringify(_db, null, 2), 'utf-8');
}

// ── Init ───────────────────────────────────────────────
export function initDb() {
  _db = loadDb();

  // Compute next IDs
  if (_db.users.length > 0) {
    _nextUserId = Math.max(..._db.users.map((u) => parseInt(u._id))) + 1;
  }
  if (_db.otps.length > 0) {
    _nextOtpId = Math.max(..._db.otps.map((o) => parseInt(o._id))) + 1;
  }

  _ready = true;
  console.log(`📁 JSON DB loaded: ${_db.users.length} users, ${_db.otps.length} OTPs`);
}

export function isDbReady() {
  return _ready;
}

export function getDbDiagnostics() {
  return {
    connected: _ready,
    file: DATA_FILE,
    userCount: _db.users.length,
    otpCount: _db.otps.length,
  };
}

// ── User operations ────────────────────────────────────
export function createUser(data: {
  email?: string;
  phone?: string;
  password: string;
  uniqueId: string;
  displayName?: string;
  medicalInfo?: DbUser['medicalInfo'];
  createdAt?: number;
  lastLoginAt?: number;
}): DbUser {
  const now = Date.now();
  const user: DbUser = {
    _id: String(_nextUserId++),
    password: data.password,
    uniqueId: data.uniqueId,
    displayName: data.displayName || '',
    medicalInfo: data.medicalInfo || {
      bloodType: '',
      emergencyContact: '',
      allergies: '',
      medications: '',
    },
    createdAt: data.createdAt || now,
    lastLoginAt: data.lastLoginAt || now,
  };
  if (data.email) user.email = data.email;
  if (data.phone) user.phone = data.phone;

  _db.users.push(user);
  saveDb();
  return user;
}

export function findUserByEmail(email: string): DbUser | undefined {
  return _db.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
}

export function findUserByPhone(phone: string): DbUser | undefined {
  return _db.users.find((u) => u.phone === phone);
}

export function findUserById(id: string): DbUser | undefined {
  return _db.users.find((u) => u._id === id);
}

export function findUserByUniqueId(uniqueId: string): DbUser | undefined {
  return _db.users.find((u) => u.uniqueId === uniqueId);
}

export function findUserByResetToken(token: string): DbUser | undefined {
  const now = Date.now();
  return _db.users.find(
    (u) => u.resetToken === token && u.resetTokenExpires && u.resetTokenExpires > now
  );
}

export function updateUser(id: string, updates: Partial<DbUser>): DbUser | undefined {
  const idx = _db.users.findIndex((u) => u._id === id);
  if (idx === -1) return undefined;
  _db.users[idx] = { ..._db.users[idx], ...updates };
  saveDb();
  return _db.users[idx];
}

export function getAllUsers(): DbUser[] {
  return [..._db.users].sort((a, b) => b.createdAt - a.createdAt);
}

// ── OTP operations ─────────────────────────────────────
export function createOtp(data: { phone: string; code: string; expiresAt: number; createdAt: number }): DbOtp {
  cleanupExpiredOtps();
  const otp: DbOtp = {
    _id: String(_nextOtpId++),
    phone: data.phone,
    code: data.code,
    expiresAt: data.expiresAt,
    createdAt: data.createdAt,
  };
  _db.otps.push(otp);
  saveDb();
  return otp;
}

export function findOtp(phone: string, code: string): DbOtp | undefined {
  cleanupExpiredOtps();
  return _db.otps.find((o) => o.phone === phone && o.code === code && o.expiresAt > Date.now());
}

export function deleteOtp(id: string) {
  _db.otps = _db.otps.filter((o) => o._id !== id);
  saveDb();
}

function cleanupExpiredOtps() {
  const before = _db.otps.length;
  _db.otps = _db.otps.filter((o) => o.expiresAt > Date.now());
  if (_db.otps.length < before) saveDb();
}
