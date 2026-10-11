import { loadFields, loadEvents } from '@/lib/localStore';
import { getStatus } from '@/lib/status';
import { useGtRefresh } from '@/lib/useGtRefresh';
import { fmtDate, daysBetween, todayStr } from '@/lib/utils';

function statusFillColor(field: ReturnType<typeof loadFields>[number], status: { cls: string }): string {
  if (status.cls === 'grazing') return '#22c55e';
  if (status.cls === 'ready') return '#4ade80';
  if (status.cls === 'resting') return '#facc15';
  if (status.cls === 'danger') return '#f87171';
  return field.color || '#2d6a4f';
}

interface Props {
  onSelectField: (id: string) => void;
}

export default function Dashboard({ onSelectField }: Props) {
  useGtRefresh();

  const fields = loadFields();
  const events = loadEvents();
  const today = todayStr();
  const thisMonth = today.slice(0, 7);
  const totalHa = fields.reduce((s, f) => s + f.areaHa, 0);
  const statuses = fields.map(getStatus);
  const nG = statuses.filter((s) => s.cls === 'grazing').length;
  const nR = statuses.filter((s) => s.cls === 'ready').length;
  const nRe = statuses.filter((s) => s.cls === 'resting').length;
  const nD = statuses.filter((s) => s.cls === 'danger').length;
  const evM = events.filter((e) => e.startDate.startsWith(thisMonth)).length;

  const kpis = [
    { label: 'Total fields', val: fields.length, sub: `${totalHa.toFixed(1)} ha` },
    { label: 'Grazing now', val: nG, sub: nG ? 'fields active' : 'none active' },
    { label: 'Ready to graze', val: nR, sub: 'rest target met' },
    { label: 'Events this month', val: evM, sub: thisMonth },
    { label: 'Resting', val: nRe, sub: 'building up' },
    { label: 'Need rest', val: nD, sub: nD ? '⚠ check these' : 'all ok' },
  ];

  const recent = [...events].sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 8);

  const stocking = fields
    .map((f) => {
      const fe = events.filter((e) => e.fieldId === f.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
      if (!fe.length) return null;
      const last = fe[0];
      const auHa = (last.animalCount / f.areaHa).toFixed(1);
      const over = f.maxAUperHa != null && last.animalCount / f.areaHa > f.maxAUperHa;
      return { field: f, auHa, over };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="sv">
      <div className="kpi-row">
        {kpis.map((c) => (
          <div className="kpi" key={c.label}>
            <div className="kpi-lbl">{c.label}</div>
            <div className="kpi-val">{c.val}</div>
            <div className="kpi-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="cr">
        <div className="card clg">
          <div className="card-title">Field status overview</div>
          {fields.length ? (
            <div className="status-grid">
              {fields.map((f) => {
                const s = getStatus(f);
                return (
                  <button
                    type="button"
                    key={f.id}
                    className="status-tile"
                    style={{ background: statusFillColor(f, s) }}
                    onClick={() => onSelectField(f.id)}
                    aria-label={`${f.name}, ${f.areaHa.toFixed(1)} hectares, ${s.label}. Show on map`}
                  >
                    <span className="status-tile-name">{f.name}</span>
                    <span className="status-tile-sub">
                      {f.areaHa.toFixed(1)} ha · {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p style={{ color: '#9ca3af', fontSize: 12 }}>No fields yet.</p>
          )}
        </div>
      </div>

      <div className="cr">
        <div className="card clg">
          <div className="card-title">Recent grazing events</div>
          {recent.length ? (
            <table className="htbl">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Start</th>
                  <th>Animals</th>
                  <th>Days</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((e) => {
                  const f = fields.find((x) => x.id === e.fieldId);
                  return (
                    <tr key={e.id}>
                      <td>{f ? f.name : '—'}</td>
                      <td>{fmtDate(e.startDate)}</td>
                      <td>
                        {e.animalCount} {e.animalType}
                      </td>
                      <td>{daysBetween(e.startDate, e.endDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="no-history">No events logged yet.</p>
          )}
        </div>

        <div className="card">
          <div className="card-title">Stocking rates</div>
          {stocking.length ? (
            stocking.map(({ field, auHa, over }) => (
              <div className="detail-row" key={field.id}>
                <span className="detail-key">{field.name}</span>
                <span className="detail-val" style={{ color: over ? '#dc2626' : '#166534' }}>
                  {auHa} AU/ha {over ? '⚠' : ''}
                </span>
              </div>
            ))
          ) : (
            <p style={{ color: '#9ca3af', fontSize: 12 }}>No events yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
