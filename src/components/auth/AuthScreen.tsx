import { useState, useCallback, useEffect, type FormEvent, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';

// =========================================================
// Country Code data for phone input
// =========================================================

interface CountryCode {
  code: string;
  flag: string;
  name: string;
}

const COUNTRY_CODES: CountryCode[] = [
  { code: '+1', flag: '🇺🇸', name: 'US' },
  { code: '+1', flag: '🇨🇦', name: 'CA' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+86', flag: '🇨🇳', name: 'China' },
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+81', flag: '🇯🇵', name: 'Japan' },
  { code: '+55', flag: '🇧🇷', name: 'Brazil' },
  { code: '+7', flag: '🇷🇺', name: 'Russia' },
  { code: '+82', flag: '🇰🇷', name: 'Korea' },
  { code: '+39', flag: '🇮🇹', name: 'Italy' },
  { code: '+34', flag: '🇪🇸', name: 'Spain' },
  { code: '+31', flag: '🇳🇱', name: 'Netherlands' },
  { code: '+46', flag: '🇸🇪', name: 'Sweden' },
  { code: '+41', flag: '🇨🇭', name: 'Switzerland' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+52', flag: '🇲🇽', name: 'Mexico' },
  { code: '+63', flag: '🇵🇭', name: 'Philippines' },
  { code: '+27', flag: '🇿🇦', name: 'South Africa' },
];

// =========================================================
// AuthScreen — orchestrates the entire auth flow
// =========================================================

export default function AuthScreen() {
  const {
    authStep,
    setAuthStep,
    error,
    successMessage,
    clearError,
  } = useAuth();

  return (
    <div style={styles.container}>
      {/* Background gradient decoration */}
      <div style={styles.bgGlow} />

      {/* Top branding */}
      <div style={styles.brandArea}>
        <div style={styles.logoContainer}>
          <span style={styles.logoEmoji}>🛡️</span>
        </div>
        <h1 style={styles.appName}>Raksha</h1>
        <p style={styles.tagline}>Your safety companion on the road</p>
      </div>

      {/* Error / Success messages */}
      {error && (
        <div style={styles.errorBanner}>
          <span>⚠️</span>
          <span style={styles.errorText}>{error}</span>
          <button style={styles.dismissBtn} onClick={clearError}>✕</button>
        </div>
      )}
      {successMessage && (
        <div style={styles.successBanner}>
          <span>✓</span>
          <span style={styles.errorText}>{successMessage}</span>
        </div>
      )}

      {/* Auth Step Panel */}
      <div style={styles.panel}>
        {authStep === 'welcome' && <WelcomeView onGetStarted={() => setAuthStep('register')} onLogin={() => setAuthStep('login')} />}
        {authStep === 'login' && <LoginView />}
        {authStep === 'register' && <RegisterView />}
        {authStep === 'otp-verify' && <OTPVerifyView />}
        {authStep === 'create-password' && <CreatePasswordView />}
        {authStep === 'forgot-password' && <ForgotPasswordView />}
        {authStep === 'reset-sent' && <ResetSentView />}
        {authStep === 'reset-password' && <ResetPasswordFromEmailView />}
      </div>
    </div>
  );
}

// =========================================================
// Welcome View
// =========================================================

function WelcomeView({ onGetStarted, onLogin }: { onGetStarted: () => void; onLogin: () => void }) {
  return (
    <div style={styles.viewContainer}>
      <div style={styles.heroIcon}>🚗</div>
      <h2 style={styles.viewTitle}>Welcome to Raksha</h2>
      <p style={styles.viewDescription}>
        Real-time emergency response, crash detection, and AI-powered roadside assistance — all in one app.
      </p>

      <div style={styles.featureList}>
        {[
          { icon: '🆘', text: 'Instant SOS dispatch' },
          { icon: '📍', text: 'Real-time location sharing' },
          { icon: '💬', text: 'AI-powered roadside help' },
          { icon: '🏥', text: 'Medical info for first responders' },
        ].map((f, i) => (
          <div key={i} style={styles.featureRow}>
            <span style={styles.featureIcon}>{f.icon}</span>
            <span style={styles.featureText}>{f.text}</span>
          </div>
        ))}
      </div>

      <button style={styles.primaryBtn} onClick={onGetStarted} aria-label="Create an account">
        Create Account
      </button>
      <button style={styles.secondaryBtn} onClick={onLogin} aria-label="Login to existing account">
        Already have an account? <span style={styles.secondaryAccent}>Log In</span>
      </button>
    </div>
  );
}

// =========================================================
// Login View
// =========================================================

function LoginView() {
  const { login, isProcessing, setAuthStep } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    try {
      await login(identifier.trim(), password);
    } catch {
      // Error is handled in AuthContext
    }
  }, [identifier, password, login]);

  const isEmail = identifier.includes('@');
  const inputType = isEmail || !identifier ? 'email' : 'tel';

  return (
    <div style={styles.viewContainer}>
      <button style={styles.backBtn} onClick={() => setAuthStep('welcome')} aria-label="Go back">
        ← Back
      </button>
      <h2 style={styles.viewTitle}>Welcome Back</h2>
      <p style={styles.viewDescription}>Sign in to your account</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.inputLabel}>Email or Phone</label>
          <input
            style={styles.input}
            type={inputType}
            placeholder="your@email.com or phone number"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
          {!isEmail && identifier.length > 0 && identifier.length < 5 && (
            <span style={styles.inputHint}>Enter your full phone number with country code (e.g. +1XXXXXXXXXX)</span>
          )}
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.inputLabel}>Password</label>
          <div style={styles.passwordWrapper}>
            <input
              style={styles.inputPassword}
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              style={styles.eyeBtn}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          style={{
            ...styles.primaryBtn,
            ...(isProcessing ? styles.btnDisabled : {}),
            width: '100%',
          }}
          disabled={isProcessing}
        >
          {isProcessing ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <button
        style={styles.linkBtn}
        onClick={() => setAuthStep('forgot-password')}
      >
        Forgot password?
      </button>

      <button style={styles.secondaryBtn} onClick={() => setAuthStep('register')}>
        Don't have an account? <span style={styles.secondaryAccent}>Sign Up</span>
      </button>
    </div>
  );
}

