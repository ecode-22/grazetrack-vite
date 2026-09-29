import { loadFields } from '@/lib/localStore';
import { getStatus } from '@/lib/status';
import { cap } from '@/lib/utils';

interface Props {
  selectedFieldId: string | null;
  onSelect: (id: string) => void;
}

export default function FieldList({ selectedFieldId, onSelect }: Props) {
  const fields = loadFields();

  if (!fields.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🌾</div>
        <p className="empty-msg">No fields yet</p>
        <p className="empty-sub">Use Draw to add a paddock</p>
      </div>
    );
  }

  return (
    <div>
      {fields.map((f) => {
        const s = getStatus(f);
        return (
          <div
            key={f.id}
            className={`field-item${selectedFieldId === f.id ? ' selected' : ''}`}
            onClick={() => onSelect(f.id)}
          >
            <span className="field-dot" style={{ background: f.color }} />
            <div className="field-item-info">
              <div className="field-item-name">{f.name}</div>
              <div className="field-item-meta">
                {f.areaHa.toFixed(1)} ha · {cap(f.type)}
              </div>
            </div>
            <span className={`pill pill-${s.cls}`}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}
