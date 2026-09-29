import { Link } from 'react-router-dom';
import FieldList from './FieldList';
import FieldDetail from './FieldDetail';
import SyncStatusBadge from './SyncStatusBadge';
import { useGtRefresh } from '@/lib/useGtRefresh';
import { getStorageUsage } from '@/lib/localStore';

interface Props {
  hidden: boolean;
  mobileOpen: boolean;
  onCollapse: () => void;
  onMobileClose: () => void;
  tool: 'select' | 'draw' | 'split';
  onSetTool: (t: 'select' | 'draw' | 'split') => void;
  vertexCount: number;
  onUndo: () => void;
  onCancelDraw: () => void;
  toolHint: string;
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onDeleteSelected: () => void;
  onEditField: (id: string) => void;
  onHistoryField: (id: string) => void;
  onGrazeField: (id: string) => void;
  onFieldChanged: () => void;
  onOpenExport: () => void;
  onOpenAbout: () => void;
  onOpenGroups: () => void;
  onShowDashboard: () => void;
  onLogGrazing: () => void;
  ndviEnabled: boolean;
  ndviDate: string;
  ndviOpacity: number;
  pressureEnabled: boolean;
  onToggleNdvi: () => void;
  onChangeNdviDate: (date: string) => void;
  onChangeNdviOpacity: (opacity: number) => void;
  onTogglePressure: () => void;
}

export default function Sidebar(props: Props) {
  useGtRefresh();

  const storage = getStorageUsage();
  const storagePct = Math.min(100, storage.pct);
  const storageKB = (storage.used / 1024).toFixed(0);
  const maxKB = (storage.max / 1024).toFixed(0);

  return (
    <aside className={`sidebar${props.hidden ? ' sb-hidden' : ''}${props.mobileOpen ? ' mobile-open' : ''}`}>
      <div className="sb-header">
        <div className="sb-brand">
          <span className="sb-leaf">🌾</span>
          <div className="sb-brand-text">
            <div className="sb-name">GrazingTrack</div>
            <div className="sb-sub">Free &amp; Open Source</div>
          </div>
        </div>
        <div className="sb-header-actions">
          <button className="sb-mobile-close" onClick={props.onMobileClose} aria-label="Close farm menu" title="Close farm menu">×</button>
          <button className="sb-collapse-btn" onClick={props.onCollapse} title="Collapse sidebar">
            ◀
          </button>
        </div>
      </div>

      <div className="sb-tools">
        <div className="sb-label">🛠 Drawing Tools</div>
        <div className="tool-grid">
          <button
            className={`tcrd${props.tool === 'select' ? ' active' : ''}`}
            onClick={() => props.onSetTool('select')}
          >
            ↖ Select
          </button>
          <button
            className={`tcrd${props.tool === 'draw' ? ' active' : ''}`}
            onClick={() => props.onSetTool('draw')}
          >
            ✏️ Draw
          </button>
          <button
            className={`tcrd${props.tool === 'split' ? ' active' : ''}`}
            onClick={() => props.onSetTool('split')}
          >
            ⬡ Auto-split
          </button>
        </div>
        {props.tool !== 'select' && (
          <>
            {props.vertexCount > 0 && (
              <button className="undo-btn" onClick={props.onUndo}>
                ↩ Undo last point
              </button>
            )}
            <button className="undo-btn" onClick={props.onCancelDraw}>
              ✕ Cancel drawing
            </button>
          </>
        )}
        {props.selectedFieldId && props.tool === 'select' && (
          <button className="del-btn" onClick={props.onDeleteSelected}>
            ✕ Delete selected field
          </button>
        )}
        <button className="btn-grazing" onClick={props.onLogGrazing}>
          🐄 Log Grazing Event
        </button>
        <button className={`ndvi-toggle-btn${props.ndviEnabled ? ' active' : ''}`} onClick={props.onToggleNdvi}>
          🛰️ Vegetation Heatmap (NDVI)
        </button>
        {props.ndviEnabled && (
          <div className="ndvi-panel">
            <div className="ndvi-heading"><strong>Vegetation condition</strong><span>Satellite composite</span></div>
            <div className="ndvi-legend-bar" />
            <div className="ndvi-legend-labels"><span>Low growth</span><span>High growth</span></div>
            <label className="ndvi-control-label">Map date
              <input type="date" value={props.ndviDate} onChange={(event) => props.onChangeNdviDate(event.target.value)} />
            </label>
            <label className="ndvi-control-label">Opacity
              <input type="range" min="0.2" max="0.9" step="0.05" value={props.ndviOpacity} onChange={(event) => props.onChangeNdviOpacity(Number(event.target.value))} />
            </label>
          </div>
        )}
        <button className={`pressure-toggle-btn${props.pressureEnabled ? ' active' : ''}`} onClick={props.onTogglePressure}>
          🔥 Historical Grazing Pressure
        </button>
        {props.pressureEnabled && (
          <div className="pressure-legend">
            <span>Lower pressure</span><i /><span>Higher pressure · last 12 months</span>
          </div>
        )}
        <p className="tool-hint">{props.toolHint}</p>
      </div>

      <div className="sb-fields">
        <div className="sb-label">
          📋 Fields
        </div>
        <FieldList selectedFieldId={props.selectedFieldId} onSelect={props.onSelectField} />
      </div>

      {props.selectedFieldId && (
        <div className="sb-detail">
          <div className="sb-label">📌 Selected Field</div>
          <FieldDetail
            fieldId={props.selectedFieldId}
            onEdit={props.onEditField}
            onHistory={props.onHistoryField}
            onGraze={props.onGrazeField}
            onChanged={props.onFieldChanged}
          />
        </div>
      )}

      <div className="sb-account">
        <SyncStatusBadge />
        <Link to="/login" className="sb-ftn" style={{ marginTop: 6, display: 'inline-flex' }}>
          ☁️ <span>Sync account</span>
        </Link>
      </div>

      <div className="sb-storage">
        <div className="stor-track">
          <div className="stor-fill" style={{ width: `${storagePct}%` }} />
        </div>
        <div className="stor-lbl">
          💾 Storage: {storageKB} KB / {maxKB} KB
        </div>
      </div>

      <div className="sb-footer">
        <button className="sb-ftn" onClick={props.onShowDashboard}>
          📊<span>Dashboard</span>
        </button>
        <button className="sb-ftn" onClick={props.onOpenExport}>
          ⬇️<span>Export</span>
        </button>
        <button className="sb-ftn" onClick={props.onOpenGroups}>
          🐄<span>Groups</span>
        </button>
        <button className="sb-ftn" onClick={props.onOpenAbout}>
          ℹ️<span>About</span>
        </button>
      </div>
    </aside>
  );
}
