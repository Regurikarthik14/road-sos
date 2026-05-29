import { useState, useEffect, useRef, useCallback } from 'react';

export type FireStatus = 'normal' | 'elevated' | 'fire-alert';
export type DispatchStatus = 'idle' | 'dispatched';

interface FireState {
  temperature: number;
  fireStatus: FireStatus;
  dispatchStatus: DispatchStatus;
  fireEngineEta: string;
  ambulanceEta: string;
}

const TEMP_NORMAL_MAX = 35;
const TEMP_FIRE_THRESHOLD = 50;

interface UseFireDetectionOptions {
  onFireDetected?: () => void;
}

export function useFireDetection({ onFireDetected }: UseFireDetectionOptions = {}) {
  const [state, setState] = useState<FireState>({
    temperature: 28,
    fireStatus: 'normal',
    dispatchStatus: 'idle',
    fireEngineEta: '',
    ambulanceEta: '',
  });

  const fireDispatchedRef = useRef(false);
  const onFireDetectedRef = useRef(onFireDetected);
  onFireDetectedRef.current = onFireDetected;

  // Simulate real-time temperature readings
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => {
        const variance = (Math.random() - 0.5) * 3;
        const spikeChance = Math.random();

        let newTemp: number;
        if (spikeChance < 0.02) {
          newTemp = prev.temperature + 15 + Math.random() * 20;
        } else if (spikeChance < 0.05) {
          newTemp = prev.temperature + 5 + Math.random() * 8;
        } else {
          newTemp = Math.max(15, Math.min(60, prev.temperature + variance));
        }

        newTemp = Math.round(newTemp * 10) / 10;

        let fireStatus: FireStatus = 'normal';
        if (newTemp > TEMP_FIRE_THRESHOLD) fireStatus = 'fire-alert';
        else if (newTemp > TEMP_NORMAL_MAX) fireStatus = 'elevated';

        // Auto-dispatch on fire alert
        if (fireStatus === 'fire-alert' && !fireDispatchedRef.current) {
          fireDispatchedRef.current = true;
          setTimeout(() => onFireDetectedRef.current?.(), 0);
          return {
            ...prev,
            temperature: newTemp,
            fireStatus,
            dispatchStatus: 'dispatched',
            fireEngineEta: `${Math.round(5 + Math.random() * 7)} min`,
            ambulanceEta: `${Math.round(4 + Math.random() * 6)} min`,
          };
        }

        if (fireStatus === 'normal' && prev.fireStatus === 'fire-alert') {
          fireDispatchedRef.current = false;
        }

        return { ...prev, temperature: newTemp, fireStatus };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const resetFireAlert = useCallback(() => {
    fireDispatchedRef.current = false;
    setState(prev => ({
      ...prev,
      fireStatus: 'normal',
      dispatchStatus: 'idle',
      fireEngineEta: '',
      ambulanceEta: '',
    }));
  }, []);

  return {
    temperature: state.temperature,
    fireStatus: state.fireStatus,
    dispatchStatus: state.dispatchStatus,
    fireEngineEta: state.fireEngineEta,
    ambulanceEta: state.ambulanceEta,
    resetFireAlert,
  };
}
