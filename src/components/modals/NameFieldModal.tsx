import { useState } from 'react';
import Modal from './Modal';
import type { FieldType } from '@/lib/types';

interface Props {
  onSave: (details: { name: string; type: FieldType; restTarget: number; maxAUperHa: number | null }) => void;
  onCancel: () => void;
}

export default function NameFieldModal({ onSave, onCancel }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<FieldType>('pasture');
  const [restTarget, setRestTarget] = useState(42);
  const [maxAU, setMaxAU] = useState('');

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      alert('Please enter a field name.');
      return;
    }
    onSave({
      name: trimmed,
      type,
      restTarget: restTarget || 42,
      maxAUperHa: maxAU ? parseFloat(maxAU) || null : null,
    });
  }

  return (
    <Modal
      title="✏️ Name your field"
      onClose={onCancel}
      footer={
        <>
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Save field
          </button>
        </>
      }
    >
      <div className="fg">
        <label>Field name</label>
        <input
          type="text"
          autoFocus
          maxLength={40}
          placeholder="e.g. North Paddock"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
      </div>
      <div className="frow">
        <div className="fg">
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as FieldType)}>
            <option value="pasture">🌿 Pasture</option>
            <option value="hay">🌾 Hay</option>
            <option value="crop">🌽 Crop</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="fg">
          <label>Rest target (days)</label>
          <input
            type="number"
            min={1}
            max={365}
            value={restTarget}
            onChange={(e) => setRestTarget(parseInt(e.target.value) || 42)}
          />
        </div>
      </div>
      <div className="fg">
        <label>Max AU/ha</label>
        <input
          type="number"
          step="0.1"
          placeholder="e.g. 2.5"
          value={maxAU}
          onChange={(e) => setMaxAU(e.target.value)}
        />
      </div>
    </Modal>
  );
}