// =========================================================
// Register View — Facebook-style: sign up with email OR phone
// =========================================================

type RegisterMethod = 'email' | 'phone';

function RegisterView() {
  const { sendOtp, isProcessing, setAuthStep } = useAuth();
  const [method, setMethod] = useState<RegisterMethod>('email');
  const [email, setEmail] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [localError, setLocalError] = useState('');
  const countryPickerRef = useRef<HTMLDivElement>(null);

  const handleCountrySelect = (cc: CountryCode) => {
    setSelectedCountry(cc);
    setShowCountryPicker(false);
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '');
    setPhoneDigits(formatPhone(digits));
  };

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (method === 'email') {
      if (!email.trim()) return;
      if (!email.includes('@') || !email.includes('.')) {
        setLocalError('Please enter a valid email address.');
        return;
      }
      try {
        await sendOtp(email.trim(), '');
        setAuthStep('otp-verify');
      } catch {
        // Error handled in AuthContext
      }
    } else {
      if (!phoneDigits.trim()) return;
      const digits = phoneDigits.replace(/\D/g, '');
      if (digits.length < 7) {
        setLocalError('Please enter a complete phone number.');
        return;
      }
      const fullPhone = `${selectedCountry.code}${digits}`;
      try {
        await sendOtp('', fullPhone);
        setAuthStep('otp-verify');
      } catch {
        // Error handled in AuthContext
      }
    }
  }, [method, email, phoneDigits, selectedCountry, sendOtp, setAuthStep]);

  const filteredCodes = COUNTRY_CODES;

  return (
    <div style={styles.viewContainer}>
      <button style={styles.backBtn} onClick={() => setAuthStep('welcome')} aria-label="Go back">
        ← Back
      </button>
      <h2 style={styles.viewTitle}>Create Account</h2>
      <p style={styles.viewDescription}>Sign up with your email or phone number</p>

      {/* Method toggle tabs */}
      <div style={styles.toggleRow}>
        <button
          style={{
            ...styles.toggleTab,
            ...(method === 'email' ? styles.toggleTabActive : {}),
          }}
          onClick={() => setMethod('email')}
        >
          📧 Email
        </button>
        <button
          style={{
            ...styles.toggleTab,
            ...(method === 'phone' ? styles.toggleTabActive : {}),
          }}
          onClick={() => setMethod('phone')}
        >
          📱 Phone
        </button>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        {method === 'email' ? (
          <div style={styles.inputGroup}>
            <label style={styles.inputLabel}>Email Address</label>
            <input
              style={styles.input}
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
            />
            <span style={styles.inputHint}>We'll send a verification code to your email</span>
          </div>
        ) : (
          <div style={styles.inputGroup}>
            <label style={styles.inputLabel}>Phone Number</label>
            <div style={styles.phoneWrapper}>
              {/* Country Code Picker */}
              <div ref={countryPickerRef} style={styles.countryPickerWrapper}>
                <button
                  type="button"
                  style={styles.countryPickerBtn}
                  onClick={() => setShowCountryPicker(!showCountryPicker)}
                >
                  <span style={styles.countryFlag}>{selectedCountry.flag}</span>
                  <span style={styles.countryCodeText}>{selectedCountry.code}</span>
                  <span style={styles.dropdownArrow}>{showCountryPicker ? '▲' : '▼'}</span>
                </button>
                {showCountryPicker && (
                  <div style={styles.countryDropdown}>
                    {filteredCodes.map((cc, i) => (
                      <button
                        key={`${cc.code}-${cc.name}-${i}`}
                        type="button"
                        style={{
                          ...styles.countryOption,
                          ...(selectedCountry.code === cc.code && selectedCountry.name === cc.name
                            ? styles.countryOptionActive
                            : {}),
                        }}
                        onClick={() => handleCountrySelect(cc)}
                      >
                        <span style={styles.countryFlag}>{cc.flag}</span>
                        <span style={styles.countryName}>{cc.name}</span>
                        <span style={styles.countryCodeOption}>{cc.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Phone number input */}
              <input
                style={styles.inputPhone}
                type="tel"
                placeholder="(555) 000-0000"
                value={phoneDigits}
                onChange={(e) => handlePhoneChange(e.target.value)}
                autoComplete="tel-national"
                autoFocus
                required
              />
            </div>
            <span style={styles.inputHint}>We'll send a verification code via SMS to {selectedCountry.code}</span>
          </div>
        )}

        {localError && <div style={styles.localError}>{localError}</div>}

        <button
          type="submit"
          style={{
            ...styles.primaryBtn,
            ...(isProcessing ? styles.btnDisabled : {}),
            width: '100%',
          }}
          disabled={isProcessing}
        >
          {isProcessing ? 'Sending Code...' : 'Send Verification Code'}
        </button>
      </form>

      <button style={styles.secondaryBtn} onClick={() => setAuthStep('login')}>
        Already have an account? <span style={styles.secondaryAccent}>Log In</span>
      </button>
    </div>
  );
}

// =========================================================
// OTP Verify View
// =========================================================

function OTPVerifyView() {
  const { verifyOtp, isProcessing, setAuthStep, tempData, sendOtp } = useAuth();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // If devOtp is available (email/SMS not configured), auto-fill it
  const [autoFilled, setAutoFilled] = useState(false);
  useEffect(() => {
    if (tempData.devOtp && !autoFilled) {
      setOtp(tempData.devOtp.split(''));
      setAutoFilled(true);
    }
  }, [tempData.devOtp, autoFilled]);

  const handleDigitChange = useCallback((index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [otp]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [otp]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) return;

    try {
      const verified = await verifyOtp(code);
      if (verified) {
        setAuthStep('create-password');
      }
    } catch {
      // Error handled in AuthContext
    }
  }, [otp, verifyOtp, setAuthStep]);

  const handleResend = useCallback(async () => {
    try {
      await sendOtp(tempData.email, tempData.phone);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch {
      // Error handled in AuthContext
    }
  }, [tempData, sendOtp]);

  const isEmailReg = !!tempData.email;
  const verifyTarget = isEmailReg ? tempData.email : tempData.phone;
  const verifyLabel = isEmailReg ? 'Email' : 'Phone';

  return (
    <div style={styles.viewContainer}>
      <button style={styles.backBtn} onClick={() => setAuthStep('register')} aria-label="Go back">
        ← Back
      </button>

      <div style={styles.otpIcon}>{isEmailReg ? '✉️' : '📱'}</div>
      <h2 style={styles.viewTitle}>Verify {verifyLabel}</h2>
      <p style={styles.viewDescription}>
        {tempData.devOtp
          ? 'Demo mode — the code is pre-filled below. Click Verify to continue.'
          : <>Enter the 6-digit code sent to <strong>{verifyTarget}</strong></>
        }
      </p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.otpRow}>
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              style={styles.otpInput}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              autoFocus={i === 0}
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>

        <button
          type="submit"
          style={{
            ...styles.primaryBtn,
            ...(isProcessing || otp.join('').length !== 6 ? styles.btnDisabled : {}),
            width: '100%',
          }}
          disabled={isProcessing || otp.join('').length !== 6}
        >
          {isProcessing ? 'Verifying...' : 'Verify Code'}
        </button>
      </form>

      <button style={styles.linkBtn} onClick={handleResend} disabled={isProcessing}>
        Resend code
      </button>
    </div>
  );
}

// =========================================================
// Create Password View
// =========================================================

function CreatePasswordView() {
  const { createPassword, isProcessing, setAuthStep } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localError, setLocalError] = useState('');

  const strength = getPasswordStrength(password);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    try {
      await createPassword(password);
    } catch {
      // Error handled in AuthContext
    }
  }, [password, confirmPassword, createPassword]);

  return (
    <div style={styles.viewContainer}>
      <button style={styles.backBtn} onClick={() => setAuthStep('otp-verify')} aria-label="Go back">
        ← Back
      </button>

      <div style={styles.otpIcon}>🔐</div>
      <h2 style={styles.viewTitle}>Create Password</h2>
      <p style={styles.viewDescription}>Set a secure password for your account</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.inputLabel}>Password</label>
          <div style={styles.passwordWrapper}>
            <input
              style={styles.inputPassword}
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
              required
            />
            <button
              type="button"
              style={styles.eyeBtn}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
          {password && (
            <div style={styles.strengthBar}>
              <div
                style={{
                  ...styles.strengthFill,
                  width: `${strength.percent}%`,
                  background: strength.color,
                }}
              />
            </div>
          )}
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.inputLabel}>Confirm Password</label>
          <div style={styles.passwordWrapper}>
            <input
              style={{
                ...styles.inputPassword,
                ...(confirmPassword && password !== confirmPassword ? styles.inputError : {}),
              }}
              type={showConfirm ? 'text' : 'password'}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              style={styles.eyeBtn}
              onClick={() => setShowConfirm(!showConfirm)}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? '🙈' : '👁️'}
            </button>
          </div>
          {confirmPassword && password !== confirmPassword && (
            <span style={styles.fieldError}>Passwords do not match</span>
          )}
        </div>

        {localError && <div style={styles.localError}>{localError}</div>}

        <button
          type="submit"
          style={{
            ...styles.primaryBtn,
            ...(isProcessing ? styles.btnDisabled : {}),
            width: '100%',
          }}
          disabled={isProcessing || !password || !confirmPassword}
        >
          {isProcessing ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}

