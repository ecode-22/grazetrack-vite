import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import MapView, { type MapViewHandle } from '@/components/MapView';
import TabBar, { type Tab } from '@/components/TabBar';
import StatusBar from '@/components/StatusBar';
import Dashboard from './Dashboard';
import RotationPlanner from './RotationPlanner';
import Reports from './Reports';
import Analytics from './Analytics';
import NameFieldModal from '@/components/modals/NameFieldModal';
import EditFieldModal from '@/components/modals/EditFieldModal';
import GrazingModal from '@/components/modals/GrazingModal';
import HistoryModal from '@/components/modals/HistoryModal';
import ExportModal from '@/components/modals/ExportModal';
import AboutModal from '@/components/modals/AboutModal';
import GroupsManagerModal from '@/components/modals/GroupsManagerModal';
import { COLORS, loadFarmProfile, loadFields, loadEvents, saveFields, saveEvents } from '@/lib/localStore';
import { calcAreaHa } from '@/lib/geo';
import { splitBoundary as createCampGeometries } from '@/lib/splitGeometry';
import { uid } from '@/lib/utils';
import type { FieldGeometry, FieldType } from '@/lib/types';

const DEFAULT_HINT = '💡 Click a field on the map to select it';

interface NameDetails {
  name: string;
  type: FieldType;
  restTarget: number;
  maxAUperHa: number | null;
}

type ModalState =
  | { type: 'name' }
  | { type: 'edit'; fieldId: string }
  | { type: 'grazing'; fieldId: string | null }
  | { type: 'history'; fieldId: string }
  | { type: 'export' }
  | { type: 'about' }
  | { type: 'groups' }
  | null;

