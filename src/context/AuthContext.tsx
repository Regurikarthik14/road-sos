import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { AuthStep, TempRegistrationData, UserProfile } from '../types';
import * as api from '../api/client';

// =========================================================
// Auth Context Interface
// =========================================================

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;

  // Auth flow state
  authStep: AuthStep;
  setAuthStep: (step: AuthStep) => void;
  tempData: TempRegistrationData;
  setTempData: (data: TempRegistrationData) => void;

  // Auth operations
  login: (email: string, password: string) => Promise<void>;
  sendOtp: (email: string, phone: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<boolean>;
  createPassword: (password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, token: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;

  // Reset password URL params (for handling reset links from email)
  resetEmail: string | null;
  resetToken: string | null;

  // Error / success state
  error: string | null;
  successMessage: string | null;
  isProcessing: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// =========================================================
// Provider
// =========================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Auth flow state
  const [authStep, setAuthStep] = useState<AuthStep>('welcome');
  const [tempData, setTempData] = useState<TempRegistrationData>({
    email: '',
    phone: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resetEmail, setResetEmail] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  // Clear auto-dismissing messages
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(t);
  }, [successMessage]);

  // On mount: check for stored token and check for password reset URL params
  useEffect(() => {
    const init = async () => {
      // Check for password reset params in URL
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('resetToken');
      const urlEmail = params.get('email');

      if (urlToken && urlEmail) {
        setResetToken(urlToken);
        setResetEmail(decodeURIComponent(urlEmail));
        setAuthStep('reset-password');
        // Clean up URL without reloading
        window.history.replaceState({}, '', window.location.pathname);
        setLoading(false);
        return;
      }

      const token = api.getStoredToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const profile = await api.getProfile();
        setUser(profile);
        setIsAuthenticated(true);
      } catch {
        // Token expired or invalid — clear it
        api.logout();
      }
      setLoading(false);
    };
    init();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // =========================================================
  // Login
  // =========================================================
  const login = useCallback(async (email: string, password: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const { user: profile } = await api.login(email, password);
      setUser(profile);
      setIsAuthenticated(true);
      setSuccessMessage('Welcome back!');
    } catch (err: any) {
      const msg = err.message || 'Login failed. Please try again.';
      if (msg.includes('Invalid email or password')) {
        setError('Invalid email or password. Please try again.');
      } else if (msg.includes('Too many')) {
        setError('Too many attempts. Please try again later.');
      } else {
        setError(msg);
      }
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // =========================================================
  // Register — Step 1: Send OTP
  // =========================================================
  const sendOtp = useCallback(async (email: string, phone: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      setTempData({ email, phone });
      await api.sendOtp(email, phone);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('already registered')) {
        setError('This email is already registered. Please login instead.');
      } else if (msg.includes('phone number')) {
        setError('Please enter a valid phone number with country code.');
      } else {
        setError(msg || 'Failed to send verification code. Please try again.');
      }
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // =========================================================
  // Register — Step 2: Verify OTP
  // =========================================================
  const verifyOtp = useCallback(async (code: string): Promise<boolean> => {
    setIsProcessing(true);
    setError(null);
    try {
      await api.verifyOtp(tempData.phone, code);
      return true;
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Invalid')) {
        setError('Invalid verification code. Please check and try again.');
      } else if (msg.includes('expired')) {
        setError('Verification code expired. Please request a new one.');
      } else {
        setError(msg || 'Verification failed. Please try again.');
      }
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [tempData.phone]);

  // =========================================================
  // Register — Step 3: Create password
  // =========================================================
  const createPasswordFn = useCallback(async (password: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const { email, phone } = tempData;
      if (!email || !phone) {
        setError('Registration data not found. Please start again.');
        setIsProcessing(false);
        return;
      }
      const { user: profile } = await api.createPassword(email, phone, password);
      setUser(profile);
      setIsAuthenticated(true);
      setSuccessMessage(`Account created! Your unique ID: ${profile.uniqueId}`);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('already exists')) {
        setError('An account with this email or phone already exists.');
      } else if (msg.includes('at least 6')) {
        setError('Password should be at least 6 characters.');
      } else {
        setError(msg || 'Failed to create account. Please try again.');
      }
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [tempData]);

  // =========================================================
  // Forgot Password
  // =========================================================
  const forgotPassword = useCallback(async (email: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      await api.forgotPassword(email);
      setSuccessMessage('If an account exists, a password reset link has been sent.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // =========================================================
  // Reset Password (from email link)
  // =========================================================
  const resetPasswordFn = useCallback(async (email: string, token: string, password: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      await api.resetPassword(email, token, password);
      setSuccessMessage('Password reset successful! You can now login.');
      setAuthStep('login');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('expired')) {
        setError('This reset link has expired. Please request a new one.');
      } else if (msg.includes('Invalid')) {
        setError('Invalid reset link. Please request a new one.');
      } else {
        setError(err.message || 'Failed to reset password. Please try again.');
      }
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // =========================================================
  // Logout
  // =========================================================
  const logout = useCallback(async () => {
    api.logout();
    setUser(null);
    setIsAuthenticated(false);
    setAuthStep('welcome');
    setTempData({ email: '', phone: '' });
    setError(null);
    setSuccessMessage(null);
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    isAuthenticated,
    authStep,
    setAuthStep,
    tempData,
    setTempData,
    login,
    sendOtp,
    verifyOtp,
    createPassword: createPasswordFn,
    forgotPassword,
    resetPassword: resetPasswordFn,
    logout,
    clearError,
    error,
    successMessage,
    isProcessing,
    resetEmail,
    resetToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// =========================================================
// Hook
// =========================================================

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
