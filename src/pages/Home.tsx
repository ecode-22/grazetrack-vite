import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import type { MapViewHandle } from '@/components/MapView';
import TabBar, { type Tab } from '@/components/TabBar';
import StatusBar from '@/components/StatusBar';
import Dashboard from './Dashboard';
import RotationPlanner from './RotationPlanner';
import NameFieldModal from '@/components/modals/NameFieldModal';
import EditFieldModal from '@/components/modals/EditFieldModal';
import GrazingModal from '@/components/modals/GrazingModal';
import HistoryModal from '@/components/modals/HistoryModal';
import ExportModal from '@/components/modals/ExportModal';
import AboutModal from '@/components/modals/AboutModal';
import GroupsManagerModal from '@/components/modals/GroupsManagerModal';
import { COLORS, loadFarmProfile, loadFields, loadEvents, saveFields, saveEvents } from '@/lib/localStore';
import { calcAreaHa } from '@/lib/geo';
import { splitBoundary as createCampGeometries, type SplitDirection } from '@/lib/splitGeometry';
import { uid } from '@/lib/utils';
import type { FieldGeometry, FieldType } from '@/lib/types';

const DEFAULT_HINT = '💡 Click a field on the map to select it';
const MapView = lazy(() => import('@/components/MapView'));
const Reports = lazy(() => import('./Reports'));
const Analytics = lazy(() => import('./Analytics'));

interface NameDetails {
  name: string;
  type: FieldType;
  restTarget: number;
  maxAUperHa: number | null;
}

interface CampSettings {
  name: string;
  areaHa: number;
  restTarget: number;
}