export default function Home() {
  const mapRef = useRef<MapViewHandle>(null);

  const [tool, setToolState] = useState<'select' | 'draw' | 'split'>('select');
  const [vertexCount, setVertexCount] = useState(0);
  const [statusText, setStatusText] = useState(DEFAULT_HINT);
  const [selectedFieldId, setSelectedFieldIdState] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('map');
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [splitBoundary, setSplitBoundary] = useState<FieldGeometry | null>(null);
  const [splitCount, setSplitCount] = useState(4);
  const [splitDirection, setSplitDirection] = useState<'vertical' | 'horizontal'>('vertical');
  const [ndviEnabled, setNdviEnabled] = useState(false);
  const [ndviDate, setNdviDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 24);
    return date.toISOString().slice(0, 10);
  });
  const [ndviOpacity, setNdviOpacity] = useState(0.7);
  const [pressureEnabled, setPressureEnabled] = useState(false);
  const campGeometries = useMemo(
    () => splitBoundary ? createCampGeometries(splitBoundary, splitCount, splitDirection) : [],
    [splitBoundary, splitCount, splitDirection],
  );
  const campAreas = useMemo(() => campGeometries.map(calcAreaHa), [campGeometries]);
  const campAreaRange = campAreas.length
    ? `${Math.min(...campAreas).toFixed(1)}-${Math.max(...campAreas).toFixed(1)} ha each`
    : 'No paddocks fit inside this boundary';

  useEffect(() => {
    if (activeTab === 'map') mapRef.current?.invalidateSize();
  }, [activeTab]);

  function selectField(id: string) {
    setSelectedFieldIdState(id);
    mapRef.current?.flyToField(id);
  }

  function deselect() {
    setSelectedFieldIdState(null);
  }

  function setTool(t: 'select' | 'draw' | 'split') {
    if (t === 'select' && tool !== 'select') {
      // Bail out of an in-progress draw the same way Escape does in
      // Leaflet-Draw, then let the tool-change effect in MapView tear
      // down the control.
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      mapRef.current?.cancelPendingField();
      setVertexCount(0);
      setStatusText(DEFAULT_HINT);
    }
    setToolState(t);
  }

  function cancelAutoSplit() {
    mapRef.current?.cancelPendingField();
    setSplitBoundary(null);
    setSplitCount(4);
    setToolState('select');
    setStatusText(DEFAULT_HINT);
  }

  function handleFieldDrawn() {
    setModal({ type: 'name' });
  }

  function handleNameSave(details: NameDetails) {
    mapRef.current?.commitPendingField(details);
    setModal(null);
    setToolState('select');
    setStatusText(DEFAULT_HINT);
  }

  function handleNameCancel() {
    mapRef.current?.cancelPendingField();
    setModal(null);
    setToolState('select');
    setStatusText(DEFAULT_HINT);
  }

  function handleBoundaryDrawn(geometry: FieldGeometry) {
    setSplitBoundary(geometry);
    setToolState('select');
    setStatusText('Adjust the camp layout, then create the paddocks.');
  }

  function handleCreateCamps() {
    if (!campGeometries.length) return;
    const currentFields = loadFields();
    const created = campGeometries.map((geometry, index) => ({
      id: uid(),
      name: `Camp ${String(currentFields.length + index + 1).padStart(2, '0')}`,
      type: 'pasture' as FieldType,
      restTarget: 42,
      maxAUperHa: null,
      geometry,
      areaHa: calcAreaHa(geometry),
      color: COLORS[(currentFields.length + index) % COLORS.length],
      createdAt: new Date().toISOString(),
    }));
    saveFields([...currentFields, ...created]);
    mapRef.current?.cancelPendingField();
    setSplitBoundary(null);
    setStatusText(`${created.length} camps created`);
  }

  function handleDeleteSelected() {
    if (!selectedFieldId) return;
    const field = loadFields().find((f) => f.id === selectedFieldId);
    if (!field) return;
    if (!confirm(`Delete "${field.name}"? Its grazing history will also be deleted.`)) return;

    saveFields(loadFields().filter((f) => f.id !== selectedFieldId));
    saveEvents(loadEvents().filter((e) => e.fieldId !== selectedFieldId));
    setSelectedFieldIdState(null);
    setStatusText(DEFAULT_HINT);
  }

  function openGrazingModal(fieldId: string | null) {
    if (!loadFields().length) {
      alert('Add a field first.');
      return;
    }
    setModal({ type: 'grazing', fieldId });
  }

  function showFieldOnMap(id: string) {
    setActiveTab('map');
    setTimeout(() => selectField(id), 100);
  }

  return (
    <div className="app-shell">
      {mobileMenuOpen && <button className="mobile-sidebar-backdrop" aria-label="Close farm menu" onClick={() => setMobileMenuOpen(false)} />}
      <Sidebar
        hidden={sidebarHidden}
        mobileOpen={mobileMenuOpen}
        onCollapse={() => setSidebarHidden(true)}
        onMobileClose={() => setMobileMenuOpen(false)}
        tool={tool}
        onSetTool={setTool}
        vertexCount={vertexCount}
        onUndo={() => mapRef.current?.undoLastVertex()}
        onCancelDraw={() => setTool('select')}
        toolHint={statusText}
        selectedFieldId={selectedFieldId}
        onSelectField={selectField}
        onDeleteSelected={handleDeleteSelected}
        onEditField={(id) => setModal({ type: 'edit', fieldId: id })}
        onHistoryField={(id) => setModal({ type: 'history', fieldId: id })}
        onGrazeField={(id) => openGrazingModal(id)}
        onFieldChanged={() => {}}
        onOpenExport={() => setModal({ type: 'export' })}
        onOpenAbout={() => setModal({ type: 'about' })}
        onOpenGroups={() => setModal({ type: 'groups' })}
        onShowDashboard={() => setActiveTab('dashboard')}
        onLogGrazing={() => openGrazingModal(null)}
        ndviEnabled={ndviEnabled}
        ndviDate={ndviDate}
        ndviOpacity={ndviOpacity}
        pressureEnabled={pressureEnabled}
        onToggleNdvi={() => setNdviEnabled((enabled) => !enabled)}
        onChangeNdviDate={setNdviDate}
        onChangeNdviOpacity={setNdviOpacity}
        onTogglePressure={() => setPressureEnabled((enabled) => !enabled)}
      />

      <main className="app-main">
        <TabBar
          active={activeTab}
          farmName={loadFarmProfile()?.name ?? 'Farm workspace'}
          onChange={(tab) => { setActiveTab(tab); setMobileMenuOpen(false); }}
          onMenu={() => setMobileMenuOpen((open) => !open)}
        />

        <div className={`tab-panel${activeTab === 'map' ? ' active' : ''}`}>
          <MapView
            ref={mapRef}
            selectedFieldId={selectedFieldId}
            onSelectField={selectField}
            onDeselect={deselect}
            tool={tool}
            onFieldDrawn={handleFieldDrawn}
            onVertexCount={setVertexCount}
            onStatus={setStatusText}
            onBoundaryDrawn={handleBoundaryDrawn}
            previewGeometries={campGeometries}
            ndviEnabled={ndviEnabled}
            ndviDate={ndviDate}
            ndviOpacity={ndviOpacity}
            pressureEnabled={pressureEnabled}
          />
          {splitBoundary && (
            <aside className="as-split-panel open" aria-label="Auto-split camps">
              <div className="as-sp-hdr">
                <span className="as-sp-title">⬡ Auto-split</span>
                <button className="as-sp-close" onClick={cancelAutoSplit} title="Cancel">✕</button>
              </div>
              <div className="as-sp-body">
                <section className="as-section">
                    <div className="as-section-title">Number of paddocks <span className="as-section-hint">2-16</span></div>
                  <div className="as-count-input-row">
                    <button className="as-count-btn" onClick={() => setSplitCount((count) => Math.max(2, count - 1))} aria-label="Fewer camps">−</button>
                    <input className="as-count-input" type="number" min="2" max="16" value={splitCount} onChange={(event) => setSplitCount(Math.min(16, Math.max(2, Number(event.target.value) || 2)))} />
                    <button className="as-count-btn" onClick={() => setSplitCount((count) => Math.min(16, count + 1))} aria-label="More camps">+</button>
                  </div>
                  <input className="as-count-slider" type="range" min="2" max="16" value={splitCount} onChange={(event) => setSplitCount(Number(event.target.value))} aria-label="Number of camps" />
                </section>
                <section className="as-section">
                  <div className="as-section-title">Split direction</div>
                  <div className="as-dir-row">
                    <button className={`as-dir-btn${splitDirection === 'vertical' ? ' active' : ''}`} onClick={() => setSplitDirection('vertical')} aria-pressed={splitDirection === 'vertical'}>↕ Run north-south</button>
                    <button className={`as-dir-btn${splitDirection === 'horizontal' ? ' active' : ''}`} onClick={() => setSplitDirection('horizontal')} aria-pressed={splitDirection === 'horizontal'}>↔ Run east-west</button>
                  </div>
                </section>
                <div className="as-preview-summary" aria-live="polite">
                  <strong>{campGeometries.length} paddocks previewed</strong>
                  <span>{campAreaRange}</span>
                  <small>Similar-sized paddocks are spaced to use the whole boundary.</small>
                </div>
              </div>
              <div className="as-sp-footer">
                <button className="btn-ghost" onClick={cancelAutoSplit}>Cancel</button>
                <button className="btn-primary" disabled={!campGeometries.length} onClick={handleCreateCamps}>✓ Create camps</button>
              </div>
            </aside>
          )}
          {sidebarHidden && (
            <button
              className="sb-expand-btn"
              style={{ display: 'flex' }}
              onClick={() => setSidebarHidden(false)}
              title="Show sidebar"
            >
              ☰
            </button>
          )}
          <StatusBar statusText={statusText} />
        </div>

        <div className={`tab-panel${activeTab === 'dashboard' ? ' active' : ''}`}>
          {activeTab === 'dashboard' && (
            <Dashboard
              onSelectField={showFieldOnMap}
            />
          )}
        </div>

        <div className={`tab-panel${activeTab === 'rotation' ? ' active' : ''}`}>
          {activeTab === 'rotation' && (
            <RotationPlanner onSelectField={showFieldOnMap} />
          )}
        </div>
        <div className={`tab-panel${activeTab === 'reports' ? ' active' : ''}`}>
          {activeTab === 'reports' && (
            <Reports />
          )}
        </div>
        <div className={`tab-panel${activeTab === 'analytics' ? ' active' : ''}`}>
          {activeTab === 'analytics' && (
            <Analytics onSelectField={showFieldOnMap} />
          )}
        </div>
      </main>

      {modal?.type === 'name' && <NameFieldModal onSave={handleNameSave} onCancel={handleNameCancel} />}

      {modal?.type === 'edit' && (
        <EditFieldModal fieldId={modal.fieldId} onSaved={() => setModal(null)} onClose={() => setModal(null)} />
      )}

      {modal?.type === 'grazing' && (
        <GrazingModal
          preFieldId={modal.fieldId}
          onSaved={(fieldId) => {
            setModal(null);
            selectField(fieldId);
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'history' && (
        <HistoryModal
          fieldId={modal.fieldId}
          onAddEvent={(fieldId) => setModal({ type: 'grazing', fieldId })}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'export' && <ExportModal onDataChanged={() => {}} onClose={() => setModal(null)} />}
      {modal?.type === 'about' && <AboutModal onClose={() => setModal(null)} />}
      {modal?.type === 'groups' && <GroupsManagerModal onClose={() => setModal(null)} />}
    </div>
  );
}
