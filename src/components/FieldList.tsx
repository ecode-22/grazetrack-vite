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
          <button
            type="button"
            key={f.id}
            className={`field-item${selectedFieldId === f.id ? ' selected' : ''}`}
            onClick={() => onSelect(f.id)}
            aria-pressed={selectedFieldId === f.id}
          >
            <span className="field-dot" style={{ background: f.color }} />
            <span className="field-item-info">
              <span className="field-item-name">{f.name}</span>
              <span className="field-item-meta">
                {f.areaHa.toFixed(1)} ha · {cap(f.type)}
              </span>
            </span>
            <span className={`pill pill-${s.cls}`}>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
