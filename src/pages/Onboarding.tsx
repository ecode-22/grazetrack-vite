import { useState } from 'react';
import { saveFarmProfile, saveGroups } from '@/lib/localStore';
import { uid } from '@/lib/utils';
import type { AnimalGroup, FarmProfile } from '@/lib/types';

type GroupDraft = { name: string; type: AnimalGroup['type']; count: string; herd: string };

const blankGroup = (): GroupDraft => ({ name: '', type: 'cattle', count: '', herd: '' });

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [farmName, setFarmName] = useState('');
  const [groups, setGroups] = useState<GroupDraft[]>([blankGroup()]);
  const [location, setLocation] = useState<FarmProfile['location']>(null);
  const [locationMessage, setLocationMessage] = useState('Location has not been added.');
  const [error, setError] = useState('');

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
    saveFarmProfile({ name: farmName.trim(), deviceMode: 'multiple', location });
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
          <div className="onboarding-kicker">FARM SETUP</div>
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
              </form>
        </section>
        <footer className="onboarding-footer">Your farm data is saved locally and synced to your account when connected.</footer>
      </div>
      <div className="onboarding-land" aria-hidden="true"><div className="land-sun" /><div className="land-ridge ridge-back" /><div className="land-ridge ridge-front" /><div className="land-line line-one" /><div className="land-line line-two" /><div className="land-line line-three" /></div>
    </main>
  );
}