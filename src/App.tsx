import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Onboarding from '@/pages/Onboarding';
import Account from '@/pages/Account';
import PasswordReset from '@/pages/PasswordReset';
import { hasApiSession } from '@/lib/api';
import { loadFarmProfile } from '@/lib/localStore';
import { pullFromApiIfNewer } from '@/lib/sync';

function Startup() {
  const [authenticated, setAuthenticated] = useState(() => hasApiSession());
  const [ready, setReady] = useState(() => !hasApiSession());
  const [needsSetup, setNeedsSetup] = useState(() => !loadFarmProfile());

  useEffect(() => {
    function updateAuthentication() {
      const signedIn = hasApiSession();
      setAuthenticated(signedIn);
      setReady(!signedIn);
    }
    window.addEventListener('gt:auth-changed', updateAuthentication);
    if (authenticated) void pullFromApiIfNewer().finally(() => {
      setAuthenticated(hasApiSession());
      setNeedsSetup(!loadFarmProfile());
      setReady(true);
    });
    return () => window.removeEventListener('gt:auth-changed', updateAuthentication);
  }, [authenticated]);

  if (!authenticated) return <Login onAuthenticated={() => {
    setAuthenticated(true);
    setReady(false);
  }} />;
  if (!ready) return <main className="auth-loading" role="status">Loading your synced farm…</main>;
  return needsSetup ? <Onboarding onComplete={() => setNeedsSetup(false)} /> : <Home />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Startup />} />
        <Route path="/reset-password" element={<PasswordReset />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/account" element={<Account />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
