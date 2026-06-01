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
import { useAuth } from '../context/AuthContext';

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
  const { user, updateProfile, logout } = useAuth();
  const [activeChip, setActiveChip] = useState<CategoryInfo | null>(null);
  const [autoSOSCountdown, setAutoSOSCountdown] = useState<number | null>(null);
  const prevFallSignalRef = useRef(fallSignal);
  const countdownRef = useRef<number | null>(null);
  const radialRef = useRef<HTMLDivElement>(null);
  const hapticIntervalRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const alertIntervalRef = useRef<number | null>(null);
  const alertGainRef = useRef<GainNode | null>(null);

  // Profile Drawer & Editing States
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editBloodType, setEditBloodType] = useState('A+');
  const [editAllergies, setEditAllergies] = useState('');
  const [editMedications, setEditMedications] = useState('');
  const [editEmergencyContact, setEditEmergencyContact] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Initialize fields when drawer opens
  useEffect(() => {
    if (user) {
      setEditName(user.displayName || '');
      setEditAge(user.medicalInfo?.age || '');
      setEditBloodType(user.medicalInfo?.bloodType || 'A+');
      setEditAllergies(user.medicalInfo?.allergies || '');
      setEditMedications(user.medicalInfo?.medications || '');
      setEditEmergencyContact(user.medicalInfo?.emergencyContact || '');
    }
  }, [user, showProfileDrawer]);

  const handleProfileSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError(null);

    if (!editName.trim()) {
      setProfileError('Name cannot be empty.');
      setProfileSaving(false);
      return;
    }

    const ageNum = Number(editAge);
    if (!editAge.trim() || isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
      setProfileError('Please enter a valid age (1-120).');
      setProfileSaving(false);
      return;
    }

    try {
      await updateProfile({
        displayName: editName.trim(),
        age: editAge.trim(),
        bloodType: editBloodType,
        emergencyContact: editEmergencyContact.trim(),
        allergies: editAllergies.trim(),
        medications: editMedications.trim(),
      });
      setIsEditingProfile(false);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  }, [editName, editAge, editBloodType, editEmergencyContact, editAllergies, editMedications, updateProfile]);

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
        <div style={styles.avatarContainer} onClick={() => { setShowProfileDrawer(true); setIsEditingProfile(false); }} aria-label="Open Profile Details" role="button">
          <div style={styles.avatarCircle}>
            {user?.displayName?.[0]?.toUpperCase() || '?'}
          </div>
          <span style={styles.avatarName}>{user?.displayName || 'User'}</span>
        </div>
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

      {/* Profile Drawer */}
      {showProfileDrawer && (
        <div style={styles.drawerBackdrop} onClick={() => setShowProfileDrawer(false)}>
          <div style={styles.drawerContainer} onClick={(e) => e.stopPropagation()}>
            <div style={styles.drawerHeader}>
              <h3 style={styles.drawerTitle}>🏥 Health Profile</h3>
              <button style={styles.drawerCloseBtn} onClick={() => setShowProfileDrawer(false)}>✕</button>
            </div>

            <div style={styles.drawerScrollContent}>
              {/* User Avatar & unique ID badge */}
              <div style={styles.drawerHero}>
                <div style={styles.drawerAvatar}>
                  {user?.displayName?.[0]?.toUpperCase() || '?'}
                </div>
                <h4 style={styles.drawerName}>{user?.displayName || 'User'}</h4>
                <div style={styles.idBadge}>
                  <span style={styles.idBadgeLabel}>Unique ID:</span>
                  <code style={styles.idBadgeValue}>{user?.uniqueId}</code>
                </div>
              </div>

              {profileError && (
                <div style={styles.drawerError}>
                  ⚠️ {profileError}
                </div>
              )}

              {isEditingProfile ? (
                <form onSubmit={handleProfileSave} style={styles.drawerForm}>
                  <div style={styles.drawerInputGroup}>
                    <label style={styles.drawerInputLabel}>Full Name</label>
                    <input
                      style={styles.drawerInput}
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ ...styles.drawerInputGroup, flex: 1 }}>
                      <label style={styles.drawerInputLabel}>Age</label>
                      <input
                        style={styles.drawerInput}
                        type="text"
                        inputMode="numeric"
                        value={editAge}
                        onChange={(e) => setEditAge(e.target.value.replace(/\D/g, ''))}
                        required
                      />
                    </div>
                    <div style={{ ...styles.drawerInputGroup, flex: 1.2 }}>
                      <label style={styles.drawerInputLabel}>Blood Group</label>
                      <select
                        style={styles.drawerSelect}
                        value={editBloodType}
                        onChange={(e) => setEditBloodType(e.target.value)}
                      >
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bt) => (
                          <option key={bt} value={bt}>{bt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={styles.drawerInputGroup}>
                    <label style={styles.drawerInputLabel}>Emergency Contact</label>
                    <input
                      style={styles.drawerInput}
                      type="tel"
                      placeholder="Emergency phone number"
                      value={editEmergencyContact}
                      onChange={(e) => setEditEmergencyContact(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>

                  <div style={styles.drawerInputGroup}>
                    <label style={styles.drawerInputLabel}>Allergies</label>
                    <input
                      style={styles.drawerInput}
                      type="text"
                      placeholder="e.g. Penicillin, Peanuts (or None)"
                      value={editAllergies}
                      onChange={(e) => setEditAllergies(e.target.value)}
                    />
                  </div>

                  <div style={styles.drawerInputGroup}>
                    <label style={styles.drawerInputLabel}>Current Medications</label>
                    <input
                      style={styles.drawerInput}
                      type="text"
                      placeholder="e.g. Aspirin 81mg daily"
                      value={editMedications}
                      onChange={(e) => setEditMedications(e.target.value)}
                    />
                  </div>

                  <div style={styles.drawerActionRow}>
                    <button
                      type="button"
                      style={styles.drawerCancelBtn}
                      onClick={() => setIsEditingProfile(false)}
                      disabled={profileSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={styles.drawerSaveBtn}
                      disabled={profileSaving}
                    >
                      {profileSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <div style={styles.drawerDetails}>
                  <div style={styles.detailRow}>
                    <span style={styles.detailIcon}>📞</span>
                    <div style={styles.detailTextContainer}>
                      <span style={styles.detailLabel}>Mobile Number</span>
                      <span style={styles.detailValue}>{user?.phone || user?.email || 'N/A'}</span>
                    </div>
                    <span style={styles.verifiedBadge}>Verified</span>
                  </div>

                  <div style={styles.detailRow}>
                    <span style={styles.detailIcon}>🎂</span>
                    <div style={styles.detailTextContainer}>
                      <span style={styles.detailLabel}>Age</span>
                      <span style={styles.detailValue}>{user?.medicalInfo?.age || 'Not set'} Years</span>
                    </div>
                  </div>

                  <div style={styles.detailRow}>
                    <span style={styles.detailIcon}>🩸</span>
                    <div style={styles.detailTextContainer}>
                      <span style={styles.detailLabel}>Blood Group</span>
                      <span style={{ ...styles.detailValue, color: '#EF4444', fontWeight: '700' }}>
                        {user?.medicalInfo?.bloodType || 'Not set'}
                      </span>
                    </div>
                  </div>

                  <div style={styles.detailRow}>
                    <span style={styles.detailIcon}>🚨</span>
                    <div style={styles.detailTextContainer}>
                      <span style={styles.detailLabel}>Emergency Contact</span>
                      <span style={styles.detailValue}>{user?.medicalInfo?.emergencyContact || 'Not set'}</span>
                    </div>
                  </div>

                  <div style={styles.detailRow}>
                    <span style={styles.detailIcon}>⚠️</span>
                    <div style={styles.detailTextContainer}>
                      <span style={styles.detailLabel}>Allergies</span>
                      <span style={styles.detailValue}>{user?.medicalInfo?.allergies || 'None reported'}</span>
                    </div>
                  </div>

                  <div style={styles.detailRow}>
                    <span style={styles.detailIcon}>💊</span>
                    <div style={styles.detailTextContainer}>
                      <span style={styles.detailLabel}>Medications</span>
                      <span style={styles.detailValue}>{user?.medicalInfo?.medications || 'None'}</span>
                    </div>
                  </div>

                  <button
                    style={styles.drawerEditBtn}
                    onClick={() => { setIsEditingProfile(true); setProfileError(null); }}
                  >
                    ✏️ Edit Details
                  </button>

                  <button
                    style={styles.drawerLogoutBtn}
                    onClick={() => {
                      if (window.confirm('Are you sure you want to log out?')) {
                        logout();
                      }
                    }}
                  >
                    🚪 Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
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
  avatarContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
    position: 'relative',
    WebkitTapHighlightColor: 'transparent',
  },
  avatarCircle: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #EF4444 0%, #dc2626 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '15px',
    boxShadow: '0 2px 8px rgba(239,68,68,0.2)',
    border: '2px solid rgba(255,255,255,0.1)',
  },
  avatarName: {
    fontSize: '9px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    marginTop: '3px',
    textAlign: 'center',
    maxWidth: '56px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'flex-start',
    animation: 'fade-in 0.2s ease',
  },
  drawerContainer: {
    width: '85%',
    maxWidth: '320px',
    height: '100%',
    background: 'var(--bg-primary)',
    borderRight: '1px solid var(--border-light)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '4px 0 24px rgba(0, 0, 0, 0.2)',
    boxSizing: 'border-box',
  },
  drawerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    borderBottom: '1px solid var(--border-light)',
  },
  drawerTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  drawerCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '4px',
  },
  drawerScrollContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  drawerHero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 0 16px 0',
    borderBottom: '1px solid var(--border-light)',
  },
  drawerAvatar: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #EF4444 0%, #dc2626 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '24px',
    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
  },
  drawerName: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  idBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'var(--bg-tertiary)',
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid var(--border-light)',
  },
  idBadgeLabel: {
    fontSize: '10px',
    fontWeight: '600',
    color: 'var(--text-dim)',
    textTransform: 'uppercase',
  },
  idBadgeValue: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    fontFamily: 'monospace',
  },
  drawerError: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#EF4444',
    padding: '10px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
  },
  drawerForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  drawerInputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  drawerInputLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  drawerInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border-light)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    fontWeight: '500',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  drawerSelect: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border-light)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    fontWeight: '500',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  drawerActionRow: {
    display: 'flex',
    gap: '10px',
    marginTop: '8px',
  },
  drawerCancelBtn: {
    flex: 1,
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid var(--border-light)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  drawerSaveBtn: {
    flex: 1.5,
    padding: '10px',
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(135deg, #EF4444 0%, #dc2626 100%)',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)',
  },
  drawerDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '8px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
  },
  detailIcon: {
    fontSize: '18px',
  },
  detailTextContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  detailLabel: {
    fontSize: '10px',
    fontWeight: '600',
    color: 'var(--text-dim)',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  verifiedBadge: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#10B981',
    background: 'rgba(16, 185, 129, 0.1)',
    padding: '2px 6px',
    borderRadius: '10px',
  },
  drawerEditBtn: {
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid var(--border-light)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'all 0.2s ease',
  },
  drawerLogoutBtn: {
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    background: 'rgba(239, 68, 68, 0.05)',
    color: '#EF4444',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'all 0.2s ease',
  },
};
