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

export function useHardwareStatus({ onAutoActionTriggered }: UseHardwareStatusOptions = {}) {
  const [state, setState] = useState<HardwareState>({
    cpuHealth: 98,
    batteryHealth: 95,
    sensorHealth: 100,
    overallStatus: 'healthy',
    ownerCallStatus: 'idle',
    ownerCallCountdown: 15,
    damageDetails: [],
  });

  const countdownRef = useRef<number | null>(null);
  const criticalTriggeredRef = useRef(false);
  const onAutoActionRef = useRef(onAutoActionTriggered);
  onAutoActionRef.current = onAutoActionTriggered;

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
        // Simulate small chance of owner answering — cancels the flow
        if (newCountdown < 12 && Math.random() < 0.05) {
          return { ...prev, ownerCallCountdown: 0, ownerCallStatus: 'idle' };
        }
        return { ...prev, ownerCallCountdown: newCountdown };
      });
    }, 1000);
  }, []);

  // Separate effect to react to countdown reaching 0
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

  // Simulate gradual hardware degradation
  useEffect(() => {
    const degradeInterval = setInterval(() => {
      setState(prev => {
        if (prev.overallStatus === 'critical' && criticalTriggeredRef.current) {
          return prev;
        }

        const cpuDrop = Math.random() < 0.1 ? -(Math.random() * 2) : 0;
        const batteryDrop = Math.random() < 0.15 ? -(Math.random() * 1.5) : 0;
        const sensorDrop = Math.random() < 0.08 ? -(Math.random() * 3) : 0;

        const newCpu = Math.max(10, Math.min(100, prev.cpuHealth + cpuDrop));
        const newBattery = Math.max(10, Math.min(100, prev.batteryHealth + batteryDrop));
        const newSensor = Math.max(10, Math.min(100, prev.sensorHealth + sensorDrop));

        const newCpuRounded = Math.round(newCpu * 10) / 10;
        const newBatteryRounded = Math.round(newBattery * 10) / 10;
        const newSensorRounded = Math.round(newSensor * 10) / 10;

        let status: HardwareStatus = 'healthy';
        const details: string[] = [];

        if (newCpuRounded < 30) { status = 'critical'; details.push('CPU overheating'); }
        else if (newCpuRounded < 50) { status = 'degraded'; details.push('CPU temperature elevated'); }

        if (newBatteryRounded < 20) { status = 'critical'; details.push('Battery critically low'); }
        else if (newBatteryRounded < 40) {
          if (status !== 'critical') status = 'degraded';
          details.push('Battery level low');
        }

        if (newSensorRounded < 25) { status = 'critical'; details.push('Sensor array damaged'); }
        else if (newSensorRounded < 50) {
          if (status !== 'critical') status = 'degraded';
          details.push('Sensor accuracy reduced');
        }

        return {
          ...prev,
          cpuHealth: newCpuRounded,
          batteryHealth: newBatteryRounded,
          sensorHealth: newSensorRounded,
          overallStatus: status,
          damageDetails: details,
        };
      });
    }, 3000);

    return () => clearInterval(degradeInterval);
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
    setState({
      cpuHealth: 98,
      batteryHealth: 95,
      sensorHealth: 100,
      overallStatus: 'healthy',
      ownerCallStatus: 'idle',
      ownerCallCountdown: 15,
      damageDetails: [],
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
