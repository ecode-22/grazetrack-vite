import { useState } from 'react';
import Modal from './Modal';
import GroupModal from './GroupModal';
import { loadFields, loadEvents, saveEvents, loadGroups } from '@/lib/localStore';
import { useGtRefresh } from '@/lib/useGtRefresh';
import { uid, todayStr, addDays, groupEmoji } from '@/lib/utils';
import type { AnimalType } from '@/lib/types';

interface Props {
  preFieldId: string | null;
  onSaved: (fieldId: string) => void;
  onClose: () => void;
}

export default function GrazingModal({ preFieldId, onSaved, onClose }: Props) {
  useGtRefresh(); // so a newly-created group shows up in the picker immediately

  const fields = loadFields();
  const groups = loadGroups();

  const [fieldId, setFieldId] = useState(preFieldId ?? fields[0]?.id ?? '');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(groups.length === 0);
  const [animalType, setAnimalType] = useState<AnimalType>('cattle');
  const [count, setCount] = useState('');
  const [herd, setHerd] = useState('');
  const [start, setStart] = useState(todayStr());
  const [end, setEnd] = useState(addDays(todayStr(), 7));
  const [notes, setNotes] = useState('');
  const [showAddGroup, setShowAddGroup] = useState(false);

  if (!fields.length) return null;

  function selectGroup(groupId: string) {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;
    setSelectedGroupId(groupId);
    setAnimalType(g.type);
    setCount(String(g.count));
    setHerd(g.herd || '');
    setManualMode(true); // reveal the (now pre-filled) fields, matches original
  }

  function selectManual() {
    setSelectedGroupId(null);
    setAnimalType('');
    setCount('');
    setHerd('');
    setManualMode(true);
  }

  // Live stocking-rate warning — ported from checkStockingLive()
  const field = fields.find((f) => f.id === fieldId);
  const countNum = parseInt(count);
  let warning: { text: string; alert: boolean } | null = null;
  if (field && countNum && field.maxAUperHa) {
    const auHa = countNum / field.areaHa;
    if (auHa > field.maxAUperHa) {
      warning = { text: `⚠ ${auHa.toFixed(1)} AU/ha exceeds limit of ${field.maxAUperHa} AU/ha.`, alert: true };
    } else if (auHa > field.maxAUperHa * 0.85) {
      warning = { text: `Note: ${auHa.toFixed(1)} AU/ha — approaching limit of ${field.maxAUperHa} AU/ha.`, alert: false };
    }
  }

  function handleSave() {
    if (!start || !end) {
      alert('Enter start and end dates.');
      return;
    }
    if (end < start) {
      alert('End date must be on or after start date.');
      return;
    }
    const trimmedType = (animalType || '').trim();
    if (!trimmedType) {
      alert('Select a group or enter an animal type.');
      return;
    }
    if (!countNum || countNum < 1) {
      alert('Enter the number of animals.');
      return;
    }

    const events = loadEvents();
    events.push({
      id: uid(),
      fieldId,
      startDate: start,
      endDate: end,
      animalType: trimmedType,
      animalCount: countNum,
      herd: herd.trim(),
      notes: notes.trim(),
      loggedAt: new Date().toISOString(),
    });
    saveEvents(events);
    onSaved(fieldId);
  }

  return (
    <>
      <Modal
        title="🐄 Log Grazing Event"
        onClose={onClose}
        footer={
          <>
            <button className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSave}>
              Save event
            </button>
          </>
        }
      >
        <div className="fg">
          <label>Field</label>
          <select value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ margin: '10px 0' }}>
          {!groups.length ? (
            <div className="grp-none">
              <p className="grp-none-msg">No saved animal groups yet</p>
              <button className="grp-none-add" onClick={() => setShowAddGroup(true)}>
                + Create an animal group
              </button>
              <p className="grp-none-or">Fill in manually below</p>
            </div>
          ) : (
            <>
              <div className="grp-header">Select a group or enter manually:</div>
              <div className="grp-cards">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`grp-card${selectedGroupId === g.id ? ' selected' : ''}`}
                    onClick={() => selectGroup(g.id)}
                  >
                    <div className="grp-card-icon">{groupEmoji(g.type)}</div>
                    <div className="grp-card-name">{g.name}</div>
                    <div className="grp-card-sub">
                      {g.count} {g.type}
                      {g.herd ? ` · ${g.herd}` : ''}
                    </div>
                  </button>
                ))}
                <button
                  type="button"
                  className={`grp-card grp-card-manual${selectedGroupId === null && manualMode ? ' selected' : ''}`}
                  onClick={selectManual}
                >
                  <div className="grp-card-icon">✎</div>
                  <div className="grp-card-name">Manual</div>
                  <div className="grp-card-sub">Enter details</div>
                </button>
              </div>
            </>
          )}
        </div>

        {manualMode && (
          <div>
            <div className="frow">
              <div className="fg">
                <label>Animal type</label>
                <select value={animalType} onChange={(e) => setAnimalType(e.target.value)}>
                  <option value="cattle">🐄 Cattle</option>
                  <option value="sheep">🐑 Sheep</option>
                  <option value="goats">🐐 Goats</option>
                  <option value="horses">🐎 Horses</option>
                  <option value="pigs">🐷 Pigs</option>
                  <option value="mixed">🐾 Mixed</option>
                </select>
              </div>
              <div className="fg">
                <label>Number</label>
                <input type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} />
              </div>
            </div>
            <div className="fg">
              <label>Herd name</label>
              <input type="text" value={herd} onChange={(e) => setHerd(e.target.value)} />
            </div>
          </div>
        )}

        <div className="frow">
          <div className="fg">
            <label>Start date</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="fg">
            <label>End date</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="fg">
          <label>Notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {warning && <div className={`warn-box${warning.alert ? ' alert' : ''}`}>{warning.text}</div>}
      </Modal>

      {showAddGroup && (
        <GroupModal
          editId={null}
          onClose={() => setShowAddGroup(false)}
          onSaved={(newId) => {
            setShowAddGroup(false);
            selectGroup(newId);
          }}
        />
      )}
    </>
  );
}
