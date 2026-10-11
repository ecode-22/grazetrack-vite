import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { changeAccountPassword, getCurrentAccount, hasApiSession, logoutAccount, type AccountInfo } from '@/lib/api';
import { loadFarmProfile } from '@/lib/localStore';

export default function Account() {
  const navigate = useNavigate();
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    getCurrentAccount()
      .then((current) => { if (!cancelled) setAccount(current); })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load account details.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (!hasApiSession()) return <Navigate to="/login" replace />;

  async function handlePasswordChange(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const result = await changeAccountPassword(currentPassword, newPassword);
      setNotice(result.detail);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update your password.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await logoutAccount().catch(() => undefined);
    navigate('/', { replace: true });
  }

  const farm = loadFarmProfile();

  return (
    <main className="account-page">
      <header className="account-page-header">
        <Link to="/" className="account-back-link">← Farm workspace</Link>
        <span className="account-kicker">ACCOUNT SETTINGS</span>
        <h1>Your account</h1>
        <p>Manage the sign-in connected to your farm records.</p>
      </header>

      <div className="account-grid">
        <section className="card account-profile-card">
          <div className="account-section-heading"><span className="account-avatar">{account?.email.slice(0, 1).toUpperCase() ?? '·'}</span><div><h2>Profile</h2><p>Account details used for farm sync.</p></div></div>
          {loading ? <p className="account-muted">Loading account details…</p> : (
            <dl className="account-details">
              <div><dt>Email</dt><dd>{account?.email ?? 'Unavailable'}</dd></div>
              <div><dt>Farm</dt><dd>{farm?.name || 'Farm name not set'}</dd></div>
              <div><dt>Member since</dt><dd>{account ? new Date(account.date_joined).toLocaleDateString() : '—'}</dd></div>
            </dl>
          )}
          <button type="button" className="account-signout-button" onClick={() => void handleSignOut()}>↪ Sign out</button>
        </section>

        <section className="card account-password-card">
          <div className="account-section-heading"><span className="account-key-icon" aria-hidden="true">⌑</span><div><h2>Change password</h2><p>Use at least 8 characters and choose a password you don’t use elsewhere.</p></div></div>
          <form className="account-password-form" onSubmit={handlePasswordChange}>
            <div className="fg"><label htmlFor="current-password">Current password</label><input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div>
            <div className="fg"><label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></div>
            <div className="fg"><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></div>
            {error && <p className="account-message error" role="alert">{error}</p>}
            {notice && <p className="account-message success" role="status">{notice}</p>}
            <button className="btn-primary account-password-submit" type="submit" disabled={busy || loading || !account}>{busy ? 'Updating…' : 'Update password'}</button>
          </form>
        </section>
      </div>
    </main>
  );
}