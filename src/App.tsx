import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Routes, Route, Link } from 'react-router-dom';
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
  const [needsSetup, setNeedsSetup] = useState(() => !loadFarmProfile());

  useEffect(() => {
    function updateAuthentication() {
      const signedIn = hasApiSession();
      setAuthenticated(signedIn);
      if (!signedIn) setNeedsSetup(!loadFarmProfile());
    }

    window.addEventListener('gt:auth-changed', updateAuthentication);
    if (authenticated) {
      void pullFromApiIfNewer().finally(() => setNeedsSetup(!loadFarmProfile()));
    }

    return () => window.removeEventListener('gt:auth-changed', updateAuthentication);
  }, [authenticated]);

  if (!authenticated) {
    return <Login onAuthenticated={() => setAuthenticated(true)} />;
  }

  return needsSetup
    ? <Onboarding onComplete={() => setNeedsSetup(false)} />
    : <Home />;
}

function PrivacyPolicy() {
  return (
    <main>
      <h1>Privacy Policy</h1>
      <p>Last updated: 3 November 2026</p>
      <p>
        GrazeTrack is a demonstration application. We may collect information
        you enter, such as account details and farm information, to provide and
        test the app. Hosting or database providers used to run the app may
        process technical or submitted data on our behalf.
      </p>
      <p>
        We do not sell your personal information. Avoid entering sensitive
        information into this demo. Information may be retained in the app’s
        local storage or configured backend; contact us to ask about access,
        correction, or deletion.
      </p>
      <p>
        If you are in South Africa, you may have rights under POPIA. For
        privacy questions or requests, email{' '}
        <a href="mailto:grazetrack@gmail.com">grazetrack@gmail.com</a>.
      </p>
      <p><Link to="/">Return to GrazeTrack</Link></p>
    </main>
  );
}

function TermsOfUse() {
  return (
    <main>
      <h1>Terms of Use</h1>
      <p>Last updated: 3 November 2026</p>
      <p>
        GrazeTrack is an experimental demo provided “as is” and “as available”
        for testing. It may contain errors, change, become unavailable, or lose
        data. Keep your own backups and do not rely on the app as the sole
        source for important decisions.
      </p>
      <p>
        Use the app responsibly and only submit information you are authorized
        to provide. To the extent permitted by applicable law, we disclaim
        warranties and liability for issues arising from use of the demo.
        Nothing in these terms limits rights or liability that cannot legally
        be limited.
      </p>
      <p><Link to="/">Return to GrazeTrack</Link></p>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Startup />} />
        <Route path="/reset-password" element={<PasswordReset />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/account" element={<Account />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfUse />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;