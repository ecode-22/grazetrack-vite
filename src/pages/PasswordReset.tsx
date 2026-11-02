import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { clearApiSession, confirmPasswordReset, requestPasswordReset } from '@/lib/api';

export default function PasswordReset() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const uid = searchParams.get('uid') ?? '';
  const token = searchParams.get('token') ?? '';
  const completingReset = Boolean(uid && token);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function handleRequest(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const result = await requestPasswordReset(email);
      setNotice(result.detail);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not request a password reset. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const result = await confirmPasswordReset(uid, token, password, confirmPassword);
      setNotice(result.detail);
      clearApiSession();
      window.setTimeout(() => navigate('/', { replace: true }), 1200);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This reset link is invalid or expired. Request a new one.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="password-reset-page">
      <form className="card password-reset-card" onSubmit={completingReset ? handleConfirm : handleRequest}>
        <div className="card-title">{completingReset ? 'Choose a new password' : 'Reset your password'}</div>
        <p className="password-reset-copy">
          {completingReset
            ? 'Choose a new password for your GrazingTrack account.'
            : 'Enter your account email and we will send a password reset link if it matches an account.'}
        </p>
        {!completingReset ? (
          <div className="fg">
            <label htmlFor="reset-email">Email</label>
            <input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
        ) : (
          <>
            <div className="fg">
              <label htmlFor="reset-password">New password</label>
              <input id="reset-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="fg">
              <label htmlFor="reset-confirm-password">Confirm new password</label>
              <input id="reset-confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </div>
          </>
        )}
        {error && <p className="account-message error" role="alert">{error}</p>}
        {notice && <p className="account-message success" role="status">{notice}</p>}
        <button className="btn-primary password-reset-submit" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : completingReset ? 'Reset password' : 'Send reset link'}
        </button>
        <Link className="auth-text-link" to="/">Back to sign in</Link>
      </form>
    </main>
  );
}
