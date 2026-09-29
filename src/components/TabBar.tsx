export type Tab = 'map' | 'dashboard' | 'rotation' | 'reports' | 'analytics';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'map', label: 'Map', icon: '🗺' },
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'rotation', label: 'Rotation', icon: '↻' },
  { id: 'reports', label: 'Reports', icon: '▤' },
  { id: 'analytics', label: 'Analytics', icon: '▥' },
];

interface Props {
  active: Tab;
  farmName: string;
  onChange: (tab: Tab) => void;
  onMenu: () => void;
}

export default function TabBar({ active, farmName, onChange, onMenu }: Props) {
  return (
    <nav className="tab-bar">
      <button className="mobile-nav-toggle" onClick={onMenu} aria-label="Open farm menu" title="Open farm menu">
        <span aria-hidden="true">☰</span>
      </button>
      <div className="workspace-farm" title={farmName}>
        <span>Farm</span><strong>{farmName}</strong>
      </div>
      <div className="tab-links" role="tablist" aria-label="Farm workspace">
        {TABS.map((tab) => (
        <button key={tab.id} role="tab" aria-selected={active === tab.id} className={`tab${active === tab.id ? ' active' : ''}`} onClick={() => onChange(tab.id)}>
          <span className="tab-icon" aria-hidden="true">{tab.icon}</span><span>{tab.label}</span>
        </button>
      ))}
      </div>
    </nav>
  );
}
