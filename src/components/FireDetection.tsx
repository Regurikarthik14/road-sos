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
    borderRadius: '10px',
    padding: '8px 12px',
    margin: '0 16px 6px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
  },
  headerIcon: {
    fontSize: '13px',
  },
  headerTitle: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    flex: 1,
  },
  statusBadge: {
    padding: '2px 6px',
    borderRadius: '5px',
    border: '1px solid',
    fontSize: '9px',
    fontWeight: '700',
    letterSpacing: '0.2px',
  },
  tempRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '2px',
    marginBottom: '4px',
  },
  tempValue: {
    fontSize: '22px',
    fontWeight: '900',
    fontFamily: 'var(--font-mono)',
    lineHeight: 1,
    transition: 'color 0.5s ease',
  },
  tempUnit: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    marginTop: '3px',
  },
  tempBar: {
    width: '100%',
    height: '4px',
    borderRadius: '2px',
    background: 'var(--bg-secondary)',
    position: 'relative',
    overflow: 'visible',
    marginBottom: '10px',
  },
  tempBarFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 1s ease',
  },
  tempBarLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: '2px',
    position: 'absolute',
    top: '6px',
  },
  tempBarLabel: {
    fontSize: '10px',
    color: 'var(--text-dim)',
    fontWeight: '600',
  },
  fireAlertPanel: {
    marginTop: '6px',
    padding: '8px',
    borderRadius: '8px',
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.3)',
    animation: 'fade-in 0.3s ease',
  },
  fireAlertHeader: {
    fontSize: '12px',
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: '1px',
    marginBottom: '3px',
  },
  fireAlertText: {
    fontSize: '10px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    marginBottom: '6px',
  },
  dispatchInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    marginBottom: '6px',
  },
  dispatchRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '3px 6px',
    borderRadius: '4px',
    background: 'var(--bg-secondary)',
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  dispatchEta: {
    color: '#FCD34D',
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    fontWeight: '700',
  },
  resetBtn: {
    width: '100%',
    padding: '4px 0',
    borderRadius: '6px',
    border: '1px solid rgba(239,68,68,0.3)',
    background: 'rgba(239,68,68,0.08)',
    color: '#EF4444',
    fontSize: '10px',
    fontWeight: '700',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  warningBanner: {
    marginTop: '4px',
    padding: '4px 8px',
    borderRadius: '5px',
    background: 'rgba(245,158,11,0.1)',
    fontSize: '10px',
    fontWeight: '600',
    color: '#F59E0B',
    textAlign: 'center',
  },
};
