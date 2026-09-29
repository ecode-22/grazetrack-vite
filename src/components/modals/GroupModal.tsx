import { useState } from 'react';
import Modal from './Modal';
import { loadGroups, saveGroups } from '@/lib/localStore';
import { uid } from '@/lib/utils';
import type { AnimalGroup } from '@/lib/types';

interface Props {
  editId: string | null; // null = creating a new group
  onSaved: (savedId: string) => void;
  onClose: () => void;
}

export default function GroupModal({ editId, onSaved, onClose }: Props) {
  const existing = editId ? loadGroups().find((g) => g.id === editId) : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState(existing?.type ?? 'cattle');
  const [count, setCount] = useState(existing?.count ? String(existing.count) : '');
  const [herd, setHerd] = useState(existing?.herd ?? '');

  function handleSave() {
    const trimmedName = name.trim();
    const trimmedType = type.trim();
    const n = parseInt(count);

    if (!trimmedName) {
      alert('Enter a group name.');
      return;
    }
    if (!trimmedType) {
      alert('Enter an animal type.');
      return;
    }
    if (!n || n < 1) {
      alert('Enter a valid number of animals.');
      return;
    }

    const groups = loadGroups();
    let savedId = editId;

    if (editId) {
      const idx = groups.findIndex((g) => g.id === editId);
      if (idx !== -1) groups[idx] = { ...groups[idx], name: trimmedName, type: trimmedType, count: n, herd };
    } else {
      savedId = 'grp-' + uid();
      const newGroup: AnimalGroup = { id: savedId, name: trimmedName, type: trimmedType, count: n, herd };
      groups.push(newGroup);
    }

    saveGroups(groups);
    onSaved(savedId!);
  }

  return (
    <Modal
      title={editId ? '✎ Edit group' : '🐄 Add animal group'}
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Save group
          </button>
        </>
      }
    >
      <div className="fg">
        <label>Group name</label>
        <input
          type="text"
          autoFocus
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="frow">
        <div className="fg">
          <label>Animal type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
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
        <input type="text" maxLength={40} value={herd} onChange={(e) => setHerd(e.target.value)} />
      </div>
    </Modal>
  );
}
