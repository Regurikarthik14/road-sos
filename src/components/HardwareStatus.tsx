import { useHardwareStatus } from '../hooks/useHardwareStatus';
import type { HardwareStatus, OwnerCallStatus } from '../hooks/useHardwareStatus';

interface HardwareStatusPanelProps {
  onAutoAction?: () => void;
}

export default function HardwareStatusPanel({ onAutoAction }: HardwareStatusPanelProps) {
  const {
    cpuHealth,
    batteryHealth,
    sensorHealth,
    overallStatus,
    ownerCallStatus,
    ownerCallCountdown,
    damageDetails,
    resetHardware,
  } = useHardwareStatus({ onAutoActionTriggered: onAutoAction });

  const getStatusColor = (status: HardwareStatus) => {
    switch (status) {
      case 'healthy': return '#10B981';
      case 'degraded': return '#F59E0B';
      case 'critical': return '#EF4444';
    }
  };

  const getStatusIcon = (overall: HardwareStatus) => {
    switch (overall) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'critical': return '🔴';
    }
  };

  const getHealthColor = (value: number) => {
    if (value > 70) return '#10B981';
    if (value > 40) return '#F59E0B';
    return '#EF4444';
  };

  const getBarWidth = (value: number) => `${Math.max(2, Math.min(100, value))}%`;

  const getCallStatusDisplay = (status: OwnerCallStatus) => {
    switch (status) {
      case 'idle': return null;
      case 'calling': return {
        icon: '📞',
        text: `Calling owner... ${ownerCallCountdown}s`,
        color: '#FCD34D',
      };
      case 'no-answer': return {
        icon: '❌',
        text: 'Owner unreachable',
        color: '#EF4444',
      };
      case 'auto-action': return {
        icon: '⚡',
        text: 'Auto-action initiated — dispatching emergency services',
        color: '#EF4444',
      };
    }
  };

  const callStatus = getCallStatusDisplay(ownerCallStatus);
  const color = getStatusColor(overallStatus);

  return (
    <div style={{
      ...styles.container,
      borderColor: overallStatus === 'critical'
        ? 'rgba(239,68,68,0.4)'
        : overallStatus === 'degraded'
          ? 'rgba(245,158,11,0.3)'
          : 'rgba(16,185,129,0.15)',
      background: overallStatus === 'critical'
        ? 'rgba(239,68,68,0.06)'
        : overallStatus === 'degraded'
          ? 'rgba(245,158,11,0.06)'
          : 'rgba(16,185,129,0.04)',
    }}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerIcon}>⚙️</span>
        <span style={styles.headerTitle}>Hardware Health</span>
        <div style={{
          ...styles.statusBadge,
          background: `${color}22`,
          borderColor: `${color}40`,
          color,
        }}>
          {getStatusIcon(overallStatus)} {overallStatus.toUpperCase()}
        </div>
      </div>

      {/* Health Metrics */}
      <div style={styles.metricsGrid}>
        <div style={styles.metric}>
          <div style={styles.metricHeader}>
            <span style={styles.metricLabel}>CPU</span>
            <span style={{
              ...styles.metricValue,
              color: getHealthColor(cpuHealth),
            }}>{cpuHealth.toFixed(0)}%</span>
          </div>
          <div style={styles.metricBarBg}>
            <div style={{
              ...styles.metricBarFill,
              width: getBarWidth(cpuHealth),
              background: getHealthColor(cpuHealth),
            }} />
          </div>
        </div>
        <div style={styles.metric}>
          <div style={styles.metricHeader}>
            <span style={styles.metricLabel}>Battery</span>
            <span style={{
              ...styles.metricValue,
              color: getHealthColor(batteryHealth),
            }}>{batteryHealth.toFixed(0)}%</span>
          </div>
          <div style={styles.metricBarBg}>
            <div style={{
              ...styles.metricBarFill,
              width: getBarWidth(batteryHealth),
              background: getHealthColor(batteryHealth),
            }} />
          </div>
        </div>
        <div style={styles.metric}>
          <div style={styles.metricHeader}>
            <span style={styles.metricLabel}>Sensors</span>
            <span style={{
              ...styles.metricValue,
              color: getHealthColor(sensorHealth),
            }}>{sensorHealth.toFixed(0)}%</span>
          </div>
          <div style={styles.metricBarBg}>
            <div style={{
              ...styles.metricBarFill,
              width: getBarWidth(sensorHealth),
              background: getHealthColor(sensorHealth),
            }} />
          </div>
        </div>
      </div>

      {/* Damage Details */}
      {damageDetails.length > 0 && (
        <div style={styles.damageList}>
          {damageDetails.map((detail, i) => (
            <div key={i} style={styles.damageItem}>
              <span style={styles.damageIcon}>⚠️</span>
              <span style={styles.damageText}>{detail}</span>
            </div>
          ))}
        </div>
      )}

      {/* Owner Call Status */}
      {callStatus && (
        <div style={{
          ...styles.callPanel,
          borderColor: `${callStatus.color}40`,
          background: `${callStatus.color}12`,
        }}>
          <div style={styles.callRow}>
            <span style={{ fontSize: '18px' }}>{callStatus.icon}</span>
            <div style={styles.callInfo}>
              <span style={{
                fontSize: '13px',
                fontWeight: '700',
                color: callStatus.color,
              }}>
                {callStatus.text}
              </span>
              {ownerCallStatus === 'calling' && (
                <div style={styles.callTimerBar}>
                  <div style={{
                    ...styles.callTimerFill,
                    width: `${((15 - ownerCallCountdown) / 15) * 100}%`,
                  }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reset Button */}
      <button
        onClick={resetHardware}
        style={{
          ...styles.resetBtn,
          color,
          borderColor: `${color}30`,
        }}
      >
        Reset Health Monitor
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderRadius: '12px',
    border: '1px solid',
    padding: '12px 16px',
    margin: '0 16px 8px',
    transition: 'all 0.3s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
  },
  headerIcon: {
    fontSize: '16px',
  },
  headerTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    flex: 1,
  },
  statusBadge: {
    padding: '3px 8px',
    borderRadius: '6px',
    border: '1px solid',
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.3px',
  },
  metricsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '8px',
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  metricHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  metricValue: {
    fontSize: '12px',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    transition: 'color 0.3s ease',
  },
  metricBarBg: {
    width: '100%',
    height: '4px',
    borderRadius: '2px',
    background: 'rgba(249,250,251,0.06)',
    overflow: 'hidden',
  },
  metricBarFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.5s ease, background 0.3s ease',
  },
  damageList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    marginBottom: '8px',
    padding: '8px',
    borderRadius: '8px',
    background: 'rgba(245,158,11,0.06)',
  },
  damageItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  damageIcon: {
    fontSize: '10px',
  },
  damageText: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#F59E0B',
  },
  callPanel: {
    borderRadius: '8px',
    border: '1px solid',
    padding: '10px 12px',
    marginBottom: '8px',
    animation: 'fade-in 0.3s ease',
  },
  callRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  callInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  callTimerBar: {
    width: '100%',
    height: '4px',
    borderRadius: '2px',
    background: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  callTimerFill: {
    height: '100%',
    borderRadius: '2px',
    background: '#FCD34D',
    transition: 'width 1s linear',
  },
  resetBtn: {
    width: '100%',
    padding: '6px 0',
    borderRadius: '8px',
    border: '1px solid',
    background: 'rgba(249,250,251,0.04)',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
};