// =========================================================
// Forgot Password View
// =========================================================

function ForgotPasswordView() {
  const { forgotPassword, isProcessing, setAuthStep } = useAuth();
  const [email, setEmail] = useState('');

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await forgotPassword(email.trim());
      setAuthStep('reset-sent');
    } catch {
      // Error handled in AuthContext
    }
  }, [email, forgotPassword, setAuthStep]);

  return (
    <div style={styles.viewContainer}>
      <button style={styles.backBtn} onClick={() => setAuthStep('login')} aria-label="Go back">
        ← Back
      </button>

      <div style={styles.otpIcon}>🔑</div>
      <h2 style={styles.viewTitle}>Reset Password</h2>
      <p style={styles.viewDescription}>
        Enter your email and we'll send you a link to reset your password.
      </p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.inputLabel}>Email</label>
          <input
            style={styles.input}
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            required
          />
        </div>

        <button
          type="submit"
          style={{
            ...styles.primaryBtn,
            ...(isProcessing ? styles.btnDisabled : {}),
            width: '100%',
          }}
          disabled={isProcessing}
        >
          {isProcessing ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <button style={styles.linkBtn} onClick={() => setAuthStep('login')}>
        Back to Login
      </button>
    </div>
  );
}

// =========================================================
// Reset Sent View
// =========================================================

