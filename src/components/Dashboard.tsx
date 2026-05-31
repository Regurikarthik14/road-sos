import { useState, useEffect, useRef, useCallback } from 'react';
import { CATEGORIES, SOS_MORSE } from '../types';
import type { CategoryInfo } from '../types';
import MedicalCard from './MedicalCard';
import MapView from './MapView';
import CrashDetectBanner from './CrashDetectBanner';
import HardwareStatusPanel from './HardwareStatus';
import FireDetection from './FireDetection';
import type { CrashDetectStatus } from '../hooks/useCrashDetection';

import type { UserLocation } from '../hooks/useGeolocation';

interface DashboardProps {
  onSOSPress: () => void;
  onChatPress: () => void;
  crashDetection: {
    status: CrashDetectStatus;
    impactDetected: boolean;
    loudDetected: boolean;
    permissionDenied: boolean;
  };
  userLocation: UserLocation | null;
  geoStatus: string;
  fallSignal: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export default function Dashboard({ onSOSPress, onChatPress, crashDetection, userLocation, geoStatus, fallSignal, theme, onToggleTheme }: DashboardProps) {
  const [activeChip, setActiveChip] = useState<CategoryInfo | null>(null);
  const [autoSOSCountdown, setAutoSOSCountdown] = useState<number | null>(null);
  const prevFallSignalRef = useRef(fallSignal);
  const countdownRef = useRef<number | null>(null);
  const radialRef = useRef<HTMLDivElement>(null);
  const hapticIntervalRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const alertIntervalRef = useRef<number | null>(null);
  const alertGainRef = useRef<GainNode | null>(null);

  // Watch fallSignal for changes — parent increments this when DeviceMotion detects impact
  useEffect(() => {
    if (fallSignal === 0) return;
    if (fallSignal !== prevFallSignalRef.current) {
      prevFallSignalRef.current = fallSignal;
      // Start 10-second countdown if not already counting down
      if (autoSOSCountdown === null) {
        setAutoSOSCountdown(10);
        // Vibrate to alert user
        if (navigator.vibrate) {
          navigator.vibrate([100, 100, 100, 100, 200]);
        }
      }
    }
  }, [fallSignal, autoSOSCountdown]);

  // --- Alert Sound System ---
  const startAlertSound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;

      // Resume if suspended (autoplay policy on mobile)
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // Create a master gain node
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.connect(ctx.destination);
      alertGainRef.current = masterGain;

      // Fade in over 300ms
      masterGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.3);

      // Play a repeating urgent beep every second
      const playBeep = () => {
        if (!audioCtxRef.current || !alertGainRef.current) return;
        const ctx2 = audioCtxRef.current;

        // Create two oscillators for a more urgent sound
        const osc1 = ctx2.createOscillator();
        const osc2 = ctx2.createOscillator();
        const beepGain = ctx2.createGain();

        osc1.type = 'square';
        osc1.frequency.setValueAtTime(880, ctx2.currentTime);
        osc1.frequency.linearRampToValueAtTime(660, ctx2.currentTime + 0.08);

        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(1320, ctx2.currentTime);
        osc2.frequency.linearRampToValueAtTime(990, ctx2.currentTime + 0.08);

        // Quick attack, short sustain, fast release
        beepGain.gain.setValueAtTime(0.4, ctx2.currentTime);
        beepGain.gain.exponentialRampToValueAtTime(0.001, ctx2.currentTime + 0.12);

        osc1.connect(beepGain);
        osc2.connect(beepGain);
        beepGain.connect(alertGainRef.current);

        osc1.start(ctx2.currentTime);
        osc1.stop(ctx2.currentTime + 0.12);
        osc2.start(ctx2.currentTime);
        osc2.stop(ctx2.currentTime + 0.12);
      };

