import { useState, useEffect, useRef, useCallback } from 'react';

export type CrashDetectStatus = 'inactive' | 'listening' | 'audio-ready' | 'monitoring' | 'triggered';

interface CrashDetectionOptions {
  onCrashDetected: () => void;
  onImpactDetected?: () => void;
}

// Impact threshold in m/s². Normal gravity is ~9.8.
// - Casual phone shaking: 10-20 m/s²
// - Jogging with phone: 15-30 m/s²
// - Dropping phone from pocket: 40-80 m/s²
// - Car crash: 80-200+ m/s² (at 30 km/h ~100 m/s²)
// Set high enough to ignore hard shaking, low enough to catch real crashes.
const IMPACT_THRESHOLD = 50;

// Minimum time (ms) between impact triggers to debounce vibration noise
const IMPACT_DEBOUNCE_MS = 3000;

// How many impacts needed within the window to auto-trigger SOS countdown
// Real crashes produce many high-G impacts in rapid succession (tumbling, rolling).
// Requiring 3 makes accidental triggering from shaking virtually impossible.
const IMPACTS_REQUIRED = 3;

// Time window (ms) to count multiple impacts for crash confirmation
const IMPACT_WINDOW_MS = 5000;

// Audio level threshold (0–255 from AnalyserNode). Normal speech ~30-60, loud noise > 150.
const LOUD_THRESHOLD = 150;

// Time window (ms) within which both impact AND loud sound must occur to trigger
const CO_TRIGGER_WINDOW = 2000;

// How long (ms) to keep an impact/loud timestamp before discarding
const STALE_TIMEOUT = CO_TRIGGER_WINDOW + 500;

export function useCrashDetection({ onCrashDetected, onImpactDetected }: CrashDetectionOptions) {
  const [status, setStatus] = useState<CrashDetectStatus>('inactive');
  const [impactDetected, setImpactDetected] = useState(false);
  const [loudDetected, setLoudDetected] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const impactTimeRef = useRef<number | null>(null);
  const loudTimeRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const motionHandlerRef = useRef<((event: DeviceMotionEvent) => void) | null>(null);
  // Track impact timestamps for multi-impact detection
  const impactHistoryRef = useRef<number[]>([]);
  const lastImpactFiredRef = useRef<number>(0);

  // Schedule a ref to expire after the co-trigger window passes
  const scheduleExpiry = (ref: React.MutableRefObject<number | null>) => {
    setTimeout(() => { ref.current = null; }, STALE_TIMEOUT);
  };

  // Clean up all sensors and streams
  const cleanupSensors = useCallback(() => {
    if (motionHandlerRef.current) {
      window.removeEventListener('devicemotion', motionHandlerRef.current);
      motionHandlerRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    dataArrayRef.current = null;
    impactHistoryRef.current = [];
    lastImpactFiredRef.current = 0;
  }, []);

  // Check if both conditions met within the window
  const checkCoTrigger = useCallback(() => {
    const impactT = impactTimeRef.current;
    const loudT = loudTimeRef.current;

    if (impactT !== null && loudT !== null) {
      const diff = Math.abs(impactT - loudT);
      if (diff <= CO_TRIGGER_WINDOW) {
        // Both detected within the window — trigger crash alert!
        setStatus('triggered');
        setImpactDetected(true);
        setLoudDetected(true);
        cleanupSensors();
        onCrashDetected();
      }
    }
  }, [onCrashDetected, cleanupSensors]);

  // Set up accelerometer-based impact detection
  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      return;
    }

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;

      const x = acc.x ?? 0;
      const y = acc.y ?? 0;
      const z = acc.z ?? 0;

      const magnitude = Math.sqrt(x * x + y * y + z * z);

      if (magnitude > IMPACT_THRESHOLD) {
        const now = Date.now();
        impactTimeRef.current = now;
        scheduleExpiry(impactTimeRef);
        setImpactDetected(true);
        checkCoTrigger();

        // Multi-impact detection: track hits within a sliding window
        // This filters out single bumps from real crash patterns.
        impactHistoryRef.current = [
          ...impactHistoryRef.current.filter(t => now - t < IMPACT_WINDOW_MS),
          now,
        ];

        // Debounce: only fire onImpactDetected if enough time has passed since last trigger
        // AND we have enough impacts in the window to confirm a real crash
        if (now - lastImpactFiredRef.current > IMPACT_DEBOUNCE_MS) {
          if (impactHistoryRef.current.length >= IMPACTS_REQUIRED) {
            lastImpactFiredRef.current = now;
            // Fire fall/impact detected callback for auto-SOS countdown
            onImpactDetected?.();
          }
        }
      }
    };

    motionHandlerRef.current = handleMotion;
    window.addEventListener('devicemotion', handleMotion);

    return () => {
      if (motionHandlerRef.current) {
        window.removeEventListener('devicemotion', motionHandlerRef.current);
        motionHandlerRef.current = null;
      }
    };
  }, [checkCoTrigger]);

  // Set up microphone-based loud sound detection
  useEffect(() => {
    let isCancelled = false;

    const startAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (isCancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        mediaStreamRef.current = stream;

        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength) as Uint8Array<ArrayBuffer>;
        dataArrayRef.current = dataArray;

        setStatus('audio-ready');

        const analyze = () => {
          if (!analyserRef.current || !dataArrayRef.current) {
            rafRef.current = requestAnimationFrame(analyze);
            return;
          }

          analyserRef.current.getByteFrequencyData(dataArrayRef.current);

          let sum = 0;
          for (let i = 0; i < dataArrayRef.current.length; i++) {
            sum += dataArrayRef.current[i];
          }
          const avg = sum / dataArrayRef.current.length;

          if (avg > LOUD_THRESHOLD) {
            loudTimeRef.current = Date.now();
            scheduleExpiry(loudTimeRef);
            setLoudDetected(true);
            checkCoTrigger();
          }

          rafRef.current = requestAnimationFrame(analyze);
        };

        setStatus('monitoring');
        rafRef.current = requestAnimationFrame(analyze);
      } catch (err) {
        if (!isCancelled) {
          if (err instanceof DOMException && err.name === 'NotAllowedError') {
            setPermissionDenied(true);
          }
          setStatus('listening');
        }
      }
    };

    const initTimer = setTimeout(() => {
      startAudio();
    }, 2000);

    return () => {
      isCancelled = true;
      clearTimeout(initTimer);
      cleanupSensors();
    };
  }, [checkCoTrigger, cleanupSensors]);

  // Extra cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupSensors();
    };
  }, [cleanupSensors]);

  return { status, impactDetected, loudDetected, permissionDenied };
}
