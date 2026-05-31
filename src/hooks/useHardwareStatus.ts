import { useState, useEffect, useRef, useCallback } from 'react';

export type HardwareStatus = 'healthy' | 'degraded' | 'critical';
export type OwnerCallStatus = 'idle' | 'calling' | 'no-answer' | 'auto-action';

interface HardwareState {
  cpuHealth: number;
  batteryHealth: number;
  sensorHealth: number;
  overallStatus: HardwareStatus;
  ownerCallStatus: OwnerCallStatus;
  ownerCallCountdown: number;
  damageDetails: string[];
}

interface UseHardwareStatusOptions {
  onAutoActionTriggered?: () => void;
}

// Read memory pressure as proxy for CPU load (0-1 scale)
function getMemoryPressure(): number {
  try {
    const perfMemory = (performance as unknown as Record<string, unknown>).memory as
      { usedJSHeapSize: number; totalJSHeapSize: number } | undefined;
    if (perfMemory && perfMemory.totalJSHeapSize > 0) {
      return perfMemory.usedJSHeapSize / perfMemory.totalJSHeapSize;
    }
  } catch {
    // Memory API not available
  }
  return 0.3;
}

// Compute CPU health from memory pressure and core count
function computeCpuHealth(memoryPressure: number, coreCount: number): number {
  // High memory pressure = CPU is working harder = more wear
  // More cores = better load distribution = less per-core strain
  const coreFactor = Math.min(1, coreCount / 4); // 4 cores = ideal, fewer = more strain
  const strain = memoryPressure * (1.5 - coreFactor * 0.5);
  const health = Math.max(10, Math.min(100, 100 - strain * 100));
  return Math.round(health * 10) / 10;
}

// Compute battery health from real battery level and charging cycles
function computeBatteryHealth(
  batteryLevel: number,
  isCharging: boolean
): number {
  // Real battery level directly maps to health (level 0.8 = 80%)
  // Charging while below 20% causes extra wear
  let health = batteryLevel * 100;
  if (isCharging && batteryLevel < 0.2) {
    health -= 5; // Small penalty for deep-cycle charging
  }
  return Math.max(10, Math.min(100, Math.round(health * 10) / 10));
}

// Check which sensors are actually available on the device
function checkSensorAvailability(): { available: number; total: number; details: string[] } {
  const available: string[] = [];
  const unavailable: string[] = [];

  // Check DeviceMotion
  if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
    available.push('Motion');
  } else {
    unavailable.push('Motion');
  }

  // Check DeviceOrientation
  if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
    available.push('Orientation');
  } else {
    unavailable.push('Orientation');
  }

  // Check Geolocation
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    available.push('GPS');
  } else {
    unavailable.push('GPS');
  }

  // Check Battery
  if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
    available.push('Battery Sensor');
  } else {
    unavailable.push('Battery Sensor');
  }

  const total = available.length + unavailable.length;
  const health = total > 0 ? (available.length / total) * 100 : 100;

  const details: string[] = [];
  if (unavailable.length > 0) {
    details.push(`Sensor${unavailable.length > 1 ? 's' : ''} unavailable: ${unavailable.join(', ')}`);
  }

  return {
    available: Math.round(health * 10) / 10,
    total,
    details,
  };
}

