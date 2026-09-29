import { useState } from 'react';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { pullFromSupabaseIfNewer } from '@/lib/sync';
import { saveFarmProfile, saveGroups } from '@/lib/localStore';
import { uid } from '@/lib/utils';
import type { AnimalGroup, FarmProfile } from '@/lib/types';

type DeviceMode = FarmProfile['deviceMode'];
type GroupDraft = { name: string; type: AnimalGroup['type']; count: string; herd: string };

const blankGroup = (): GroupDraft => ({ name: '', type: 'cattle', count: '', herd: '' });

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<'choice' | 'account' | 'farm'>('choice');
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('single');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [farmName, setFarmName] = useState('');
  const [groups, setGroups] = useState<GroupDraft[]>([blankGroup()]);
  const [location, setLocation] = useState<FarmProfile['location']>(null);
  const [locationMessage, setLocationMessage] = useState('Location has not been added.');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function chooseMode(mode: DeviceMode) {
    setDeviceMode(mode);
    setError('');
    setNotice('');
    if (mode === 'single') {
      setStep('farm');
      return;
    }
    setStep('account');
    if (!supabaseConfigured()) {
      setError('Multi-device mode needs Supabase configured for this app. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then reload.');
      return;
    }
    setBusy(true);
    try {
      const { data, error: sessionError } = await supabase!.auth.getSession();
      if (sessionError) throw sessionError;
      if (data.session) {
        await pullFromSupabaseIfNewer();
        setStep('farm');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not check your sign-in status.');
    } finally {
      setBusy(false);
    }
  }

  async function submitAccount(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!supabase) {
      setError('Account sync is not configured. Set up Supabase before choosing multi-device mode.');
      return;
    }
    setBusy(true);
    try {
      const result = authMode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (!result.data.session) {
        setAuthMode('signin');
        setNotice('Check your email for the confirmation link, then return here and sign in.');
        return;
      }
      await pullFromSupabaseIfNewer();
      setStep('farm');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete account sign-in. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  function useDeviceLocation() {
    setError('');
    if (!navigator.geolocation) {
      setLocationMessage('This browser does not provide device location. You can continue without it.');
      return;
    }
    setLocationMessage('Requesting location permission…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
        });
        setLocationMessage(`Location added (about ${Math.round(position.coords.accuracy)} m accuracy).`);
      },
      (cause) => {
        setLocationMessage(cause.code === cause.PERMISSION_DENIED
          ? 'Location permission was denied. Allow it in your browser settings to add device location.'
          : 'Could not get a location fix. Try again when location services are available.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  function finishSetup(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!farmName.trim()) {
      setError('Enter your farm name to continue.');
      return;
    }
    if (deviceMode === 'multiple' && !supabase) {
      setError('Multi-device mode needs an account and a working Supabase connection.');
      return;
    }
    const validGroups: AnimalGroup[] = [];
    for (const group of groups) {
      const name = group.name.trim();
      const count = Number.parseInt(group.count, 10);
      if (!name || !Number.isFinite(count) || count < 1) {
        setError('Add a name and a valid animal count for each group.');
        return;
      }
      validGroups.push({ id: `grp-${uid()}`, name, type: group.type, count, herd: group.herd.trim() });
    }
    saveGroups(validGroups);
    saveFarmProfile({ name: farmName.trim(), deviceMode, location });
    onComplete();
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-layout">
        <header className="onboarding-brand">
          <span className="onboarding-mark" aria-hidden="true">G</span>
          <span>GrazingTrack</span>
        </header>
        <section className="onboarding-content">
          <div className="onboarding-kicker">FARM SETUP · {step === 'choice' ? '01' : step === 'account' ? '02' : deviceMode === 'multiple' ? '03' : '02'}</div>
          {step === 'choice' && (
            <>
              <h1>Where will you use GrazingTrack?</h1>
              <p className="onboarding-lead">Choose how your farm data should be available. You can change this later by setting up an account.</p>
              <div className="device-options">
                <button className="device-option" onClick={() => void chooseMode('single')}>
                  <span className="device-icon" aria-hidden="true">▣</span>
                  <span><strong>One device</strong><small>Keep farm data on this device. Works offline, no account needed.</small></span>
                  <span className="device-arrow" aria-hidden="true">→</span>
                </button>
                <button className="device-option" onClick={() => void chooseMode('multiple')}>
                  <span className="device-icon" aria-hidden="true">▤</span>
                  <span><strong>More than one device</strong><small>Create an account or sign in to sync your farm across devices.</small></span>
                  <span className="device-arrow" aria-hidden="true">→</span>
                </button>
              </div>
            </>
          )}
          {step === 'account' && (
            <>
              <h1>{authMode === 'signin' ? 'Sign in to sync your farm' : 'Create your sync account'}</h1>
              <p className="onboarding-lead">Multi-device use requires an account. Your fields, grazing records, groups, and farm profile will sync through Supabase.</p>
              <form className="onboarding-form" onSubmit={submitAccount}>
                <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                <label>Password<input type="password" autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
                {error && <p className="onboarding-message error" role="alert">{error}</p>}
                {notice && <p className="onboarding-message" role="status">{notice}</p>}
                <button className="onboarding-primary" type="submit" disabled={busy || !supabaseConfigured()}>{busy ? 'Connecting…' : authMode === 'signin' ? 'Sign in and continue' : 'Create account'}</button>
              </form>
              <button className="onboarding-text-button" onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setError(''); setNotice(''); }}>
                {authMode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
              </button>
              <button className="onboarding-back" onClick={() => { setStep('choice'); setError(''); setNotice(''); }}>← Choose one device instead</button>
            </>
          )}
          {step === 'farm' && (
            <>
              <h1>Set up your farm</h1>
              <p className="onboarding-lead">Add the basics now. You can edit animal groups and location later.</p>
              <form className="onboarding-form farm-form" onSubmit={finishSetup}>
                <label>Farm name<input autoFocus maxLength={80} required value={farmName} onChange={(event) => setFarmName(event.target.value)} placeholder="e.g. Willow Creek Farm" /></label>
                <div className="setup-section-heading"><strong>Animal groups</strong><button type="button" className="onboarding-text-button" onClick={() => setGroups((items) => [...items, blankGroup()])}>+ Add group</button></div>
                <div className="setup-groups">
                  {groups.map((group, index) => (
                    <div className="setup-group" key={index}>
                      <label>Group name<input required maxLength={40} value={group.name} onChange={(event) => setGroups((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} placeholder="e.g. Main herd" /></label>
                      <div className="setup-group-row">
                        <label>Animal type<select value={group.type} onChange={(event) => setGroups((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value } : item))}><option value="cattle">Cattle</option><option value="sheep">Sheep</option><option value="goats">Goats</option><option value="horses">Horses</option><option value="pigs">Pigs</option><option value="mixed">Mixed</option></select></label>
                        <label>Number<input type="number" min="1" required value={group.count} onChange={(event) => setGroups((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, count: event.target.value } : item))} placeholder="0" /></label>
                      </div>
                      <label>Herd name <span>(optional)</span><input maxLength={40} value={group.herd} onChange={(event) => setGroups((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, herd: event.target.value } : item))} /></label>
                      {groups.length > 1 && <button type="button" className="onboarding-remove" onClick={() => setGroups((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Remove group</button>}
                    </div>
                  ))}
                </div>
                <div className="setup-location">
                  <div><strong>Farm location</strong><small>{locationMessage}</small>{location && <small>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</small>}</div>
                  <button type="button" className="onboarding-location-button" onClick={useDeviceLocation}>⌖ {location ? 'Refresh location' : 'Use device location'}</button>
                </div>
                {error && <p className="onboarding-message error" role="alert">{error}</p>}
                <button className="onboarding-primary" type="submit">Finish setup <span aria-hidden="true">→</span></button>
                <button type="button" className="onboarding-back" onClick={() => setStep(deviceMode === 'multiple' ? 'account' : 'choice')}>← Back</button>
              </form>
            </>
          )}
        </section>
        <footer className="onboarding-footer">{step === 'farm' ? 'Your farm is saved on this device and ready to use offline.' : 'Set up once, then get straight to your fields.'}</footer>
      </div>
      <div className="onboarding-land" aria-hidden="true"><div className="land-sun" /><div className="land-ridge ridge-back" /><div className="land-ridge ridge-front" /><div className="land-line line-one" /><div className="land-line line-two" /><div className="land-line line-three" /></div>
    </main>
  );
}