function ResetSentView() {
  const { setAuthStep } = useAuth();
  return (
    <div style={styles.viewContainer}>
      <div style={styles.otpIcon}>✉️</div>
      <h2 style={styles.viewTitle}>Email Sent</h2>
      <p style={styles.viewDescription}>
        Check your inbox for the password reset link. It may take a few minutes to arrive.
      </p>
      <button
        style={{ ...styles.primaryBtn, width: '100%' }}
        onClick={() => setAuthStep('login')}
      >
        Back to Login
      </button>
    </div>
  );
}

// =========================================================
// Reset Password From Email View
// =========================================================

function ResetPasswordFromEmailView() {
  const { resetPassword, isProcessing, setAuthStep, resetEmail, resetToken } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localError, setLocalError] = useState('');

  const strength = getPasswordStrength(password);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!resetEmail || !resetToken) {
      setLocalError('Invalid reset link. Please request a new one.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    try {
      await resetPassword(resetEmail, resetToken, password);
    } catch {
      // Error handled in AuthContext
    }
  }, [password, confirmPassword, resetEmail, resetToken, resetPassword]);

  return (
    <div style={styles.viewContainer}>
      <button style={styles.backBtn} onClick={() => setAuthStep('login')} aria-label="Go back">
        ← Back
      </button>

      <div style={styles.otpIcon}>🔑</div>
      <h2 style={styles.viewTitle}>Set New Password</h2>
      <p style={styles.viewDescription}>
        Enter your new password for <strong>{resetEmail}</strong>
      </p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.inputLabel}>New Password</label>
          <div style={styles.passwordWrapper}>
            <input
              style={styles.inputPassword}
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
              required
            />
            <button
              type="button"
              style={styles.eyeBtn}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
          {password && (
            <div style={styles.strengthBar}>
              <div
                style={{
                  ...styles.strengthFill,
                  width: `${strength.percent}%`,
                  background: strength.color,
                }}
              />
            </div>
          )}
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.inputLabel}>Confirm New Password</label>
          <div style={styles.passwordWrapper}>
            <input
              style={{
                ...styles.inputPassword,
                ...(confirmPassword && password !== confirmPassword ? styles.inputError : {}),
              }}
              type={showConfirm ? 'text' : 'password'}
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              style={styles.eyeBtn}
              onClick={() => setShowConfirm(!showConfirm)}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? '🙈' : '👁️'}
            </button>
          </div>
          {confirmPassword && password !== confirmPassword && (
            <span style={styles.fieldError}>Passwords do not match</span>
          )}
        </div>

        {localError && <div style={styles.localError}>{localError}</div>}

        <button
          type="submit"
          style={{
            ...styles.primaryBtn,
            ...(isProcessing ? styles.btnDisabled : {}),
            width: '100%',
          }}
          disabled={isProcessing || !password || !confirmPassword}
        >
          {isProcessing ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>

      <button style={styles.linkBtn} onClick={() => setAuthStep('login')}>
        Back to Login
      </button>
    </div>
  );
}

