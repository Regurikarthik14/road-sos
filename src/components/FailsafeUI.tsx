import { useState, useEffect, useRef } from 'react';
import { DEFAULT_MEDICAL, SOS_MORSE } from '../types';
import type { DispatchEntry } from '../types';
import type { UserLocation } from '../hooks/useGeolocation';

interface FailsafeUIProps {
  onCancel: () => void;
  onExpire: () => void;
  onNavigate: (view: 'dashboard' | 'chat' | 'failsafe') => void;
  userLocation: UserLocation | null;
  crashTriggered?: boolean;
  dispatchEntries: DispatchEntry[];
  isDispatched: boolean;
}

const STATUS_CONFIG = {
  pending: { icon: '⏳', color: 'rgba(255,255,255,0.4)', label: 'Pending' },
  sending: { icon: '📤', color: '#FCD34D', label: 'Sending...' },
  sent: { icon: '✅', color: '#34D399', label: 'Sent' },
  failed: { icon: '❌', color: '#EF4444', label: 'Failed' },
} as const;

export default function FailsafeUI({ onCancel, onExpire, userLocation, crashTriggered, dispatchEntries, isDispatched }: FailsafeUIProps) {
  const INITIAL_COUNTDOWN = crashTriggered ? 3 : 10;
  const [countdown, setCountdown] = useState(INITIAL_COUNTDOWN);
  const [flashState, setFlashState] = useState<'red' | 'yellow'>('red');
  const [hapticActive, setHapticActive] = useState(true);
  const [showDispatch, setShowDispatch] = useState(false);
  const hapticRef = useRef<number | null>(null);
  const flashIntervalRef = useRef<number | null>(null);

  // Countdown timer — when expired or dispatch already started, show dispatch panel
  useEffect(() => {
    if (isDispatched || showDispatch) {
      if (!showDispatch) setShowDispatch(true);
      return;
    }
    if (countdown <= 0) {
      setShowDispatch(true);
      onExpire();
      return;
    }
    const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, onExpire, showDispatch, isDispatched]);

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

  const allSent = dispatchEntries.every(e => e.status === 'sent');
  const sentCount = dispatchEntries.filter(e => e.status === 'sent').length;
  const totalCount = dispatchEntries.length;

  return (
    <div style={{
      ...styles.container,
      background: showDispatch
        ? '#111827'
        : (flashState === 'red' ? '#EF4444' : '#FCD34D'),
      transition: 'background-color 0.3s ease',
    }}>
      {/* HEADER — always visible */}
      <div style={{
        ...styles.header,
        color: showDispatch ? '#F9FAFB' : (flashState === 'red' ? '#fff' : '#111827'),
      }}>
        <span style={styles.headerIcon}>{showDispatch ? '📡' : '🚨'}</span>
        <span style={styles.headerTitle}>
          {showDispatch ? 'EMERGENCY DISPATCH' : 'EMERGENCY ALERT'}
        </span>
      </div>

      {!showDispatch ? (
        /* === COUNTDOWN PHASE === */
        <>
          {/* Top section — Countdown */}
          <div style={styles.countdownSection}>
            <div style={styles.countdownLabel} className="responsive-countdown-label">
              {crashTriggered ? 'CRASH DETECTED — DISPATCHING' : 'AUTO-SOS TRIGGERED'}
            </div>
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

            {/* Progress bar */}
            <div style={styles.progressBar}>
              <div style={{
                ...styles.progressFill,
                width: `${((INITIAL_COUNTDOWN - countdown) / INITIAL_COUNTDOWN) * 100}%`,
                background: flashState === 'red' ? '#FCD34D' : '#EF4444',
              }} />
            </div>
          </div>

          {/* Bottom section — Cancel + Medical */}
          <div style={styles.bottomSection}>
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

            <MedicalInfoCard flashState={flashState} userLocation={userLocation} />

            <div style={{
              ...styles.morseIndicator,
              color: flashState === 'red' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
            }}>
              ⋯ — — — ⋯  (SOS Haptic Active)
            </div>
          </div>
        </>
      ) : (
        /* === DISPATCH STATUS PHASE === */
        <div style={styles.dispatchContainer}>
          {/* Dispatch header with summary */}
          <div style={styles.dispatchSummary}>
            <div style={styles.dispatchSummaryIcon}>
              {allSent ? '✅' : '📡'}
            </div>
            <div style={styles.dispatchSummaryText}>
              {allSent
                ? 'All services notified successfully'
                : `Notifying emergency services... (${sentCount}/${totalCount})`
              }
            </div>
            <div style={styles.dispatchProgressWrap}>
              <div style={styles.dispatchProgressBg}>
                <div style={{
                  ...styles.dispatchProgressFill,
                  width: `${(sentCount / totalCount) * 100}%`,
                  background: allSent ? '#34D399' : '#FCD34D',
                }} />
              </div>
            </div>
          </div>

          {/* Dispatch list */}
          <div style={styles.dispatchList}>
            {dispatchEntries.map((entry) => {
              const cfg = STATUS_CONFIG[entry.status];
              const isActive = entry.status === 'sending';
              return (
                <div
                  key={entry.service}
                  style={{
                    ...styles.dispatchRow,
                    opacity: entry.status === 'pending' ? 0.5 : 1,
                    borderColor: isActive ? 'rgba(252,211,77,0.4)' : 'rgba(255,255,255,0.06)',
                    background: isActive ? 'rgba(252,211,77,0.08)' : 'rgba(255,255,255,0.04)',
                  }}
                >
                  <div style={styles.dispatchRowLeft}>
                    <span style={styles.dispatchIcon}>{entry.icon}</span>
                    <span style={styles.dispatchLabel}>{entry.label}</span>
                  </div>
                  <div style={styles.dispatchRowRight}>
                    {entry.status === 'sending' && (
                      <span style={styles.sendingDots}>
                        <span style={{ animationDelay: '0s', animation: 'dot-blink 1s ease-in-out infinite' }}>.</span>
                        <span style={{ animationDelay: '0.2s', animation: 'dot-blink 1s ease-in-out infinite' }}>.</span>
                        <span style={{ animationDelay: '0.4s', animation: 'dot-blink 1s ease-in-out infinite' }}>.</span>
                      </span>
                    )}
                    <span style={{ color: cfg.color, fontSize: '12px', fontWeight: '700' }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Medical info card below dispatch */}
          <MedicalInfoCard flashState={flashState} userLocation={userLocation} compact />

          {/* Cancel button — still available to abort */}
          <button
            style={styles.cancelButtonSmall}
            onClick={handleCancel}
            aria-label="Cancel Emergency"
          >
            🛑 CANCEL EMERGENCY
          </button>
        </div>
      )}
    </div>
  );
}

// Reusable medical info card component
function MedicalInfoCard({ flashState, userLocation, compact }: {
  flashState: 'red' | 'yellow';
  userLocation: UserLocation | null;
  compact?: boolean;
}) {
  return (
    <div style={{
      ...styles.medicalCard,
      padding: compact ? '8px 12px' : '12px 16px',
      background: flashState === 'red' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)',
    }} className="responsive-medical-card">
      <div style={{
        ...styles.medicalHeader,
        fontSize: compact ? '9px' : '10px',
        marginBottom: compact ? '4px' : '8px',
      }}>🆘 PARAMEDIC QUICK-READ</div>
      {userLocation ? (
        <div style={styles.medicalRow}>
          <span style={styles.medicalLabel}>📍 Location</span>
          <a
            href={`https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: compact ? '10px' : '12px',
              fontWeight: '700',
              color: '#93C5FD',
              fontFamily: 'var(--font-mono)',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              maxWidth: compact ? '140px' : '170px',
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
          <span style={{ ...styles.medicalValue, fontSize: compact ? '10px' : '12px', color: 'rgba(255,255,255,0.4)' }}>
            Acquiring…
          </span>
        </div>
      )}
      <div style={styles.medicalRow}>
        <span style={styles.medicalLabel} className="responsive-medical-label">Blood Type</span>
        <span style={{ ...styles.medicalValue, fontSize: compact ? '13px' : '16px' }} className="responsive-medical-value">{DEFAULT_MEDICAL.bloodType}</span>
      </div>
      <div style={styles.medicalRow}>
        <span style={styles.medicalLabel} className="responsive-medical-label">Emergency Contact</span>
        <span style={{ ...styles.medicalValue, fontSize: compact ? '13px' : '16px' }} className="responsive-medical-value">{DEFAULT_MEDICAL.emergencyContact}</span>
      </div>
      <div style={styles.medicalRow}>
        <span style={styles.medicalLabel} className="responsive-medical-label">Allergies</span>
        <span style={{ ...styles.medicalValue, fontSize: compact ? '13px' : '16px' }} className="responsive-medical-value">{DEFAULT_MEDICAL.allergies}</span>
      </div>
      <div style={styles.medicalRow}>
        <span style={styles.medicalLabel} className="responsive-medical-label">Medications</span>
        <span style={{ ...styles.medicalValue, fontSize: compact ? '13px' : '16px' }} className="responsive-medical-value">{DEFAULT_MEDICAL.medications}</span>
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
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
    fontWeight: '800',
    fontSize: '14px',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  headerIcon: {
    fontSize: '18px',
  },
  headerTitle: {
    fontWeight: '800',
    letterSpacing: '2px',
  },
  countdownSection: {
    flex: 1,
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
    borderRadius: '12px',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
  medicalHeader: {
    fontWeight: '800',
    letterSpacing: '2px',
    color: 'rgba(255,255,255,0.9)',
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
  // Dispatch phase styles
  dispatchContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '8px 16px',
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
    overflowY: 'auto',
  },
  dispatchSummary: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  dispatchSummaryIcon: {
    fontSize: '32px',
  },
  dispatchSummaryText: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#F9FAFB',
    textAlign: 'center',
  },
  dispatchProgressWrap: {
    width: '100%',
    padding: '0 8px',
  },
  dispatchProgressBg: {
    width: '100%',
    height: '4px',
    borderRadius: '2px',
    background: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  dispatchProgressFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.5s ease',
  },
  dispatchList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  dispatchRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.06)',
    transition: 'all 0.3s ease',
  },
  dispatchRowLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  dispatchRowRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  dispatchIcon: {
    fontSize: '18px',
  },
  dispatchLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#F9FAFB',
  },
  sendingDots: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#FCD34D',
    letterSpacing: '2px',
  },
  cancelButtonSmall: {
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    border: '2px solid rgba(239,68,68,0.5)',
    background: 'rgba(239,68,68,0.15)',
    color: '#FCA5A5',
    fontSize: '14px',
    fontWeight: '800',
    letterSpacing: '1px',
    cursor: 'pointer',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    transition: 'all 0.2s ease',
  },
};
