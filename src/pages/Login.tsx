import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authenticate } from '@/lib/api';
import { pullFromApiIfNewer } from '@/lib/sync';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const wrapStyle: React.CSSProperties = {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: 20,
  };
  const cardStyle: React.CSSProperties = { width: '100%', maxWidth: 360 };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await authenticate(email, password, mode);
      await pullFromApiIfNewer();
      navigate('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect to the account service. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={wrapStyle}>
      <form onSubmit={handleSubmit} className="card" style={cardStyle}>
        <div className="card-title">{mode === 'signin' ? 'Sign in' : 'Create account'}</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 14px' }}>
          Optional — this only enables multi-device sync. Everything already works offline on this
          device without an account.
        </p>
        <div className="fg">
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="fg">
          <label>Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>{error}</p>
        )}
        <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          style={{ width: '100%', marginTop: 8 }}
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </button>
        <Link to="/" style={{ display: 'block', textAlign: 'center', marginTop: 12, fontSize: 12 }}>
          ← Back to the map
        </Link>
      </form>
    </div>
  );
}
