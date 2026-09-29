import { loadEvents, loadFields } from '@/lib/localStore';
import { getReadinessPct, getStatus } from '@/lib/status';
import { daysSince } from '@/lib/utils';
import { useGtRefresh } from '@/lib/useGtRefresh';

interface Props {
  onSelectField: (id: string) => void;
}

export default function RotationPlanner({ onSelectField }: Props) {
  useGtRefresh();

  const fields = loadFields();
  const events = loadEvents();
  const scored = fields
    .map((field) => {
      const history = events
        .filter((event) => event.fieldId === field.id)
        .sort((a, b) => b.endDate.localeCompare(a.endDate));
      const lastEvent = history[0];
      const restDays = lastEvent ? daysSince(lastEvent.endDate) : null;
      const daysToReady = lastEvent ? Math.max(0, field.restTarget - (restDays ?? 0)) : 0;
      return { field, history, restDays, daysToReady, pct: getReadinessPct(field), status: getStatus(field) };
    })
    .sort((a, b) => b.pct - a.pct || a.field.name.localeCompare(b.field.name));

  const recommended = scored.find(({ status }) => status.cls === 'ready' || status.cls === 'none');
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
              <span>{recommended.field.areaHa.toFixed(1)} ha · {recommended.pct}% rest complete</span>
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
        {scored.length ? scored.map(({ field, history, restDays, daysToReady, pct, status }) => (
          <button className="rotation-item" key={field.id} onClick={() => onSelectField(field.id)}>
            <span className="rotation-item-top">
              <span>
                <strong>{field.name}</strong>
                <small>{field.areaHa.toFixed(1)} ha · {history.length ? `${restDays} days resting` : 'never grazed'} · target {field.restTarget} days</small>
              </span>
              <span className={`pill pill-${status.cls}`}>{status.label}</span>
            </span>
            <span className="rotation-progress"><span style={{ width: `${pct}%` }} /></span>
            <span className="rotation-progress-copy">
              <span>{pct}% rest complete</span>
              <span>{status.cls === 'grazing' ? 'Currently grazing' : daysToReady ? `${daysToReady}d until ready` : 'Ready to graze'}</span>
            </span>
          </button>
        )) : <p className="no-history">No paddocks have been added yet.</p>}
      </section>
    </div>
  );
}