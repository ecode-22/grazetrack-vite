import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
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

function FeedbackForm() {
  const [type, setType] = useState<'Review' | 'Bug report'>('Review');
  const [rating, setRating] = useState('');
  const [message, setMessage] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const subject = `GrazeTrack ${type}`;
    const body = [
      `Type: ${type}`,
      type === 'Review' && rating ? `Rating: ${rating}/5` : '',
      '',
      message.trim(),
    ].filter(Boolean).join('\n');

    window.location.href =
      `mailto:grazetrack@gmail.com?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
  }

  return (
    <details>
      <summary>Send a review or bug report</summary>
      <form onSubmit={handleSubmit}>
        <p>
          <label htmlFor="feedback-type">Feedback type </label>
          <select
            id="feedback-type"
            value={type}
            onChange={(event) => setType(event.target.value as 'Review' | 'Bug report')}
          >
            <option>Review</option>
            <option>Bug report</option>
          </select>
        </p>

        {type === 'Review' && (
          <p>
            <label htmlFor="feedback-rating">Rating (optional) </label>
            <select
              id="feedback-rating"
              value={rating}
              onChange={(event) => setRating(event.target.value)}
            >
              <option value="">Choose a rating</option>
              <option value="1">1/5</option>
              <option value="2">2/5</option>
              <option value="3">3/5</option>
              <option value="4">4/5</option>
              <option value="5">5/5</option>
            </select>
          </p>
        )}

        <p>
          <label htmlFor="feedback-message">Message</label>
          <br />
          <textarea
            id="feedback-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
            rows={4}
          />
        </p>

        <button type="submit">Continue to email</button>
      </form>
    </details>
  );
}

function AppFooter() {
  return (
    <footer style={{ marginTop: '2rem', padding: '1rem', borderTop: '1px solid #ccc' }}>
      <nav aria-label="Legal">
        <Link to="/privacy">Privacy Policy</Link>
        {' · '}
        <Link to="/terms">Terms of Use</Link>
      </nav>
      <FeedbackForm />
    </footer>
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
      <AppFooter />
    </BrowserRouter>
  );
}

export default App;