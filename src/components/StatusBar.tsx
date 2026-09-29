import { loadFields } from '@/lib/localStore';
import { getStatus } from '@/lib/status';

export default function StatusBar({ statusText }: { statusText: string }) {
  const fields = loadFields();
  const totalHa = fields.reduce((s, f) => s + f.areaHa, 0);
  const statuses = fields.map(getStatus);
  const grazing = statuses.filter((s) => s.cls === 'grazing').length;
  const ready = statuses.filter((s) => s.cls === 'ready').length;

  return (
    <div className="map-statusbar">
      <span className="map-status-text">{statusText}</span>
      <div className="map-stats">
        <span className="stat-item">🌾 {fields.length}</span>
        <span className="stat-item">📐 {totalHa.toFixed(1)} ha</span>
        <span className="stat-item">🐄 {grazing || '—'}</span>
        <span className="stat-item">✅ {ready}</span>
      </div>
    </div>
  );
}