      // Play immediately and repeat
      playBeep();
      alertIntervalRef.current = window.setInterval(playBeep, 1000);
    } catch {
      // Audio not available — silent
    }
  }, []);

  const stopAlertSound = useCallback(() => {
    if (alertIntervalRef.current !== null) {
      clearInterval(alertIntervalRef.current);
      alertIntervalRef.current = null;
    }
    // Fade out master gain
    if (audioCtxRef.current && alertGainRef.current) {
      try {
        alertGainRef.current.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 0.2);
        setTimeout(() => {
          if (audioCtxRef.current) {
            audioCtxRef.current.close().catch(() => {});
            audioCtxRef.current = null;
          }
          alertGainRef.current = null;
        }, 300);
      } catch {
        audioCtxRef.current = null;
        alertGainRef.current = null;
      }
    }
  }, []);

  // Auto-SOS countdown timer — start/stop alert sound
  useEffect(() => {
    if (autoSOSCountdown === null) {
      stopAlertSound();
      return;
    }

    // Start alert sound on first tick of the countdown
    if (!audioCtxRef.current) {
      startAlertSound();
    }

    if (autoSOSCountdown <= 0) {
      // Countdown reached 0 — trigger SOS
      stopAlertSound();
      onSOSPress();
      setAutoSOSCountdown(null);
      return;
    }

    countdownRef.current = window.setTimeout(() => {
      setAutoSOSCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => {
      if (countdownRef.current !== null) {
        clearTimeout(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [autoSOSCountdown, onSOSPress, stopAlertSound, startAlertSound]);

  // Cancel auto-SOS
  const cancelAutoSOS = useCallback(() => {
    stopAlertSound();
    if (countdownRef.current !== null) {
      clearTimeout(countdownRef.current);
      countdownRef.current = null;
    }
    setAutoSOSCountdown(null);
  }, [stopAlertSound]);

  // Gentle pulse on mount
  useEffect(() => {
    const el = radialRef.current;
    if (!el) return;
    el.style.animation = 'pulse-ring 3s ease-in-out infinite';
  }, []);

  // SOS haptic when SOS button is held (simulated via vibration)
  const startSOSHaptic = () => {
    if (!navigator.vibrate) return;
    let step = 0;
    const playStep = () => {
      if (step >= SOS_MORSE.length) { step = 0; }
      const s = SOS_MORSE[step];
      const dur = s.duration;
      if ('dot' in s && s.dot) {
        navigator.vibrate(dur);
      } else if ('dash' in s && s.dash) {
        navigator.vibrate(dur);
      } else {
        navigator.vibrate(0);
      }
      step++;
    };
    playStep();
    hapticIntervalRef.current = window.setInterval(playStep, 2400 / SOS_MORSE.length);
  };

  const stopSOSHaptic = () => {
    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }
    navigator.vibrate?.(0);
  };

  useEffect(() => {
    return () => {
      stopSOSHaptic();
      stopAlertSound();
    };
  }, [stopAlertSound]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header} className="responsive-header">
        <span style={styles.logo} className="responsive-logo">🛡️ Raksha</span>
        <div style={styles.headerRight}>
          <button
            onClick={onToggleTheme}
            style={styles.themeToggle}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <div style={styles.connectionBadge}>
            <span style={styles.connectionDot} />
            <span style={styles.connectionText}>Connected</span>
          </div>
        </div>
      </div>

      {/* Central Hero — Radial Dial with SOS */}
      <div style={styles.heroArea} className="responsive-hero">
        <div ref={radialRef} style={styles.radialDial} className="responsive-radial">
          {/* Outer ring tick marks */}
          <svg style={styles.radialSvg} viewBox="0 0 200 200">
            {Array.from({ length: 24 }).map((_, i) => {
              const angle = (i / 24) * 360 - 90;
              const rad = (angle * Math.PI) / 180;
              const r1 = 88;
              const r2 = 92;
              const x1 = 100 + r1 * Math.cos(rad);
              const y1 = 100 + r1 * Math.sin(rad);
              const x2 = 100 + r2 * Math.cos(rad);
              const y2 = 100 + r2 * Math.sin(rad);
              return (
                <line
                  key={i}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={i % 6 === 0 ? '#EF4444' : '#4b5563'}
                  strokeWidth={i % 6 === 0 ? 2.5 : 1.5}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {/* Glow ring */}
          <div style={styles.glowRing} className="responsive-glow-ring" />

          {/* SOS Button */}
          <button
            style={{
              ...styles.sosButton,
              animation: autoSOSCountdown !== null
                ? 'sos-auto-pulse 0.6s ease-in-out infinite, pulse-glow 1s ease-in-out infinite'
                : 'pulse-glow 2s ease-in-out infinite',
            }}
            className="responsive-sos-btn"
            onMouseDown={() => { startSOSHaptic(); onSOSPress(); }}
            onMouseUp={stopSOSHaptic}
            onMouseLeave={stopSOSHaptic}
            onTouchStart={() => { startSOSHaptic(); onSOSPress(); }}
            onTouchEnd={stopSOSHaptic}
            aria-label="Activate SOS Emergency"
            role="button"
          >
            {autoSOSCountdown !== null ? (
              <>
                <span style={styles.sosCountdownNumber}>{autoSOSCountdown}</span>
                <span style={styles.sosCountdownLabel}>AUTO SOS</span>
              </>
            ) : (
              <>
                <span style={styles.sosText} className="responsive-sos-text">SOS</span>
                <span style={styles.sosSubtext}>TAP FOR EMERGENCY</span>
              </>
            )}
          </button>

          {/* Cancel overlay — shown during auto-SOS countdown */}
          {autoSOSCountdown !== null && (
            <button
              style={styles.cancelOverlay}
              onClick={cancelAutoSOS}
              onTouchStart={(e) => {
                e.stopPropagation();
                cancelAutoSOS();
              }}
              aria-label="Cancel automatic SOS"
            >
              <span style={styles.cancelOverlayIcon}>✕</span>
              <span style={styles.cancelOverlayText}>CANCEL</span>
            </button>
          )}
        </div>

        {/* Status indicator */}
        <div style={styles.statusRow}>
          <div style={styles.statusDot} />
          <span style={styles.statusLabel} className="responsive-status-label">System Online — Tap to dispatch</span>
        </div>
      </div>

      {/* Scrollable Content Below Hero */}
      <div style={styles.scrollContent}>
        {/* Hardware Status Panel */}
        <HardwareStatusPanel />

        {/* Fire Detection Panel */}
        <FireDetection onFireDetected={() => {
          // High pressure / fire detected — start auto-SOS countdown
          if (autoSOSCountdown === null) {
            setAutoSOSCountdown(10);
            if (navigator.vibrate) {
              navigator.vibrate([100, 100, 100, 100, 200]);
            }
          }
        }} />

        {/* Crash Detection Banner */}
        <CrashDetectBanner
          status={crashDetection.status}
          impactDetected={crashDetection.impactDetected}
          loudDetected={crashDetection.loudDetected}
          permissionDenied={crashDetection.permissionDenied}
        />

        {/* Quick Category Chips */}
        <div style={styles.chipRow} className="responsive-chips">
          {CATEGORIES.map((cat) => {
            const isActive = activeChip?.id === cat.id;
            return (
              <button
                key={cat.id}
                style={{
                  ...styles.chip,
                  ...(isActive ? styles.chipActive : {}),
                }}
                className="responsive-chip"
                onClick={() => setActiveChip(isActive ? null : cat)}
                aria-label={cat.label}
                aria-pressed={isActive}
              >
                <span style={styles.chipIcon} className="responsive-chip-icon">{cat.icon}</span>
                <span style={{
                  ...styles.chipLabel,
                  ...(isActive ? { color: '#EF4444' } : {}),
                }} className="responsive-chip-label">{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Chat Trigger */}
        <button style={styles.chatTrigger} className="responsive-chat-trigger" onClick={onChatPress} aria-label="Open AI Chat">
          <span style={styles.chatIcon}>💬</span>
          <span style={styles.chatTriggerText} className="responsive-chat-trigger-text">Say "Help Raksha"</span>
          <span style={styles.micIcon}>🎤</span>
        </button>

        {/* Medical card at bottom */}
        <MedicalCard variant="collapsed" />
      </div>

      {/* Map overlay when category is active — covers everything */}
      {activeChip && (
        <MapView activeCategory={activeChip} onClose={() => setActiveChip(null)} userLocation={userLocation} geoStatus={geoStatus} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary)',
    position: 'relative',
    overflow: 'hidden',
    paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px 8px',
    paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
    flexShrink: 0,
  },
  logo: {
    fontSize: '20px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    letterSpacing: '-0.5px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  themeToggle: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    transition: 'all 0.2s ease',
    lineHeight: 1,
    padding: 0,
  },
  connectionBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(16, 185, 129, 0.15)',
    padding: '4px 12px 4px 8px',
    borderRadius: '20px',
    border: '1px solid rgba(16, 185, 129, 0.3)',
  },
  connectionDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--trust-safe)',
    boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)',
  },
  connectionText: {
    fontSize: '12px',
    color: 'var(--trust-safe)',
    fontWeight: '600',
  },
  heroArea: {
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 20px',
    gap: '8px',
    overflow: 'hidden',
  },
  radialDial: {
    position: 'relative',
    width: '220px',
    height: '220px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radialSvg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    animation: 'rotate-dial 60s linear infinite',
  },
  glowRing: {
    position: 'absolute',
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    border: '2px solid rgba(239, 68, 68, 0.2)',
    animation: 'pulse-ring 3s ease-in-out infinite',
  },
  sosButton: {
    position: 'relative',
    width: '130px',
    height: '130px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #EF4444 0%, #dc2626 100%)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    animation: 'pulse-glow 2s ease-in-out infinite',
    transition: 'transform 0.15s ease',
    outline: 'none',
    zIndex: 2,
    WebkitTapHighlightColor: 'transparent',
  },
  sosText: {
    fontSize: '36px',
    fontWeight: '900',
    color: '#fff',
    letterSpacing: '4px',
    textShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  sosSubtext: {
    fontSize: '8px',
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: '1px',
  },
  sosCountdownNumber: {
    fontSize: '48px',
    fontWeight: '900',
    color: '#fff',
    textShadow: '0 2px 12px rgba(0,0,0,0.4)',
    fontFamily: 'var(--font-mono)',
    lineHeight: 1,
    animation: 'countdown-pulse 0.5s ease-in-out infinite',
  },
  sosCountdownLabel: {
    fontSize: '10px',
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  },
  cancelOverlay: {
    position: 'absolute' as const,
    bottom: '-40px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 16px',
    borderRadius: '20px',
    border: '2px solid rgba(255,255,255,0.8)',
    background: 'rgba(0,0,0,0.5)',
    cursor: 'pointer',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    whiteSpace: 'nowrap',
    zIndex: 10,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    animation: 'fade-in 0.3s ease',
  },
  cancelOverlayIcon: {
    fontSize: '14px',
    color: '#fff',
    fontWeight: '700',
  },
  cancelOverlayText: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#fff',
    letterSpacing: '1px',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--trust-safe)',
  },
  statusLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  scrollContent: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    paddingBottom: '8px',
  },
  chipRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
    padding: '0 16px 12px',
  },
  chip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '10px 4px',
    borderRadius: '12px',
    border: '1px solid var(--border-light)',
    background: 'var(--bg-secondary)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
  },
  chipActive: {
    border: '1px solid rgba(239, 68, 68, 0.4)',
    background: 'rgba(239, 68, 68, 0.1)',
    boxShadow: '0 0 12px rgba(239, 68, 68, 0.15)',
  },
  chipIcon: {
    fontSize: '20px',
  },
  chipLabel: {
    fontSize: '10px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    textAlign: 'center',
    lineHeight: 1.2,
  },
  chatTrigger: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: '0 16px 10px',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid var(--border-light)',
    background: 'var(--bg-secondary)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
  },
  chatIcon: {
    fontSize: '18px',
  },
  chatTriggerText: {
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--text-secondary)',
  },
  micIcon: {
    fontSize: '16px',
  },
};
