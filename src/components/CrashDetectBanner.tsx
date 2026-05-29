import type { CrashDetectStatus } from '../hooks/useCrashDetection';

interface CrashDetectBannerProps {
  status: CrashDetectStatus;
  impactDetected: boolean;
  loudDetected: boolean;
  permissionDenied: boolean;
}

export default function CrashDetectBanner({
  status,
  impactDetected,
  loudDetected,
  permissionDenied,
}: CrashDetectBannerProps) {
  // Don't show anything if crash detection hasn't started or if it was already triggered
  if (status === 'inactive' || status === 'triggered') return null;

  const isReady = status === 'monitoring' || status === 'audio-ready' || status === 'listening';

  return (
    <div style={styles.banner} className="responsive-crash-banner">
      {/* Icon */}
      <span style={styles.icon}>
        {isReady ? '📳' : '📳'}
      </span>

      {/* Text */}
      <span style={styles.text}>
        {status === 'listening' && 'Crash detection active (impact only — mic unavailable)'}
        {status === 'audio-ready' && 'Crash detection ready — calibrating audio…'}
        {status === 'monitoring' && 'Crash detection active — monitoring impact + audio'}
      </span>

      {/* Status */}
      <div style={styles.statusGroup}>
        {status === 'monitoring' && (
          <>
            <div style={{
              ...styles.dot,
              background: impactDetected ? '#EF4444' : '#10B981',
            }} />
            <span style={styles.dotLabel}>Impact</span>
            <div style={{
              ...styles.dot,
              background: loudDetected ? '#F59E0B' : '#10B981',
            }} />
            <span style={styles.dotLabel}>Audio</span>
          </>
        )}
        {status === 'listening' && (
          <div style={{
            ...styles.dot,
            background: impactDetected ? '#EF4444' : '#10B981',
          }} />
        )}
        {permissionDenied && (
          <span style={styles.warnIcon}>⚠️</span>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    margin: '0 16px 8px',
    borderRadius: '10px',
    background: 'rgba(16, 185, 129, 0.06)',
    border: '1px solid rgba(16, 185, 129, 0.12)',
  },
  icon: {
    fontSize: '14px',
  },
  text: {
    flex: 1,
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  statusGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    transition: 'background 0.3s ease',
  },
  dotLabel: {
    fontSize: '9px',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    marginRight: '4px',
  },
  warnIcon: {
    fontSize: '12px',
  },
};
