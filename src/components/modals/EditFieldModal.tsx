import { useState } from 'react';
import Modal from './Modal';
import { COLORS, loadFields, saveFields } from '@/lib/localStore';
import type { FieldType } from '@/lib/types';

interface Props {
  fieldId: string;
  onSaved: () => void;
  onClose: () => void;
}

export default function EditFieldModal({ fieldId, onSaved, onClose }: Props) {
  const field = loadFields().find((f) => f.id === fieldId);

  const [name, setName] = useState(field?.name ?? '');
  const [type, setType] = useState<FieldType>(field?.type ?? 'pasture');
  const [restTarget, setRestTarget] = useState(field?.restTarget ?? 42);
  const [maxAU, setMaxAU] = useState(field?.maxAUperHa != null ? String(field.maxAUperHa) : '');
  const [color, setColor] = useState(field?.color ?? COLORS[0]);

  if (!field) return null;

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      alert('Enter a field name.');
      return;
    }
    const fields = loadFields();
    const idx = fields.findIndex((f) => f.id === fieldId);
    if (idx === -1) return;

    fields[idx] = {
      ...fields[idx],
      name: trimmed,
      type,
      restTarget: restTarget || 42,
      maxAUperHa: maxAU ? parseFloat(maxAU) || null : null,
      color,
    };
    saveFields(fields);
    onSaved();
  }

  return (
    <Modal
      title="✎ Edit field"
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Save
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
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="frow">
        <div className="fg">
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as FieldType)}>
            <option value="pasture">Pasture</option>
            <option value="hay">Hay</option>
            <option value="crop">Crop</option>
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
        <input type="number" step="0.1" value={maxAU} onChange={(e) => setMaxAU(e.target.value)} />
      </div>
      <div className="fg">
        <label>Colour</label>
        <div className="color-swatches">
          {COLORS.map((c) => (
            <div
              key={c}
              className={`color-swatch${c === color ? ' chosen' : ''}`}
              style={{ background: c }}
              title={c}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
