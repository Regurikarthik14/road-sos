import type { AppView } from '../types';

interface BottomNavProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
}

interface NavItem {
  view: AppView;
  icon: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { view: 'dashboard', icon: '⌂', label: 'Dashboard' },
  { view: 'chat', icon: '💬', label: 'AI Chat' },
  { view: 'failsafe', icon: '🆘', label: 'Emergency' },
];

export default function BottomNav({ activeView, onNavigate }: BottomNavProps) {
  return (
    <nav style={styles.container} aria-label="Main navigation">
      {NAV_ITEMS.map((item) => {
        const isActive = activeView === item.view;
        const isEmergency = item.view === 'failsafe';
        return (
          <button
            key={item.view}
            style={{
              ...styles.navButton,
              ...(isActive && isEmergency ? styles.navButtonActiveEmergency : {}),
              ...(isActive && !isEmergency ? styles.navButtonActive : {}),
            }}
            className="responsive-nav-btn"
            onClick={() => onNavigate(item.view)}
            aria-label={`Navigate to ${item.label}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <span style={{
              ...styles.navIcon,
              ...(isActive && isEmergency ? { color: '#fff' } : {}),
              ...(isActive && !isEmergency ? { color: 'var(--action-alert)' } : {}),
            }} className="responsive-nav-icon">
              {item.icon}
            </span>
            <span style={{
              ...styles.navLabel,
              ...(isActive && isEmergency ? { color: '#fff' } : {}),
              ...(isActive && !isEmergency ? { color: 'var(--action-alert)' } : {}),
            }} className="responsive-nav-label">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: '8px 16px',
    paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
    borderTop: '1px solid var(--border-light)',
    background: 'var(--bg-primary)',
    flexShrink: 0,
  },
  navButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    padding: '6px 16px',
    border: 'none',
    borderRadius: '12px',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    minWidth: '64px',
  },
  navButtonActive: {
    background: 'rgba(239, 68, 68, 0.1)',
  },
  navButtonActiveEmergency: {
    background: 'var(--action-alert)',
    boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)',
  },
  navIcon: {
    fontSize: '20px',
    color: 'var(--text-secondary)',
    transition: 'color 0.2s ease',
  },
  navLabel: {
    fontSize: '10px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    transition: 'color 0.2s ease',
  },
};
