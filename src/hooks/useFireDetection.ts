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
const AMBIENT_BASELINE = 28;

interface UseFireDetectionOptions {
  onFireDetected?: () => void;
}

// Estimate device temperature based on real conditions
function estimateTemperature(
  batteryCharging: boolean,
  batteryLevel: number,
  memoryPressure: number,
  prevTemp: number
): number {
  // Base temp starts at ambient and drifts based on device conditions
  let targetTemp = AMBIENT_BASELINE;

  // Battery charging generates significant heat
  if (batteryCharging) {
    targetTemp += 3 + (1 - batteryLevel) * 4; // More heat when battery is low + charging
  }

  // Memory pressure as proxy for CPU load
  targetTemp += memoryPressure * 6; // 0-1 scale -> up to 6°C added

  // Small natural variance (±0.5°C) for realism
  const variance = (Math.random() - 0.5) * 1.0;

  // Smooth transition toward target (avoids sudden jumps)
  const smoothed = prevTemp + (targetTemp - prevTemp) * 0.15 + variance;

  return Math.round(Math.max(18, Math.min(60, smoothed)) * 10) / 10;
}

function getMemoryPressure(): number {
  try {
    const perfMemory = (performance as unknown as Record<string, unknown>).memory as
      { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } | undefined;
    if (perfMemory && perfMemory.totalJSHeapSize > 0) {
      return perfMemory.usedJSHeapSize / perfMemory.totalJSHeapSize;
    }
  } catch {
    // Memory API not available
  }
  // Fallback: use deviceMemory as a rough proxy
  const deviceMem = (navigator as unknown as Record<string, unknown>).deviceMemory as number | undefined;
  if (deviceMem) {
    // Lower memory = higher pressure (inverse relationship)
    return Math.max(0, Math.min(1, 1 - (deviceMem - 2) / 6));
  }
  return 0.3; // Default moderate pressure
}

export function useFireDetection({ onFireDetected }: UseFireDetectionOptions = {}) {
  const [state, setState] = useState<FireState>({
    temperature: AMBIENT_BASELINE,
    fireStatus: 'normal',
    dispatchStatus: 'idle',
    fireEngineEta: '',
    ambulanceEta: '',
  });

  const fireDispatchedRef = useRef(false);
  const onFireDetectedRef = useRef(onFireDetected);
  onFireDetectedRef.current = onFireDetected;

  // Track real battery status
  const batteryRef = useRef<{ charging: boolean; level: number }>({ charging: false, level: 1 });

  useEffect(() => {
    let battery: { onchargingchange?: () => void; onlevelchange?: () => void; charging: boolean; level: number } | null = null;

    async function initBattery() {
      try {
        const b = await (navigator as unknown as { getBattery: () => Promise<{ charging: boolean; level: number; onchargingchange?: () => void; onlevelchange?: () => void }> }).getBattery();
        battery = b;
        batteryRef.current = { charging: b.charging, level: b.level };

        b.onchargingchange = () => {
          batteryRef.current = { ...batteryRef.current, charging: b.charging };
        };
        b.onlevelchange = () => {
          batteryRef.current = { ...batteryRef.current, level: b.level };
        };
      } catch {
        // Battery API not available — use defaults
      }
    }

    initBattery();

    return () => {
      if (battery) {
        (battery as { onchargingchange?: null; onlevelchange?: null }).onchargingchange = null;
        (battery as { onchargingchange?: null; onlevelchange?: null }).onlevelchange = null;
      }
    };
  }, []);

  // Derive temperature from real device conditions every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => {
        const { charging, level } = batteryRef.current;
        const memPressure = getMemoryPressure();
        const newTemp = estimateTemperature(charging, level, memPressure, prev.temperature);

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
    }, 3000);

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
