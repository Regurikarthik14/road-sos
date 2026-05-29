import { useState, useCallback, useEffect, useRef } from 'react';
import Dashboard from './components/Dashboard';
import ChatCanvas from './components/ChatCanvas';
import FailsafeUI from './components/FailsafeUI';
import BottomNav from './components/BottomNav';
import { useGeolocation } from './hooks/useGeolocation';
import { useCrashDetection } from './hooks/useCrashDetection';
import { useTheme } from './hooks/useTheme';
import type { AppView } from './types';
import type { DispatchEntry, DispatchService } from './types';
import { DEFAULT_DISPATCH_SERVICES } from './types';
import './App.css';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [isEmergencyTriggered, setIsEmergencyTriggered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDispatched, setIsDispatched] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const { userLocation, geoStatus } = useGeolocation();
  const { theme, toggleTheme } = useTheme();
  const [crashTriggered, setCrashTriggered] = useState(false);
  const [fallSignal, setFallSignal] = useState(0);
  const dispatchTimersRef = useRef<number[]>([]);
  const hasDispatchedRef = useRef(false);

  // Dispatch state — each service gets its own status
  const [dispatchEntries, setDispatchEntries] = useState<DispatchEntry[]>(DEFAULT_DISPATCH_SERVICES);

  // Reset dispatch state
  const resetDispatch = useCallback(() => {
    hasDispatchedRef.current = false;
    dispatchTimersRef.current.forEach(t => clearTimeout(t));
    dispatchTimersRef.current = [];
    setDispatchEntries(DEFAULT_DISPATCH_SERVICES);
    setIsDispatched(false);
  }, []);

  // Dispatch to ALL nearest services with staggered timing (idempotent)
  const dispatchToAllServices = useCallback(() => {
    if (hasDispatchedRef.current) return;
    hasDispatchedRef.current = true;
    setIsDispatched(true);

    // Dispatch each service with a staggered delay for realistic simulation
    const services: { service: DispatchService; delay: number }[] = [
      { service: 'trauma', delay: 0 },
      { service: 'police', delay: 800 },
      { service: 'fire', delay: 1600 },
      { service: 'towing', delay: 2400 },
      { service: 'puncture', delay: 3200 },
    ];

    services.forEach(({ service, delay }) => {
      // Set to 'sending' immediately (or at half the delay)
      const sendingTimer = window.setTimeout(() => {
        setDispatchEntries(prev =>
          prev.map(e => e.service === service ? { ...e, status: 'sending' } : e)
        );
      }, delay);

      // Then set to 'sent' after a short sending duration
      const sentTimer = window.setTimeout(() => {
        setDispatchEntries(prev =>
          prev.map(e => e.service === service ? { ...e, status: 'sent', timestamp: Date.now() } : e)
        );
      }, delay + 1200);

      dispatchTimersRef.current.push(sendingTimer, sentTimer);
    });
  }, []);

  // Handle crash detection — auto-trigger failsafe with shorter countdown
  const handleCrashDetected = useCallback(() => {
    setCrashTriggered(true);
    setActiveView('failsafe');
    setIsEmergencyTriggered(true);
    dispatchToAllServices();
  }, [dispatchToAllServices]);

  // Handle fall/impact detection — increment signal to start auto-SOS countdown on Dashboard
  const handleImpactDetected = useCallback(() => {
    setFallSignal(prev => prev + 1);
  }, []);

  const crashDetect = useCrashDetection({
    onCrashDetected: handleCrashDetected,
    onImpactDetected: handleImpactDetected,
  });

  // Simulate loading on mount (show skeleton)
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Play alert sound when emergency triggered
  useEffect(() => {
    if (isEmergencyTriggered) {
      try {
        audioContextRef.current = new AudioContext();
        const ctx = audioContextRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.45);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);

        // Loop alert
        const interval = setInterval(() => {
          if (activeView !== 'failsafe') {
            clearInterval(interval);
            return;
          }
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sawtooth';
          osc2.frequency.setValueAtTime(880, ctx.currentTime);
          osc2.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
          gain2.gain.setValueAtTime(0.12, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(ctx.currentTime);
          osc2.stop(ctx.currentTime + 0.5);
        }, 2000);

        return () => clearInterval(interval);
      } catch {
        // Audio not available — silent fail
      }
    }
  }, [isEmergencyTriggered, activeView]);

  const handleSOSPress = useCallback(() => {
    setActiveView('failsafe');
    setIsEmergencyTriggered(true);
    dispatchToAllServices();
  }, [dispatchToAllServices]);

  const handleCancelEmergency = useCallback(() => {
    setActiveView('dashboard');
    setIsEmergencyTriggered(false);
    setCrashTriggered(false);
    resetDispatch();
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
  }, [resetDispatch]);

  const handleEmergencyExpire = useCallback(() => {
    // FailsafeUI countdown expired — begin dispatching
    setIsEmergencyTriggered(true);
    dispatchToAllServices();
  }, [dispatchToAllServices]);

  const handleNavigate = useCallback((view: AppView) => {
    setActiveView(view);
    if (view === 'failsafe') {
      setIsEmergencyTriggered(true);
    } else if (view === 'dashboard') {
      setIsEmergencyTriggered(false);
      resetDispatch();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    }
  }, [resetDispatch]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingContent}>
          <div style={styles.skeletonLogo}>
            <div className="skeleton" style={{ width: '60px', height: '60px', borderRadius: '50%' }} />
          </div>
          <div className="skeleton" style={{ width: '160px', height: '24px', borderRadius: '8px', marginTop: '16px' }} />
          <div className="skeleton" style={{ width: '200px', height: '16px', borderRadius: '8px', marginTop: '12px' }} />
          <div className="skeleton" style={{ width: '240px', height: '200px', borderRadius: '16px', marginTop: '24px' }} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
            <div className="skeleton" style={{ width: '80px', height: '60px', borderRadius: '12px' }} />
            <div className="skeleton" style={{ width: '80px', height: '60px', borderRadius: '12px' }} />
            <div className="skeleton" style={{ width: '80px', height: '60px', borderRadius: '12px' }} />
            <div className="skeleton" style={{ width: '80px', height: '60px', borderRadius: '12px' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      {/* Render active view */}
      {activeView === 'dashboard' && (
        <Dashboard
          onSOSPress={handleSOSPress}
          onChatPress={() => setActiveView('chat')}
          crashDetection={crashDetect}
          userLocation={userLocation}
          geoStatus={geoStatus}
          fallSignal={fallSignal}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}

      {activeView === 'chat' && (
        <ChatCanvas theme={theme} onToggleTheme={toggleTheme} onBack={() => setActiveView('dashboard')} />
      )}

      {activeView === 'failsafe' && (
        <FailsafeUI
          onCancel={handleCancelEmergency}
          onExpire={handleEmergencyExpire}
          onNavigate={handleNavigate}
          userLocation={userLocation}
          crashTriggered={crashTriggered}
          dispatchEntries={dispatchEntries}
          isDispatched={isDispatched}
        />
      )}

      {/* Bottom Nav — hidden during failsafe for full-screen emergency */}
      {activeView !== 'failsafe' && (
        <BottomNav activeView={activeView} onNavigate={handleNavigate} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  appContainer: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  loadingContainer: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-primary)',
  },
  loadingContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 24px',
  },
  skeletonLogo: {
    animation: 'fade-in 0.5s ease',
  },
};
