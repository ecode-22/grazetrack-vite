import { useRef } from 'react';
import Modal from './Modal';
import { exportJSON, exportGeoJSON, exportCSV, importJSON, clearAllData } from '@/lib/export';

interface Props {
  onDataChanged: () => void;
  onClose: () => void;
}

export default function ExportModal({ onDataChanged, onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.fields) || !Array.isArray(data.events)) throw new Error();
      if (!confirm(`Import ${data.fields.length} fields and ${data.events.length} events?\nThis replaces all current data.`)) {
        e.target.value = '';
        return;
      }
      await importJSON(new File([text], file.name));
      onDataChanged();
      onClose();
    } catch {
      alert('Invalid backup file.');
    }
    e.target.value = '';
  }

  function handleClear() {
    if (!confirm('Delete ALL data? Export a backup first!\nThis cannot be undone.')) return;
    clearAllData();
    onDataChanged();
    onClose();
  }

  return (
    <Modal
      title="⬇️ Export & Backup"
      onClose={onClose}
      footer={
        <button className="btn-ghost" onClick={onClose}>
          Close
        </button>
      }
    >
      <button className="exp-row" onClick={exportJSON}>
        💾 JSON backup
      </button>
      <button className="exp-row" onClick={exportGeoJSON}>
        🗺️ GeoJSON fields
      </button>
      <button className="exp-row" onClick={exportCSV}>
        📊 Events CSV
      </button>
      <label className="exp-row">
        ⬆️ Import JSON
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
      </label>
      <button className="danger-btn" onClick={handleClear}>
        ⚠️ Clear all data
      </button>
    </Modal>
  );
}
