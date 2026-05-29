import { useFireDetection } from '../hooks/useFireDetection';
import type { FireStatus } from '../hooks/useFireDetection';

export default function FireDetection() {
  const { temperature, fireStatus, dispatchStatus, fireEngineEta, ambulanceEta, resetFireAlert } = useFireDetection();

  const getStatusColor = (status: FireStatus) => {
    switch (status) {
      case 'normal': return '#10B981';
      case 'elevated': return '#F59E0B';
      case 'fire-alert': return '#EF4444';
    }
  };

  const getStatusIcon = (status: FireStatus) => {
    switch (status) {
      case 'normal': return '✅';
      case 'elevated': return '⚠️';
      case 'fire-alert': return '🔥';
    }
  };

  const getStatusLabel = (status: FireStatus) => {
    switch (status) {
      case 'normal': return 'Normal';
      case 'elevated': return 'Elevated';
      case 'fire-alert': return 'FIRE ALERT';
    }
  };

  const tempBarPercent = Math.min(100, (temperature / 60) * 100);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerIcon}>🌡️</span>
        <span style={styles.headerTitle}>Temperature Monitor</span>
        <div style={{
          ...styles.statusBadge,
          background: `${getStatusColor(fireStatus)}22`,
          borderColor: `${getStatusColor(fireStatus)}40`,
          color: getStatusColor(fireStatus),
        }}>
          {getStatusIcon(fireStatus)} {getStatusLabel(fireStatus)}
        </div>
      </div>

      {/* Temperature Display */}
      <div style={styles.tempRow}>
        <div style={{
          ...styles.tempValue,
          color: getStatusColor(fireStatus),
        }}>
          {temperature.toFixed(1)}°
        </div>
        <div style={styles.tempUnit}>C</div>
      </div>

      {/* Temperature Bar */}
      <div style={styles.tempBar}>
        <div style={{
          ...styles.tempBarFill,
          width: `${tempBarPercent}%`,
          background: `linear-gradient(90deg, #10B981, ${getStatusColor(fireStatus)})`,
          transition: 'width 1s ease, background 0.5s ease',
        }} />
        <div style={styles.tempBarLabels}>
          <span style={styles.tempBarLabel}>25°C</span>
          <span style={styles.tempBarLabel}>35°C</span>
          <span style={styles.tempBarLabel}>50°C</span>
        </div>
      </div>

      {/* Fire Alert Dispatch */}
      {fireStatus === 'fire-alert' && (
        <div style={styles.fireAlertPanel}>
          <div style={styles.fireAlertHeader}>🚨 FIRE DETECTED</div>
          <div style={styles.fireAlertText}>
            Surrounding temperature critically high ({temperature.toFixed(1)}°C).
            Emergency services notified.
          </div>
          {dispatchStatus === 'dispatched' && (
            <div style={styles.dispatchInfo}>
              <div style={styles.dispatchRow}>
                <span>🚒 Fire Engine</span>
                <span style={styles.dispatchEta}>{fireEngineEta}</span>
              </div>
              <div style={styles.dispatchRow}>
                <span>🚑 Ambulance</span>
                <span style={styles.dispatchEta}>{ambulanceEta}</span>
              </div>
            </div>
          )}
          <button
            onClick={resetFireAlert}
            style={styles.resetBtn}
          >
            Reset Alert
          </button>
        </div>
      )}

      {/* Temperature warning */}
      {fireStatus === 'elevated' && (
        <div style={styles.warningBanner}>
          Temperature elevated — monitoring closely
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(245, 158, 11, 0.06)',
    border: '1px solid rgba(245, 158, 11, 0.15)',
    borderRadius: '12px',
    padding: '12px 16px',
    margin: '0 16px 8px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
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
  tempRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '2px',
    marginBottom: '8px',
  },
  tempValue: {
    fontSize: '32px',
    fontWeight: '900',
    fontFamily: 'var(--font-mono)',
    lineHeight: 1,
    transition: 'color 0.5s ease',
  },
  tempUnit: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    marginTop: '4px',
  },
  tempBar: {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    background: 'var(--bg-secondary)',
    position: 'relative',
    overflow: 'visible',
    marginBottom: '14px',
  },
  tempBarFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 1s ease',
  },
  tempBarLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: '4px',
    position: 'absolute',
    top: '8px',
  },
  tempBarLabel: {
    fontSize: '9px',
    color: 'var(--text-dim)',
    fontWeight: '600',
  },
  fireAlertPanel: {
    marginTop: '8px',
    padding: '12px',
    borderRadius: '10px',
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.3)',
    animation: 'fade-in 0.3s ease',
  },
  fireAlertHeader: {
    fontSize: '14px',
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: '1px',
    marginBottom: '4px',
  },
  fireAlertText: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    marginBottom: '8px',
  },
  dispatchInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '8px',
  },
  dispatchRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: '6px',
    background: 'var(--bg-secondary)',
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  dispatchEta: {
    color: '#FCD34D',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    fontWeight: '700',
  },
  resetBtn: {
    width: '100%',
    padding: '6px 0',
    borderRadius: '8px',
    border: '1px solid rgba(239,68,68,0.3)',
    background: 'rgba(239,68,68,0.08)',
    color: '#EF4444',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  warningBanner: {
    marginTop: '6px',
    padding: '6px 10px',
    borderRadius: '6px',
    background: 'rgba(245,158,11,0.1)',
    fontSize: '11px',
    fontWeight: '600',
    color: '#F59E0B',
    textAlign: 'center',
  },
};
