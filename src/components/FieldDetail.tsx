import { loadFields, loadEvents, saveEvents } from '@/lib/localStore';
import { getStatus, getReadinessPct } from '@/lib/status';
import { todayStr, daysSince, daysBetween, fmtDate, cap } from '@/lib/utils';

interface Props {
  fieldId: string;
  onEdit: (id: string) => void;
  onHistory: (id: string) => void;
  onGraze: (id: string) => void;
  onChanged: () => void;
}

export default function FieldDetail({ fieldId, onEdit, onHistory, onGraze, onChanged }: Props) {
  const field = loadFields().find((f) => f.id === fieldId);
  if (!field) return null;

  const events = loadEvents()
    .filter((e) => e.fieldId === fieldId)
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
  const last = events[0];
  const restDays = last ? daysSince(last.endDate) : null;
  const status = getStatus(field);
  const today = todayStr();
  const activeEvent = events.find((e) => e.startDate <= today && e.endDate >= today);
  const pct = getReadinessPct(field);

  let stockWarning: string | null = null;
  if (last && field.maxAUperHa) {
    const auHa = last.animalCount / field.areaHa;
    if (auHa > field.maxAUperHa) {
      stockWarning = `⚠ Last event: ${auHa.toFixed(1)} AU/ha exceeds limit of ${field.maxAUperHa} AU/ha`;
    }
  }

  const barClr = pct >= 100 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#9ca3af';

  function endGrazingToday() {
    if (!activeEvent) return;
    const days = daysBetween(activeEvent.startDate, today);
    if (
      !confirm(
        `End grazing on ${field!.name} today?\n\n${activeEvent.animalCount} ${activeEvent.animalType} · ${days} day${
          days !== 1 ? 's' : ''
        } (${fmtDate(activeEvent.startDate)} → ${fmtDate(today)})\n\nThe rest period will start from today.`,
      )
    )
      return;

    const all = loadEvents();
    const ev = all.find((e) => e.id === activeEvent.id);
    if (ev) ev.endDate = today;
    saveEvents(all);
    onChanged();
  }

  return (
    <div>
      <div className="detail-row">
        <span className="detail-key">Name</span>
        <span className="detail-val">{field.name}</span>
      </div>
      <div className="detail-row">
        <span className="detail-key">Type</span>
        <span className="detail-val">{cap(field.type)}</span>
      </div>
      <div className="detail-row">
        <span className="detail-key">Area</span>
        <span className="detail-val">{field.areaHa.toFixed(2)} ha</span>
      </div>
      <div className="detail-row">
        <span className="detail-key">Status</span>
        <span className="detail-val">
          <span className={`pill pill-${status.cls}`}>{status.label}</span>
        </span>
      </div>
      <div className="detail-row">
        <span className="detail-key">Rest target</span>
        <span className="detail-val">{field.restTarget} days</span>
      </div>
      <div className="detail-row">
        <span className="detail-key">Days resting</span>
        <span className="detail-val">{restDays !== null ? `${restDays} days` : 'No events yet'}</span>
      </div>
      <div className="detail-row">
        <span className="detail-key">Max AU/ha</span>
        <span className="detail-val">{field.maxAUperHa || '—'}</span>
      </div>
      <div className="detail-row">
        <span className="detail-key">Events logged</span>
        <span className="detail-val">{events.length}</span>
      </div>

      <div className="rest-prog">
        <div className="rest-prog-fill" style={{ width: `${pct}%`, background: barClr }} />
      </div>
      <div className="rest-prog-lbl">
        <span>Rest progress</span>
        <span>{pct}%{pct < 100 ? ` · ${Math.max(0, field.restTarget - (restDays || 0))}d left` : ' · Ready!'}</span>
      </div>

      {stockWarning && (
        <div className="warn-box alert" style={{ margin: '8px 0', fontSize: 11 }}>
          {stockWarning}
        </div>
      )}

      <div className="detail-actions">
        <button className="detail-btn edit" onClick={() => onEdit(fieldId)}>
          ✎ Edit
        </button>
        <button className="detail-btn" onClick={() => onHistory(fieldId)}>
          📋 History
        </button>
        {activeEvent && (
          <button className="detail-btn end-graze-btn" onClick={endGrazingToday}>
            ⏹ End Grazing
          </button>
        )}
        <button className="detail-btn primary" onClick={() => onGraze(fieldId)}>
          + Graze
        </button>
      </div>
    </div>
  );
}
