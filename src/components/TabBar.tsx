import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentAccount, hasApiSession, logoutAccount } from '@/lib/api';

export type Tab = 'map' | 'dashboard' | 'rotation' | 'reports' | 'analytics';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'map', label: 'Map', icon: '⌖' },
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'rotation', label: 'Rotation', icon: '⟳' },
  { id: 'reports', label: 'Reports', icon: '▤' },
  { id: 'analytics', label: 'Analytics', icon: '⌁' },
];

interface Props {
  active: Tab;
  farmName: string;
  onChange: (tab: Tab) => void;
  onMenu: () => void;
}

export default function TabBar({ active, farmName, onChange, onMenu }: Props) {
  const [accountEmail, setAccountEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!hasApiSession()) {
      setAccountEmail(null);
      return;
    }
    let cancelled = false;
    getCurrentAccount()
      .then((account) => { if (!cancelled) setAccountEmail(account.email); })
      .catch(() => { if (!cancelled) setAccountEmail(null); });
    return () => { cancelled = true; };
  }, []);

  async function signOut() {
    await logoutAccount().catch(() => undefined);
    setAccountEmail(null);
  }

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
      <details className="workspace-account">
        <summary aria-label={accountEmail ? `Account menu for ${accountEmail}` : 'Account menu'} title="Account">
          <span className="workspace-account-avatar" aria-hidden="true">
            {accountEmail?.slice(0, 1).toUpperCase() ?? '·'}
          </span>
          <span className="workspace-account-label">Account</span>
          <span className="workspace-account-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div className="workspace-account-menu">
          {accountEmail ? (
            <>
              <span className="workspace-account-email">{accountEmail}</span>
              <Link to="/account" className="workspace-account-link">Account settings</Link>
              <button type="button" className="workspace-account-signout" onClick={() => void signOut()}>Sign out</button>
            </>
          ) : (
            <Link to="/login" className="workspace-account-link">Sign in to sync</Link>
          )}
        </div>
      </details>
    </nav>
  );
}