function makeCampSettings(geometries: FieldGeometry[], previous: CampSettings[], firstNumber: number): CampSettings[] {
  return geometries.map((geometry, index) => ({
    name: previous[index]?.name || `Paddock ${String(firstNumber + index).padStart(2, '0')}`,
    areaHa: calcAreaHa(geometry),
    restTarget: previous[index]?.restTarget ?? 42,
  }));
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
  const [splitDirection, setSplitDirection] = useState<SplitDirection>('balanced');
  const [splitAngle, setSplitAngle] = useState(0);
  const [campSettings, setCampSettings] = useState<CampSettings[]>([]);
  const [ndviEnabled, setNdviEnabled] = useState(false);
  const [ndviDate, setNdviDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 24);
    return date.toISOString().slice(0, 10);
  });
  const [ndviOpacity, setNdviOpacity] = useState(0.7);
  const [pressureEnabled, setPressureEnabled] = useState(false);
  const campGeometries = useMemo(
    () => splitBoundary
      ? createCampGeometries(
        splitBoundary,
        splitCount,
        splitDirection,
        campSettings.length === splitCount ? campSettings.map((camp) => camp.areaHa) : undefined,
        splitAngle,
      )
      : [],
    [splitBoundary, splitCount, splitDirection, campSettings, splitAngle],
  );
  const campAreas = useMemo(() => campGeometries.map(calcAreaHa), [campGeometries]);
  const campNames = useMemo(() => campSettings.map((camp) => camp.name), [campSettings]);
  const campAreaRange = campAreas.length
    ? `${Math.min(...campAreas).toFixed(1)}–${Math.max(...campAreas).toFixed(1)} ha each`
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
    setSplitAngle(0);
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
    const defaults = createCampGeometries(geometry, splitCount, splitDirection, undefined, splitAngle);
    setCampSettings(makeCampSettings(defaults, [], loadFields().length + 1));
    setSplitBoundary(geometry);
    setToolState('select');
    setStatusText('Preview the paddock layout, then create it when the sizes look right.');
  }

  function changeSplitCount(nextCount: number) {
    const count = Math.min(16, Math.max(2, nextCount));
    setSplitCount(count);
    if (!splitBoundary) return;
    const defaults = createCampGeometries(splitBoundary, count, splitDirection, undefined, splitAngle);
    const firstNewNumber = loadFields().length + 1;
    setCampSettings((previous) => makeCampSettings(defaults, previous, firstNewNumber));
  }

  function handleCreateCamps() {
    if (!campGeometries.length) return;
    const currentFields = loadFields();
    const created = campGeometries.map((geometry, index) => ({
      id: uid(),
      name: campSettings[index]?.name.trim() || `Paddock ${String(currentFields.length + index + 1).padStart(2, '0')}`,
      type: 'pasture' as FieldType,
      restTarget: campSettings[index]?.restTarget || 42,
      maxAUperHa: null,
      geometry,
      areaHa: calcAreaHa(geometry),
      color: COLORS[(currentFields.length + index) % COLORS.length],
      createdAt: new Date().toISOString(),
    }));
    saveFields([...currentFields, ...created]);
    mapRef.current?.cancelPendingField();
    setSplitBoundary(null);
    setStatusText(`${created.length} paddocks created`);
  }

  function updateCampArea(index: number, requestedArea: number) {
    if (!splitBoundary || campSettings.length < 2) return;
    const minimumArea = 0.01;
    const totalArea = calcAreaHa(splitBoundary);
    const maxArea = Math.max(minimumArea, totalArea - minimumArea * (campSettings.length - 1));
    const area = Math.min(maxArea, Math.max(minimumArea, Number.isFinite(requestedArea) ? requestedArea : minimumArea));
    const otherTotal = campSettings.reduce((sum, camp, campIndex) => campIndex === index ? sum : sum + camp.areaHa, 0);
    const remaining = totalArea - area;
    setCampSettings((current) => current.map((camp, campIndex) => {
      if (campIndex === index) return { ...camp, areaHa: area };
      const share = otherTotal > 0 ? camp.areaHa / otherTotal : 1 / (current.length - 1);
      return { ...camp, areaHa: remaining * share };
    }));
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
        onEditBoundaryField={(id) => mapRef.current?.editBoundary(id)}
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
          <Suspense fallback={<div className="map-loading" role="status">Loading map…</div>}>
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
            previewNames={campNames}
            ndviEnabled={ndviEnabled}
            ndviDate={ndviDate}
            ndviOpacity={ndviOpacity}
            pressureEnabled={pressureEnabled}
          />
          </Suspense>
          {splitBoundary && (
            <aside className="as-split-panel open" aria-label="Auto-split camps">
              <div className="as-sp-hdr">
                <span className="as-sp-title">Paddock layout</span>
                <button className="as-sp-close" onClick={cancelAutoSplit} title="Cancel">✕</button>
              </div>
              <div className="as-sp-body">
                <section className="as-section">
                  <div className="as-section-title">Paddocks to create <span className="as-section-hint">2–16</span></div>
                  <div className="as-count-input-row">
                    <button className="as-count-btn" onClick={() => changeSplitCount(splitCount - 1)} aria-label="Fewer paddocks">−</button>
                    <input className="as-count-input" type="number" min="2" max="16" value={splitCount} onChange={(event) => changeSplitCount(Number(event.target.value) || 2)} aria-label="Number of paddocks" />
                    <button className="as-count-btn" onClick={() => changeSplitCount(splitCount + 1)} aria-label="More paddocks">+</button>
                  </div>
                  <input className="as-count-slider" type="range" min="2" max="16" value={splitCount} onChange={(event) => changeSplitCount(Number(event.target.value))} aria-label="Number of paddocks" />
                </section>
                <section className="as-section">
                  <div className="as-section-title">Layout style</div>
                  <div className="as-dir-row">
                    <button className={`as-dir-btn${splitDirection === 'balanced' ? ' active' : ''}`} onClick={() => setSplitDirection('balanced')} aria-pressed={splitDirection === 'balanced'} title="Divide the longest remaining side first">▦ Balanced</button>
                    <button className={`as-dir-btn${splitDirection === 'vertical' ? ' active' : ''}`} onClick={() => setSplitDirection('vertical')} aria-pressed={splitDirection === 'vertical'} title="Create long paddocks running north to south">↕ Long N–S</button>
                    <button className={`as-dir-btn${splitDirection === 'horizontal' ? ' active' : ''}`} onClick={() => setSplitDirection('horizontal')} aria-pressed={splitDirection === 'horizontal'} title="Create long paddocks running east to west">↔ Long E–W</button>
                  </div>
                </section>
                <section className="as-section">
                  <div className="as-section-title">Boundary angle <span className="as-section-hint">{splitAngle > 0 ? '+' : ''}{splitAngle}° (±45° max)</span></div>
                  <input
                    className="as-angle-slider"
                    type="range"
                    min="-45"
                    max="45"
                    step="1"
                    value={splitAngle}
                    onChange={(event) => setSplitAngle(Number(event.target.value))}
                    aria-label="Paddock boundary angle"
                  />
                  <div className="as-angle-ticks" aria-hidden="true"><span>-45°</span><span>0°</span><span>+45°</span></div>
                </section>
                <section className="as-section">
                  <div className="as-section-title">Paddock details <span className="as-section-hint">Total {splitBoundary ? calcAreaHa(splitBoundary).toFixed(1) : '0.0'} ha</span></div>
                  <div className="as-camp-list">
                    {campGeometries.map((_geometry, index) => {
                      const settings = campSettings[index];
                      return (
                        <div className="as-camp-card" key={index}>
                          <div className="as-camp-name-row">
                            <span className="as-preview-dot" style={{ background: COLORS[(loadFields().length + index) % COLORS.length] }} />
                            <input
                              className="as-name-input"
                              type="text"
                              maxLength={40}
                              value={settings?.name ?? ''}
                              onChange={(event) => setCampSettings((current) => current.map((camp, campIndex) => campIndex === index ? { ...camp, name: event.target.value } : camp))}
                              aria-label={`Paddock ${index + 1} name`}
                            />
                          </div>
                          <div className="as-camp-fields">
                            <label className="as-camp-field">
                              <span>Size (ha)</span>
                              <input type="number" min="0.01" step="0.1" value={settings?.areaHa ?? 0} onChange={(event) => updateCampArea(index, Number(event.target.value))} />
                            </label>
                            <label className="as-camp-field">
                              <span>Rest (days)</span>
                              <input type="number" min="1" max="365" step="1" value={settings?.restTarget ?? 42} onChange={(event) => setCampSettings((current) => current.map((camp, campIndex) => campIndex === index ? { ...camp, restTarget: Math.min(365, Math.max(1, Number(event.target.value) || 1)) } : camp))} />
                            </label>
                          </div>
                          <small className="as-camp-actual">Preview area: {campAreas[index]?.toFixed(1) ?? '0.0'} ha</small>
                        </div>
                      );
                    })}
                  </div>
                </section>
                <div className="as-preview-summary" aria-live="polite">
                  <strong>{campGeometries.length} paddocks previewed</strong>
                  <span>{campAreaRange}</span>
                  <small>Choose a layout, compare the areas, then create your paddocks.</small>
                </div>
              </div>
              <div className="as-sp-footer">
                <button className="btn-ghost" onClick={cancelAutoSplit}>Cancel</button>
                <button className="btn-primary" disabled={campGeometries.length !== splitCount} onClick={handleCreateCamps}>✓ Create paddocks</button>
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
            <Suspense fallback={<div role="status">Loading reports…</div>}><Reports /></Suspense>
          )}
        </div>
        <div className={`tab-panel${activeTab === 'analytics' ? ' active' : ''}`}>
          {activeTab === 'analytics' && (
            <Suspense fallback={<div role="status">Loading analytics…</div>}><Analytics onSelectField={showFieldOnMap} /></Suspense>
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

      {modal?.type === 'export' && <ExportModal onClose={() => setModal(null)} />}
      {modal?.type === 'about' && <AboutModal onClose={() => setModal(null)} />}
      {modal?.type === 'groups' && <GroupsManagerModal onClose={() => setModal(null)} />}
    </div>
  );
}