export function useHardwareStatus({ onAutoActionTriggered }: UseHardwareStatusOptions = {}) {
  const [state, setState] = useState<HardwareState>(() => {
    const cpuCores = navigator.hardwareConcurrency || 2;
    const initMemPressure = getMemoryPressure();
    const initCpu = computeCpuHealth(initMemPressure, cpuCores);
    const sensors = checkSensorAvailability();

    return {
      cpuHealth: initCpu,
      batteryHealth: 95, // Will be updated by Battery API
      sensorHealth: sensors.available,
      overallStatus: 'healthy',
      ownerCallStatus: 'idle',
      ownerCallCountdown: 15,
      damageDetails: sensors.details,
    };
  });

  const countdownRef = useRef<number | null>(null);
  const criticalTriggeredRef = useRef(false);
  const onAutoActionRef = useRef(onAutoActionTriggered);
  onAutoActionRef.current = onAutoActionTriggered;

  // Track real battery status
  const batteryRef = useRef<{ charging: boolean; level: number }>({ charging: false, level: 1 });

  // Initialize Battery API once
  useEffect(() => {
    let batteryMonitor: { onchargingchange?: () => void; onlevelchange?: () => void } | null = null;

    async function initBattery() {
      try {
        const b = await (navigator as unknown as { getBattery: () => Promise<{ charging: boolean; level: number; onchargingchange?: () => void; onlevelchange?: () => void }> }).getBattery();
        batteryRef.current = { charging: b.charging, level: b.level };
        batteryMonitor = b;

        b.onchargingchange = () => {
          batteryRef.current = { ...batteryRef.current, charging: b.charging };
        };
        b.onlevelchange = () => {
          batteryRef.current = { ...batteryRef.current, level: b.level };
        };
      } catch {
        // Battery API not available
      }
    }

    initBattery();

    return () => {
      if (batteryMonitor) {
        (batteryMonitor as { onchargingchange?: null; onlevelchange?: null }).onchargingchange = null;
        (batteryMonitor as { onchargingchange?: null; onlevelchange?: null }).onlevelchange = null;
      }
    };
  }, []);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current !== null) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const startOwnerCallCountdown = useCallback(() => {
    if (countdownRef.current) return;

    setState(prev => ({
      ...prev,
      ownerCallStatus: 'calling',
      ownerCallCountdown: 15,
    }));

    countdownRef.current = window.setInterval(() => {
      setState(prev => {
        const newCountdown = prev.ownerCallCountdown - 1;
        if (newCountdown <= 0) return { ...prev, ownerCallCountdown: 0 };
        // Small chance owner answers — realistic simulation
        if (newCountdown < 12 && Math.random() < 0.05) {
          return { ...prev, ownerCallCountdown: 0, ownerCallStatus: 'idle' };
        }
        return { ...prev, ownerCallCountdown: newCountdown };
      });
    }, 1000);
  }, []);

  // React to countdown reaching 0
  useEffect(() => {
    if (state.ownerCallCountdown === 0 && state.ownerCallStatus === 'calling') {
      clearCountdown();
      criticalTriggeredRef.current = true;
      setState(prev => ({
        ...prev,
        ownerCallStatus: 'auto-action',
      }));
      onAutoActionRef.current?.();
    }
  }, [state.ownerCallCountdown, state.ownerCallStatus, clearCountdown]);

  // Poll real hardware metrics every 5 seconds
  useEffect(() => {
    const cpuCores = navigator.hardwareConcurrency || 2;

    const pollInterval = setInterval(() => {
      setState(prev => {
        if (prev.overallStatus === 'critical' && criticalTriggeredRef.current) {
          return prev;
        }

        // CPU: based on memory pressure + core count
        const memPressure = getMemoryPressure();
        const newCpu = computeCpuHealth(memPressure, cpuCores);

        // Battery: based on real battery API
        const { charging, level } = batteryRef.current;
        const newBattery = computeBatteryHealth(level, charging);

        // Sensors: check availability (stable — rarely changes at runtime)
        const sensors = checkSensorAvailability();
        const newSensor = sensors.available;

        let status: HardwareStatus = 'healthy';
        const details: string[] = [];

        if (newCpu < 30) { status = 'critical'; details.push('CPU overheating'); }
        else if (newCpu < 50) { status = 'degraded'; details.push('CPU temperature elevated'); }

        if (newBattery < 20) { status = 'critical'; details.push('Battery critically low'); }
        else if (newBattery < 40) {
          if (status !== 'critical') status = 'degraded';
          details.push('Battery level low');
        }

        if (newSensor < 25) { status = 'critical'; details.push('Sensor array damaged'); }
        else if (newSensor < 50) {
          if (status !== 'critical') status = 'degraded';
          details.push('Sensor accuracy reduced');
        }

        // Add unavailable sensor details if any
        if (sensors.details.length > 0 && !details.some(d => d.includes('unavailable'))) {
          details.push(...sensors.details);
        }

        return {
          ...prev,
          cpuHealth: newCpu,
          batteryHealth: newBattery,
          sensorHealth: newSensor,
          overallStatus: status,
          damageDetails: details,
        };
      });
    }, 5000);

    return () => clearInterval(pollInterval);
  }, []);

  // React to newly critical status — trigger owner call
  useEffect(() => {
    if (state.overallStatus === 'critical' && state.ownerCallStatus === 'idle' && !criticalTriggeredRef.current) {
      startOwnerCallCountdown();
    }
  }, [state.overallStatus, state.ownerCallStatus, startOwnerCallCountdown]);

  const resetHardware = useCallback(() => {
    clearCountdown();
    criticalTriggeredRef.current = false;
    const cpuCores = navigator.hardwareConcurrency || 2;
    const memPressure = getMemoryPressure();
    const sensors = checkSensorAvailability();
    const { charging, level } = batteryRef.current;

    setState({
      cpuHealth: computeCpuHealth(memPressure, cpuCores),
      batteryHealth: computeBatteryHealth(level, charging),
      sensorHealth: sensors.available,
      overallStatus: 'healthy',
      ownerCallStatus: 'idle',
      ownerCallCountdown: 15,
      damageDetails: sensors.details,
    });
  }, [clearCountdown]);

  return {
    cpuHealth: state.cpuHealth,
    batteryHealth: state.batteryHealth,
    sensorHealth: state.sensorHealth,
    overallStatus: state.overallStatus,
    ownerCallStatus: state.ownerCallStatus,
    ownerCallCountdown: state.ownerCallCountdown,
    damageDetails: state.damageDetails,
    resetHardware,
  };
}
