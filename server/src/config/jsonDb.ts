import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// =========================================================
// JSON File-based Database
// Replaces MongoDB — stores data in a local JSON file
// =========================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');
const DATA_FILE = join(DATA_DIR, 'db.json');

export interface JsonUser {
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
  resetTokenExpires?: number; // epoch ms
  createdAt: number; // epoch ms
  lastLoginAt: number; // epoch ms
}

export interface JsonOtp {
  _id: string;
  phone: string;
  code: string;
  expiresAt: number; // epoch ms
  createdAt: number; // epoch ms
}

interface JsonDatabase {
  users: JsonUser[];
  otps: JsonOtp[];
  nextId: number;
}

let _db: JsonDatabase | null = null;
let _lastId = 1;

function getDefaultDb(): JsonDatabase {
  return { users: [], otps: [], nextId: 1 };
}

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadDb(): JsonDatabase {
  ensureDir();
  try {
    if (existsSync(DATA_FILE)) {
      const raw = readFileSync(DATA_FILE, 'utf-8');
      const db = JSON.parse(raw) as JsonDatabase;
      _lastId = db.nextId || 1;
      return db;
    }
  } catch (err) {
    console.error('⚠️  Failed to read data file, starting fresh:', (err as Error).message);
  }
  const fresh = getDefaultDb();
  saveDbSync(fresh);
  return fresh;
}

function saveDbSync(db: JsonDatabase): void {
  ensureDir();
  db.nextId = _lastId;
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function getDb(): JsonDatabase {
  if (!_db) _db = loadDb();
  return _db;
}

function genId(): string {
  return String(_lastId++);
}

// =========================================================
// Public API — mirrors what the controllers expect
// =========================================================

export function initDb(): void {
  _db = loadDb();
  console.log(`📁 JSON database ready (${_db.users.length} users, ${_db.otps.length} OTPs)`);
}

export function isReady(): boolean {
  return _db !== null;
}

// ---- Users ----

export function findUserByEmail(email: string): JsonUser | undefined {
  return getDb().users.find(u => u.email?.toLowerCase() === email.toLowerCase());
}

export function findUserByPhone(phone: string): JsonUser | undefined {
  return getDb().users.find(u => u.phone === phone);
}

export function findUserById(id: string): JsonUser | undefined {
  return getDb().users.find(u => u._id === id);
}

export function findUserByResetToken(token: string): JsonUser | undefined {
  return getDb().users.find(u => u.resetToken === token && u.resetTokenExpires && u.resetTokenExpires > Date.now());
}

export function findUserByEmailOrPhone(email?: string, phone?: string): JsonUser | undefined {
  return getDb().users.find(u => {
    if (email && u.email?.toLowerCase() === email.toLowerCase()) return true;
    if (phone && u.phone === phone) return true;
    return false;
  });
}

export function createUser(data: Omit<JsonUser, '_id'>): JsonUser {
  const db = getDb();
  const user: JsonUser = { _id: genId(), ...data };
  db.users.push(user);
  saveDbSync(db);
  return user;
}

export function updateUser(id: string, updates: Partial<JsonUser>): JsonUser | undefined {
  const db = getDb();
  const idx = db.users.findIndex(u => u._id === id);
  if (idx === -1) return undefined;
  db.users[idx] = { ...db.users[idx], ...updates };
  saveDbSync(db);
  return db.users[idx];
}

export function getAllUsers(): JsonUser[] {
  return getDb().users;
}

// ---- OTPs ----

export function findOtp(phone: string, code: string): JsonOtp | undefined {
  cleanupExpiredOtps();
  return getDb().otps.find(o => o.phone === phone && o.code === code);
}

export function createOtp(data: Omit<JsonOtp, '_id'>): JsonOtp {
  const db = getDb();
  // Remove expired OTPs for this phone first
  db.otps = db.otps.filter(o => o.phone !== data.phone || o.expiresAt > Date.now());
  const otp: JsonOtp = { _id: genId(), ...data };
  db.otps.push(otp);
  saveDbSync(db);
  return otp;
}

export function deleteOtp(id: string): void {
  const db = getDb();
  db.otps = db.otps.filter(o => o._id !== id);
  saveDbSync(db);
}

export function cleanupExpiredOtps(): void {
  const db = getDb();
  const before = db.otps.length;
  db.otps = db.otps.filter(o => o.expiresAt > Date.now());
  if (db.otps.length !== before) saveDbSync(db);
}
