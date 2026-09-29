import Modal from './Modal';
import { loadFields, loadEvents, saveEvents } from '@/lib/localStore';
import { useGtRefresh } from '@/lib/useGtRefresh';
import { fmtDate, daysBetween, cap } from '@/lib/utils';

interface Props {
  fieldId: string;
  onAddEvent: (fieldId: string) => void;
  onClose: () => void;
}

export default function HistoryModal({ fieldId, onAddEvent, onClose }: Props) {
  useGtRefresh();

  const field = loadFields().find((f) => f.id === fieldId);
  const events = loadEvents()
    .filter((e) => e.fieldId === fieldId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  if (!field) return null;

  function deleteEvent(eventId: string) {
    if (!confirm('Delete this grazing event?')) return;
    saveEvents(loadEvents().filter((e) => e.id !== eventId));
  }

  return (
    <Modal
      title={`📋 ${field.name} — Grazing History`}
      size="mlg"
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn-primary" onClick={() => onAddEvent(fieldId)}>
            + Add Event
          </button>
        </>
      }
    >
      {!events.length ? (
        <p className="no-history">No events yet.</p>
      ) : (
        <table className="htbl">
          <thead>
            <tr>
              <th>Start</th>
              <th>End</th>
              <th>Days</th>
              <th>Animals</th>
              <th>AU/ha</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const auHa = field.areaHa > 0 ? (e.animalCount / field.areaHa).toFixed(1) : '—';
              const warn = field.maxAUperHa && e.animalCount / field.areaHa > field.maxAUperHa ? '⚠' : '';
              return (
                <tr key={e.id}>
                  <td>{fmtDate(e.startDate)}</td>
                  <td>{fmtDate(e.endDate)}</td>
                  <td>{daysBetween(e.startDate, e.endDate)}</td>
                  <td>
                    {e.animalCount} {cap(e.animalType)}
                    {e.herd && <span className="ev-herd">{e.herd}</span>}
                  </td>
                  <td>
                    {warn}
                    {auHa}
                  </td>
                  <td style={{ color: '#6b7280', fontSize: 11 }}>{e.notes || '—'}</td>
                  <td>
                    <button className="del-ev-btn" onClick={() => deleteEvent(e.id)}>
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
