import { useState, useEffect, useRef } from 'react';
import { DEFAULT_MEDICAL, SOS_MORSE } from '../types';
import type { UserLocation } from '../hooks/useGeolocation';

interface FailsafeUIProps {
  onCancel: () => void;
  onExpire: () => void;
  onNavigate: (view: 'dashboard' | 'chat' | 'failsafe') => void;
  userLocation: UserLocation | null;
  crashTriggered?: boolean;
}

export default function FailsafeUI({ onCancel, onExpire, userLocation, crashTriggered }: FailsafeUIProps) {
  const INITIAL_COUNTDOWN = crashTriggered ? 3 : 10;
  const [countdown, setCountdown] = useState(INITIAL_COUNTDOWN);
  const [flashState, setFlashState] = useState<'red' | 'yellow'>('red');
  const [hapticActive, setHapticActive] = useState(true);
  const hapticRef = useRef<number | null>(null);
  const flashIntervalRef = useRef<number | null>(null);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      onExpire();
      return;
    }
    const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, onExpire]);

  // Screen flash red/yellow
  useEffect(() => {
    flashIntervalRef.current = window.setInterval(() => {
      setFlashState(prev => prev === 'red' ? 'yellow' : 'red');
    }, 500);
    return () => {
      if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
    };
  }, []);

  // SOS Morse haptic pattern (... --- ...)
  useEffect(() => {
    if (!navigator.vibrate) return;

    let step = 0;
    const playMorse = () => {
      if (!hapticActive) return;
      const s = SOS_MORSE[step];
      const dur = 'gap' in s && s.gap ? 0 : s.duration;
      navigator.vibrate(dur);
      step = (step + 1) % SOS_MORSE.length;
    };

    playMorse();
    hapticRef.current = window.setInterval(playMorse, 2400 / SOS_MORSE.length);

    return () => {
      if (hapticRef.current) clearInterval(hapticRef.current);
      navigator.vibrate(0);
    };
  }, [hapticActive]);

  const handleCancel = () => {
    setHapticActive(false);
    navigator.vibrate?.(0);
    if (hapticRef.current) clearInterval(hapticRef.current);
    if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
    onCancel();
  };

  return (
    <div style={{
      ...styles.container,
      background: flashState === 'red' ? '#EF4444' : '#FCD34D',
      transition: 'background-color 0.15s ease',
    }}>
      {/* Top 50% — Countdown */}
      <div style={styles.countdownSection}>
        <div style={styles.countdownLabel} className="responsive-countdown-label">EMERGENCY DISPATCH</div>
        <div style={{
          ...styles.countdownNumber,
          color: flashState === 'red' ? '#fff' : '#111827',
        }} className="responsive-countdown-number">
          {countdown}
        </div>
        <div style={{
          ...styles.countdownUnit,
          color: flashState === 'red' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
        }} className="responsive-countdown-label">
          seconds until dispatch
        </div>

        {/* Crash detection context */}
        {crashTriggered && (
          <div style={{
            marginTop: '4px',
            padding: '6px 12px',
            borderRadius: '8px',
            background: flashState === 'red' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.15)',
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '0.5px',
            color: flashState === 'red' ? '#FCD34D' : '#EF4444',
            textAlign: 'center',
          }}>
            🚨 Crash detected — Impact + Loud sound
          </div>
        )}

        {/* Progress bar — use INITIAL_COUNTDOWN for width calculation */}
        <div style={styles.progressBar}>
          <div style={{
            ...styles.progressFill,
            width: `${((INITIAL_COUNTDOWN - countdown) / INITIAL_COUNTDOWN) * 100}%`,
            background: flashState === 'red' ? '#FCD34D' : '#EF4444',
          }} />
        </div>
      </div>

      {/* Bottom 50% — CANCEL + Medical Card */}
      <div style={styles.bottomSection}>
        {/* Cancel Emergency Button */}
        <button
          style={styles.cancelButton}
          onClick={handleCancel}
          aria-label="Cancel Emergency"
          autoFocus
        >
          <span style={styles.cancelIcon}>🛑</span>
          <span style={styles.cancelText} className="responsive-cancel-text">CANCEL EMERGENCY</span>
          <span style={styles.cancelSubtext}>{crashTriggered ? 'False alarm? Tap to cancel dispatch' : 'Tap to abort and return to dashboard'}</span>
        </button>

        {/* Medical Quick-Read Card */}
        <div style={{
          ...styles.medicalCard,
          background: flashState === 'red' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)',
        }} className="responsive-medical-card">
          <div style={styles.medicalHeader}>🆘 PARAMEDIC QUICK-READ</div>
          {/* Location — shared with first responders */}
          {userLocation ? (
            <div style={styles.medicalRow}>
              <span style={styles.medicalLabel}>📍 Location</span>
              <a
                href={`https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#93C5FD',
                  fontFamily: 'var(--font-mono)',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                  maxWidth: '170px',
                  textAlign: 'right',
                  lineHeight: 1.3,
                }}
              >
                {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
                {userLocation.accuracy != null && ` ±${Math.round(userLocation.accuracy)}m`}
              </a>
            </div>
          ) : (
            <div style={styles.medicalRow}>
              <span style={styles.medicalLabel}>📍 Location</span>
              <span style={{ ...styles.medicalValue, fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                Acquiring…
              </span>
            </div>
          )}
          <div style={styles.medicalRow}>
            <span style={styles.medicalLabel} className="responsive-medical-label">Blood Type</span>
            <span style={styles.medicalValue} className="responsive-medical-value">{DEFAULT_MEDICAL.bloodType}</span>
          </div>
          <div style={styles.medicalRow}>
            <span style={styles.medicalLabel} className="responsive-medical-label">Emergency Contact</span>
            <span style={styles.medicalValue} className="responsive-medical-value">{DEFAULT_MEDICAL.emergencyContact}</span>
          </div>
          <div style={styles.medicalRow}>
            <span style={styles.medicalLabel} className="responsive-medical-label">Allergies</span>
            <span style={styles.medicalValue} className="responsive-medical-value">{DEFAULT_MEDICAL.allergies}</span>
          </div>
          <div style={styles.medicalRow}>
            <span style={styles.medicalLabel} className="responsive-medical-label">Medications</span>
            <span style={styles.medicalValue} className="responsive-medical-value">{DEFAULT_MEDICAL.medications}</span>
          </div>
        </div>

        {/* SOS Morse indicator */}
        <div style={{
          ...styles.morseIndicator,
          color: flashState === 'red' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
        }}>
          ⋯ — — — ⋯  (SOS Haptic Active)
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
    animation: 'fade-in 0.1s ease',
  },
  countdownSection: {
    height: '50%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '20px',
  },
  countdownLabel: {
    fontSize: '14px',
    fontWeight: '800',
    letterSpacing: '3px',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
  },
  countdownNumber: {
    fontSize: '120px',
    fontWeight: '900',
    lineHeight: 1,
    animation: 'countdown-pulse 0.5s ease-in-out infinite',
    fontFamily: 'var(--font-mono)',
    textShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  countdownUnit: {
    fontSize: '14px',
    fontWeight: '600',
    letterSpacing: '1px',
  },
  progressBar: {
    width: '80%',
    height: '6px',
    borderRadius: '3px',
    background: 'rgba(0,0,0,0.2)',
    overflow: 'hidden',
    marginTop: '8px',
  },
  progressFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 1s linear',
  },
  bottomSection: {
    height: '50%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '16px',
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
  },
  cancelButton: {
    width: '100%',
    padding: '20px 16px',
    borderRadius: '16px',
    border: '3px solid rgba(255,255,255,0.9)',
    background: 'rgba(0,0,0,0.4)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.2s ease',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
  cancelIcon: {
    fontSize: '32px',
  },
  cancelText: {
    fontSize: '22px',
    fontWeight: '900',
    color: '#fff',
    letterSpacing: '2px',
  },
  cancelSubtext: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  medicalCard: {
    padding: '12px 16px',
    borderRadius: '12px',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
  medicalHeader: {
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: '2px',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: '8px',
  },
  medicalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  medicalLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  medicalValue: {
    fontSize: '16px',
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'var(--font-mono)',
  },
  morseIndicator: {
    textAlign: 'center',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '2px',
  },
};