// =========================================================
// Password Strength Helper
// =========================================================

function getPasswordStrength(password: string): { percent: number; color: string; label: string } {
  if (!password) return { percent: 0, color: 'transparent', label: '' };
  let score = 0;
  if (password.length >= 6) score += 20;
  if (password.length >= 10) score += 15;
  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 20;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;

  if (score < 30) return { percent: score, color: '#EF4444', label: 'Weak' };
  if (score < 50) return { percent: score, color: '#F59E0B', label: 'Fair' };
  if (score < 70) return { percent: score, color: '#10B981', label: 'Good' };
  return { percent: score, color: '#059669', label: 'Strong' };
}

// =========================================================
// Styles
// =========================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-primary)',
    position: 'relative',
    overflow: 'hidden',
    padding: '24px 20px',
  },
  bgGlow: {
    position: 'absolute',
    top: '-30%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  brandArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '28px',
    zIndex: 1,
  },
  logoContainer: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #EF4444 0%, #dc2626 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(239,68,68,0.3)',
  },
  logoEmoji: {
    fontSize: '28px',
  },
  appName: {
    fontSize: '24px',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.5px',
    margin: 0,
  },
  tagline: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
    margin: 0,
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '12px',
    padding: '10px 14px',
    marginBottom: '12px',
    width: '100%',
    maxWidth: '400px',
    zIndex: 1,
    animation: 'fade-in 0.2s ease',
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: '12px',
    padding: '10px 14px',
    marginBottom: '12px',
    width: '100%',
    maxWidth: '400px',
    zIndex: 1,
    animation: 'fade-in 0.2s ease',
  },
  errorText: {
    flex: 1,
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--text-primary)',
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px',
    lineHeight: 1,
  },
  panel: {
    width: '100%',
    maxWidth: '400px',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    justifyContent: 'center',
  },
  viewContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    animation: 'fade-in 0.3s ease',
  },
  heroIcon: {
    fontSize: '48px',
    textAlign: 'center',
    marginBottom: '4px',
  },
  viewTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.2,
  },
  viewDescription: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: 1.4,
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    margin: '4px 0 8px',
  },
  featureRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    background: 'var(--bg-secondary)',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
  },
  featureIcon: {
    fontSize: '18px',
    width: '28px',
    textAlign: 'center' as const,
  },
  featureText: {
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--text-primary)',
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '14px 24px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #EF4444 0%, #dc2626 100%)',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    boxShadow: '0 2px 12px rgba(239,68,68,0.3)',
    marginTop: '8px',
  },
  secondaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 20px',
    borderRadius: '12px',
    border: '1px solid var(--border-light)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
  },
  secondaryAccent: {
    color: 'var(--action-alert)',
    fontWeight: '600',
    marginLeft: '4px',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    padding: '8px',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  inputLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '10px',
    border: '1px solid var(--border-light)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '15px',
    fontWeight: '500',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  inputHint: {
    fontSize: '11px',
    color: 'var(--text-dim)',
    marginTop: '2px',
  },
  phoneWrapper: {
    display: 'flex',
    gap: '8px',
    alignItems: 'stretch',
  },
  countryPickerWrapper: {
    position: 'relative' as const,
    zIndex: 10,
  },
  countryPickerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '14px 10px',
    borderRadius: '10px',
    border: '1px solid var(--border-light)',
    background: 'var(--bg-secondary)',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    fontSize: '15px',
    fontWeight: '600',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    minWidth: '85px',
    justifyContent: 'space-between',
    fontFamily: 'inherit',
  },
  countryFlag: {
    fontSize: '18px',
    lineHeight: 1,
  },
  countryCodeText: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  dropdownArrow: {
    fontSize: '10px',
    color: 'var(--text-dim)',
    marginLeft: '2px',
  },
  countryDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '4px',
    width: '220px',
    maxHeight: '260px',
    overflowY: 'auto',
    borderRadius: '10px',
    border: '1px solid var(--border-light)',
    background: 'var(--bg-secondary)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
  },
  countryOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px 12px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    fontSize: '14px',
    fontWeight: '500',
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'background 0.15s ease',
  },
  countryOptionActive: {
    background: 'rgba(239,68,68,0.08)',
  },
  countryName: {
    flex: 1,
    fontSize: '13px',
    fontWeight: '500',
  },
  countryCodeOption: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-dim)',
  },
  inputPhone: {
    flex: 1,
    padding: '14px 16px',
    borderRadius: '10px',
    border: '1px solid var(--border-light)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '15px',
    fontWeight: '500',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    fontFamily: 'inherit',
  },
  toggleRow: {
    display: 'flex',
    gap: '0',
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid var(--border-light)',
    background: 'var(--bg-tertiary)',
  },
  toggleTab: {
    flex: 1,
    padding: '10px 14px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-dim)',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
  },
  toggleTabActive: {
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  passwordWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'stretch',
  },
  inputPassword: {
    width: '100%',
    padding: '14px 48px 14px 16px',
    borderRadius: '10px',
    border: '1px solid var(--border-light)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '15px',
    fontWeight: '500',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  eyeBtn: {
    position: 'absolute',
    right: '4px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '8px',
    lineHeight: 1,
    color: 'var(--text-secondary)',
  },
  strengthBar: {
    width: '100%',
    height: '3px',
    borderRadius: '2px',
    background: 'var(--bg-tertiary)',
    overflow: 'hidden',
    marginTop: '4px',
  },
  strengthFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'all 0.3s ease',
  },
  fieldError: {
    fontSize: '11px',
    color: '#EF4444',
    fontWeight: '500',
  },
  localError: {
    fontSize: '13px',
    color: '#EF4444',
    fontWeight: '500',
    textAlign: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    padding: '4px 0',
    alignSelf: 'flex-start',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    transition: 'color 0.2s ease',
  },
  otpIcon: {
    fontSize: '36px',
    textAlign: 'center',
    marginBottom: '4px',
  },
  otpRow: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    margin: '8px 0',
  },
  otpInput: {
    width: '44px',
    height: '52px',
    textAlign: 'center',
    fontSize: '20px',
    fontWeight: '700',
    borderRadius: '10px',
    border: '1px solid var(--border-light)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'all 0.2s ease',
    fontFamily: 'var(--font-mono)',
    caretColor: 'var(--action-alert)',
    boxSizing: 'border-box',
    MozAppearance: 'textfield',
  },
};
