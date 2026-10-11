import { loadEvents, loadFields, loadGroups } from '@/lib/localStore';
import { getReadinessPct, getStatus } from '@/lib/status';
import { daysBetween, daysSince, todayStr } from '@/lib/utils';
import { useGtRefresh } from '@/lib/useGtRefresh';

interface Props {
  onSelectField: (id: string) => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Analytics({ onSelectField }: Props) {
  useGtRefresh();

  const fields = loadFields();
  const events = loadEvents();
  const groups = loadGroups();
  const today = todayStr();
  const statuses = fields.map(getStatus);
  const totalHa = fields.reduce((sum, field) => sum + field.areaHa, 0);
  const activeEvents = events.filter((event) => event.startDate <= today && event.endDate >= today);
  const activeAnimals = activeEvents.reduce((sum, event) => sum + event.animalCount, 0);
  const readyCount = statuses.filter((status) => status.cls === 'ready' || status.cls === 'none').length;
  const compliance = fields.length ? Math.round(fields.reduce((sum, field) => sum + getReadinessPct(field), 0) / fields.length) : 0;
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    const key = date.toISOString().slice(0, 7);
    return { key, label: MONTHS[date.getMonth()], count: events.filter((event) => event.startDate.startsWith(key)).length };
  });
  const maxMonthlyEvents = Math.max(1, ...months.map((month) => month.count));
  const performance = fields.map((field) => {
    const history = events.filter((event) => event.fieldId === field.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
    const last = history[0];
    const totalDays = history.reduce((sum, event) => sum + daysBetween(event.startDate, event.endDate), 0);
    const avgStocking = history.length && field.areaHa > 0
      ? history.reduce((sum, event) => sum + event.animalCount / field.areaHa, 0) / history.length
      : null;
    return { field, history, last, totalDays, avgStocking };
  }).sort((a, b) => b.totalDays - a.totalDays);

  return (
    <div className="sv analytics-view">
      <header className="analytics-header">
        <div className="analytics-eyebrow">FARM PERFORMANCE</div>
        <h1>Farm analytics</h1>
        <p>Grazing activity, recovery progress, and paddock use at a glance.</p>
      </header>

      {!fields.length ? (
        <div className="analytics-empty">
          <strong>No data to analyse yet</strong>
          <span>Add fields and log grazing events to see farm insights here.</span>
        </div>
      ) : (
        <>
          <div className="kpi-row analytics-kpis">
            <div className="kpi"><div className="kpi-lbl">Total fields</div><div className="kpi-val">{fields.length}</div><div className="kpi-sub">{totalHa.toFixed(1)} ha total</div></div>
            <div className="kpi"><div className="kpi-lbl">Grazing now</div><div className="kpi-val">{activeEvents.length}</div><div className="kpi-sub">{activeAnimals} animals active</div></div>
            <div className="kpi"><div className="kpi-lbl">Ready to graze</div><div className="kpi-val">{readyCount}</div><div className="kpi-sub">fields at rest target</div></div>
            <div className="kpi"><div className="kpi-lbl">Rest progress</div><div className="kpi-val">{compliance}%</div><div className="kpi-sub">average across fields</div></div>
          </div>

          <div className="analytics-grid">
            <section className="card analytics-card">
              <h2 className="card-title">Grazing activity</h2>
              <p className="analytics-subtitle">Events started in the last six months</p>
              <div className="activity-chart" role="img" aria-label="Grazing events by month">
                {months.map((month) => (
                  <div className="activity-column" key={month.key}>
                    <span>{month.count}</span>
                    <div><i style={{ height: `${Math.max(4, (month.count / maxMonthlyEvents) * 100)}%` }} /></div>
                    <small>{month.label}</small>
                  </div>
                ))}
              </div>
            </section>

            <section className="card analytics-card">
              <h2 className="card-title">Rest compliance</h2>
              <p className="analytics-subtitle">Recovery toward each field's target</p>
              <div className="compliance-list">
                {performance.slice().sort((a, b) => getReadinessPct(a.field) - getReadinessPct(b.field)).slice(0, 8).map(({ field }) => {
                  const pct = getReadinessPct(field);
                  const status = getStatus(field);
                  return (
                    <button className="compliance-row" key={field.id} onClick={() => onSelectField(field.id)}>
                      <span className={`compliance-dot ${status.cls}`} />
                      <span>{field.name}</span>
                      <span className="compliance-track"><i style={{ width: `${pct}%` }} /></span>
                      <strong>{pct}%</strong>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <section className="card analytics-card analytics-performance">
            <h2 className="card-title">Field performance</h2>
            <div className="table-scroll">
              <table className="htbl">
                <thead><tr><th>Field</th><th>Status</th><th>Events</th><th>Grazing days</th><th>Last grazed</th><th>Avg AU/ha</th><th>Utilization</th></tr></thead>
                <tbody>{performance.map(({ field, history, last, totalDays, avgStocking }) => {
                  const utilization = Math.min(100, Math.round(totalDays / 365 * 100));
                  return (
                    <tr key={field.id} className="analytics-table-row">
                      <td><button type="button" className="analytics-field-link" onClick={() => onSelectField(field.id)}>{field.name}</button></td>
                      <td><span className={`pill pill-${getStatus(field).cls}`}>{getStatus(field).label}</span></td>
                      <td>{history.length}</td>
                      <td>{totalDays}</td>
                      <td>{last ? `${daysSince(last.endDate)}d ago` : 'Never'}</td>
                      <td>{avgStocking === null ? '—' : avgStocking.toFixed(1)}</td>
                      <td><span className="utilization-value">{utilization}%</span><span className="utilization-track"><i style={{ width: `${utilization}%` }} /></span></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </section>

          {groups.length > 0 && <section className="card analytics-card groups-summary">
            <h2 className="card-title">Animal groups</h2>
            <div className="group-summary-list">{groups.map((group) => <div key={group.id}><span>{group.name}</span><strong>{group.count} {group.type}</strong></div>)}</div>
          </section>}
        </>
      )}
    </div>
  );
}