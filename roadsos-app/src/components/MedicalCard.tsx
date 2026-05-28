import { DEFAULT_MEDICAL } from '../types';

interface MedicalCardProps {
  variant?: 'collapsed' | 'expanded';
}

export default function MedicalCard({ variant = 'collapsed' }: MedicalCardProps) {
  if (variant === 'collapsed') {
    return (
      <div style={styles.collapsedContainer} className="responsive-medical-card-inner">
        <div style={styles.collapsedContent}>
          <span style={styles.collapsedIcon}>🆔</span>
          <span style={styles.collapsedText}>
            Medical ID — {DEFAULT_MEDICAL.bloodType} | {DEFAULT_MEDICAL.emergencyContact}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.expandedContainer}>
      <div style={styles.header}>
        <span style={styles.headerIcon}>🆘</span>
        <span style={styles.headerTitle}>PARAMEDIC QUICK-READ</span>
      </div>
      <div style={styles.grid}>
        <div style={styles.field}>
          <span style={styles.label}>Blood Type</span>
          <span style={styles.value}>{DEFAULT_MEDICAL.bloodType}</span>
        </div>
        <div style={styles.field}>
          <span style={styles.label}>Emergency Contact</span>
          <span style={styles.value}>{DEFAULT_MEDICAL.emergencyContact}</span>
        </div>
        <div style={styles.field}>
          <span style={styles.label}>Allergies</span>
          <span style={styles.value}>{DEFAULT_MEDICAL.allergies}</span>
        </div>
        <div style={styles.field}>
          <span style={styles.label}>Medications</span>
          <span style={styles.value}>{DEFAULT_MEDICAL.medications}</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  collapsedContainer: {
    margin: '0 16px 8px',
    flexShrink: 0,
  },
  collapsedContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '8px',
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
  collapsedIcon: {
    fontSize: '14px',
  },
  collapsedText: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--trust-safe)',
    fontFamily: 'var(--font-mono)',
  },
  expandedContainer: {
    padding: '16px',
    borderRadius: '16px',
    background: 'var(--bg-secondary)',
    border: '1px solid rgba(249, 250, 251, 0.06)',
    animation: 'slide-up 0.3s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  headerIcon: {
    fontSize: '18px',
  },
  headerTitle: {
    fontSize: '12px',
    fontWeight: '800',
    letterSpacing: '2px',
    color: 'var(--text-secondary)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  label: {
    fontSize: '10px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  value: {
    fontSize: '15px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
  },
};
