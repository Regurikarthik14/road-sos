import { useState, useCallback, useEffect, useRef } from 'react';
import Dashboard from './components/Dashboard';
import ChatCanvas from './components/ChatCanvas';
import FailsafeUI from './components/FailsafeUI';
import BottomNav from './components/BottomNav';
import { useGeolocation } from './hooks/useGeolocation';
import { useCrashDetection } from './hooks/useCrashDetection';
import { useTheme } from './hooks/useTheme';
import type { AppView } from './types';
import './App.css';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [isEmergencyTriggered, setIsEmergencyTriggered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const { userLocation, geoStatus } = useGeolocation();
  const { theme, toggleTheme } = useTheme();
  const [crashTriggered, setCrashTriggered] = useState(false);
  const [fallSignal, setFallSignal] = useState(0);

  // Handle crash detection — auto-trigger failsafe with shorter countdown
  const handleCrashDetected = useCallback(() => {
    setCrashTriggered(true);
    setActiveView('failsafe');
    setIsEmergencyTriggered(true);
  }, []);

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
  }, []);

  const handleCancelEmergency = useCallback(() => {
    setActiveView('dashboard');
    setIsEmergencyTriggered(false);
    setCrashTriggered(false);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
  }, []);

  const handleEmergencyExpire = useCallback(() => {
    // Dispatch logic would go here in production
    // For now, just stay on failsafe with a dispatched state
    setIsEmergencyTriggered(true);
  }, []);

  const handleNavigate = useCallback((view: AppView) => {
    setActiveView(view);
    if (view === 'failsafe') {
      setIsEmergencyTriggered(true);
    } else if (view === 'dashboard') {
      setIsEmergencyTriggered(false);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    }
  }, []);

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
        />
      )}

      {activeView === 'chat' && (
        <ChatCanvas theme={theme} onToggleTheme={toggleTheme} />
      )}

      {activeView === 'failsafe' && (
        <FailsafeUI
          onCancel={handleCancelEmergency}
          onExpire={handleEmergencyExpire}
          onNavigate={handleNavigate}
          userLocation={userLocation}
          crashTriggered={crashTriggered}
        />
      )}

      {/* Bottom Nav — hidden during failsafe for full-screen emergency */}
      {activeView !== 'failsafe' && (
        <BottomNav activeView={activeView} onNavigate={handleNavigate} />
      )}

      {/* Back button for dashboard context — navigates from chat to dashboard */}
      {activeView === 'chat' && (
        <button
          style={{
            position: 'absolute',
            top: 'calc(8px + env(safe-area-inset-top, 0px))',
            left: '8px',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '1px solid rgba(249,250,251,0.1)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: '18px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            outline: 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
          onClick={() => setActiveView('dashboard')}
          aria-label="Back to Dashboard"
        >
          ←
        </button>
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
