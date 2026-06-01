import type { UserProfile } from '../types';

// On Vercel, API is served from the same domain under /api/*
// In dev, set VITE_API_URL=http://localhost:3001/api in .env
const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface ApiResponse<T = unknown> {
  message?: string;
  error?: string;
  data?: T;
  token?: string;
  tempToken?: string;
  user?: UserProfile;
}

class ApiError extends Error {
  status: number = 0;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('raksha-token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  let data: any = {};
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, data.error || 'Something went wrong');
  }

  return data;
}

// Store/retrieve temp token (used between OTP verify and password creation)
function getTempToken(): string | null {
  return sessionStorage.getItem('raksha-temp-token');
}

function setTempToken(token: string) {
  sessionStorage.setItem('raksha-temp-token', token);
}

function clearTempToken() {
  sessionStorage.removeItem('raksha-temp-token');
}

// Store/retrieve auth token
function getAuthToken(): string | null {
  return localStorage.getItem('raksha-token');
}

function setAuthToken(token: string) {
  localStorage.setItem('raksha-token', token);
}

function clearAuthToken() {
  localStorage.removeItem('raksha-token');
}

// =========================================================
// Auth API
// =========================================================

export async function sendOtp(email: string, phone: string) {
  const data = await request<{ phone: string }>('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email, phone }),
  });
  return data;
}

export async function verifyOtp(email: string, phone: string, code: string): Promise<string> {
  const data = await request<{ tempToken: string }>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, phone, code }),
  });
  if (data.tempToken) {
    setTempToken(data.tempToken);
  }
  return data.tempToken || '';
}

export async function createPassword(
  email: string,
  phone: string,
  password: string,
  profileData?: {
    displayName?: string;
    age?: string;
    bloodType?: string;
    emergencyContact?: string;
  }
): Promise<{ token: string; user: UserProfile }> {
  const tempToken = getTempToken();
  const headers: Record<string, string> = {};
  if (tempToken) {
    headers['Authorization'] = `Bearer ${tempToken}`;
  }

  const body: Record<string, any> = { password };
  if (email) body.email = email;
  if (phone) body.phone = phone;
  if (profileData) {
    if (profileData.displayName !== undefined) body.displayName = profileData.displayName;
    if (profileData.age !== undefined) body.age = profileData.age;
    if (profileData.bloodType !== undefined) body.bloodType = profileData.bloodType;
    if (profileData.emergencyContact !== undefined) body.emergencyContact = profileData.emergencyContact;
  }

  const data = await request<{ token: string; user: UserProfile }>(
    '/auth/create-password',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }
  );
  if (data.token) {
    setAuthToken(data.token);
  }
  clearTempToken();
  return { token: data.token!, user: data.user! };
}

export async function login(
  email: string,
  password: string
): Promise<{ token: string; user: UserProfile }> {
  const data = await request<{ token: string; user: UserProfile }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.token) {
    setAuthToken(data.token);
  }
  return { token: data.token!, user: data.user! };
}

export async function resetPassword(email: string, token: string, password: string) {
  const data = await request<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, token, password }),
  });
  return data;
}

export async function forgotPassword(email: string) {
  const data = await request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return data;
}

export async function getProfile(): Promise<UserProfile> {
  const data = await request<{ user: UserProfile }>('/auth/me');
  return data.user!;
}

export async function updateProfile(data: {
  displayName?: string;
  age?: string;
  bloodType?: string;
  emergencyContact?: string;
  allergies?: string;
  medications?: string;
}): Promise<{ user: UserProfile }> {
  const dataResponse = await request<{ user: UserProfile }>('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return { user: dataResponse.user! };
}

export function logout() {
  clearAuthToken();
  clearTempToken();
}

export function getStoredToken(): string | null {
  return getAuthToken();
}

export { ApiError };
