import { loadEvents, loadFields } from '@/lib/localStore';
import { getReadinessPct, getStatus } from '@/lib/status';
import { daysSince, todayStr, fmtDate } from '@/lib/utils';
import { useGtRefresh } from '@/lib/useGtRefresh';

interface Props {
  onSelectField: (id: string) => void;
}

export default function RotationPlanner({ onSelectField }: Props) {
  useGtRefresh();

  const fields = loadFields();
  const events = loadEvents();
  const today = todayStr();
  const scored = fields
    .map((field) => {
      const history = events
        .filter((event) => event.fieldId === field.id)
        .sort((a, b) => b.endDate.localeCompare(a.endDate));
      const lastEvent = history[0];
      const activeEvent = history.find((event) => event.startDate <= today && event.endDate >= today);
      const restDays = lastEvent ? Math.max(0, daysSince(lastEvent.endDate)) : null;
      const daysToReady = lastEvent ? Math.max(0, field.restTarget - (restDays ?? 0)) : 0;
      const daysPastTarget = lastEvent && !activeEvent ? Math.max(0, (restDays ?? 0) - field.restTarget) : 0;
      return { field, history, lastEvent, activeEvent, restDays, daysToReady, daysPastTarget, pct: history.length ? getReadinessPct(field) : 0, status: getStatus(field) };
    })
    .sort((a, b) => b.daysPastTarget - a.daysPastTarget || b.pct - a.pct || a.field.name.localeCompare(b.field.name));

  const recommended = scored.find(({ history, status }) => history.length > 0 && status.cls === 'ready')
    ?? scored.find(({ history, status }) => history.length === 0 && status.cls === 'none');
  const soonest = scored.find(({ daysToReady }) => daysToReady > 0);

  return (
    <div className="sv">
      <section className="rotation-hero">
        <div className="analytics-eyebrow">ROTATION PLANNER</div>
        {recommended ? (
          <>
            <h2>Recommended next field</h2>
            <button className="rotation-recommendation" onClick={() => onSelectField(recommended.field.id)}>
              <span>{recommended.field.name}</span>
              <span>{recommended.field.areaHa.toFixed(1)} ha · {recommended.history.length ? `${recommended.daysPastTarget} days past target` : 'No history'}</span>
            </button>
          </>
        ) : fields.length ? (
          <>
            <h2>No fields ready yet</h2>
            <p>{soonest ? `${soonest.field.name} may be ready in ${soonest.daysToReady} days.` : 'Allow fields to complete their rest period.'}</p>
          </>
        ) : (
          <>
            <h2>No fields to plan</h2>
            <p>Add paddocks and log grazing events to get a rest-based rotation recommendation.</p>
          </>
        )}
      </section>

      <section className="rotation-list" aria-label="Field rotation readiness">
        <div className="rotation-list-heading">
          <h2>Field readiness</h2>
          <span>{fields.length} {fields.length === 1 ? 'field' : 'fields'}</span>
        </div>
        {scored.length ? scored.map(({ field, history, activeEvent, restDays, daysToReady, pct, status }) => (
          <button className="rotation-item" key={field.id} onClick={() => onSelectField(field.id)}>
            <span className="rotation-item-top">
              <span>
                <strong>{field.name}</strong>
                <small>{field.areaHa.toFixed(1)} ha · {activeEvent ? `Grazing since ${fmtDate(activeEvent.startDate)}` : history.length ? `${restDays} days resting` : 'No history'} · target {field.restTarget} days</small>
              </span>
              <span className={`pill pill-${status.cls}`}>{status.label}</span>
            </span>
            <span className="rotation-progress"><span style={{ width: `${pct}%` }} /></span>
            <span className="rotation-progress-copy">
              <span>{history.length ? `${pct}% rest complete` : 'No history'}</span>
              <span>{activeEvent ? 'Currently grazing' : daysToReady ? `${daysToReady}d until ready` : history.length ? 'Ready to graze' : 'No history'}</span>
            </span>
          </button>
        )) : <p className="no-history">No paddocks have been added yet.</p>}
      </section>
    </div>
  );
}