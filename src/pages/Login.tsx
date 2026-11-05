import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authenticate } from '@/lib/api';
import { pullFromApiIfNewer } from '@/lib/sync';

export default function Login({ onAuthenticated }: { onAuthenticated?: () => void }) {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signup' && password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      await authenticate(email, password, mode, confirmPassword, fullName);
      await pullFromApiIfNewer();
      if (onAuthenticated) onAuthenticated();
      else navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect to the account service. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <header className="auth-brand">
        <span className="auth-brand-mark" aria-hidden="true">G</span>
        <span>GrazingTrack</span>
        <span className="auth-brand-caption">FARM MANAGEMENT</span>
      </header>
      <section className={`auth-panel${mode === 'signup' ? ' is-signup' : ''}`} aria-label={mode === 'signin' ? 'Sign in' : 'Create account'}>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-eyebrow">YOUR FARM, IN SYNC</div>
          <h1>{mode === 'signin' ? 'Welcome back' : 'Sign up'}</h1>
          <p className="auth-description">{mode === 'signin' ? 'Sign in to continue to your farm workspace.' : 'Create an account to keep your farm records in sync.'}</p>
          <div className="auth-fields">
            {mode === 'signup' && (
              <div className="auth-field">
                <label htmlFor="auth-full-name">Full name</label>
                <input id="auth-full-name" type="text" autoComplete="name" maxLength={150} required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your full name" />
              </div>
            )}
            <div className="auth-field">
              <label htmlFor="auth-email">Email address</label>
              <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            </div>
            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>
              <input id="auth-password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} />
            </div>
            {mode === 'signup' && (
              <div className="auth-field">
                <label htmlFor="auth-confirm-password">Confirm password</label>
                <input id="auth-confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" />
              </div>
            )}
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="auth-actions">
            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              <span aria-hidden="true">→</span>
            </button>
            <p className="auth-switch">
              {mode === 'signin' ? 'New to GrazingTrack?' : 'Already have an account?'}
              <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setConfirmPassword(''); }}>
                {mode === 'signin' ? 'Create account' : 'Sign in'}
              </button>
            </p>
            {mode === 'signin' && <Link className="auth-forgot" to="/reset-password">Forgot password?</Link>}
          </div>
        </form>
        <aside className="auth-art" aria-label="GrazingTrack farm workspace">
          <div className="auth-art-top"><span>FIELD NOTES</span><span>01 / 04</span></div>
          <div className="auth-field-illustration" aria-hidden="true">
            <div className="auth-hill hill-back" />
            <div className="auth-hill hill-mid" />
            <div className="auth-hill hill-front" />
            <div className="auth-contour contour-one" />
            <div className="auth-contour contour-two" />
            <div className="auth-sun" />
            <div className="auth-field-label">FIELD 04 <span>READY TO GRAZE</span></div>
          </div>
          <div className="auth-art-copy">
            <span>GOOD TO HAVE YOU HERE</span>
            <p>Make every acre<br />work a little smarter.</p>
          </div>
        </aside>
      </section>
      <footer className="auth-footer"><span>GrazingTrack</span><nav aria-label="Legal"><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms of Use</Link></nav></footer>
    </main>
  );
}
