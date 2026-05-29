import { useState, useEffect, useRef, useCallback } from 'react';

export type CrashDetectStatus = 'inactive' | 'listening' | 'audio-ready' | 'monitoring' | 'triggered';

interface CrashDetectionOptions {
  onCrashDetected: () => void;
  onImpactDetected?: () => void;
}

// Impact threshold in m/s². Normal gravity is ~9.8.
// A sudden spike above 20 m/s² (~2g) indicates a hard impact/drop.
const IMPACT_THRESHOLD = 20;

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
        impactTimeRef.current = Date.now();
        scheduleExpiry(impactTimeRef);
        setImpactDetected(true);
        checkCoTrigger();
        // Fire fall/impact detected callback for auto-SOS countdown
        onImpactDetected?.();
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
