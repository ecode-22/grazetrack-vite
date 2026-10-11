import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { loadEvents, loadFields, loadFarmProfile, saveFields, nextColor, onDataChanged } from '@/lib/localStore';
import { getStatus } from '@/lib/status';
import { calcAreaHa } from '@/lib/geo';
import type { Field, FieldGeometry, FieldType } from '@/lib/types';
import { daysBetween, uid } from '@/lib/utils';

export interface MapViewHandle {
  commitPendingField(details: { name: string; type: FieldType; restTarget: number; maxAUperHa: number | null }): void;
  cancelPendingField(): void;
  undoLastVertex(): void;
  flyToField(id: string): void;
  invalidateSize(): void;
}

interface Props {
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onDeselect: () => void;
  tool: 'select' | 'draw' | 'split';
  onFieldDrawn: () => void;
  onBoundaryDrawn: (geometry: FieldGeometry) => void;
  previewGeometries: FieldGeometry[];
  ndviEnabled: boolean;
  ndviDate: string;
  ndviOpacity: number;
  pressureEnabled: boolean;
  onVertexCount: (n: number) => void;
  onStatus: (msg: string) => void;
}

// Same fill logic as the original app's statusFillColor(): the map tints
// each field by its current grazing status, falling back to the field's
// own assigned colour when there's nothing more urgent to show.
function statusFillColor(field: Field): string {
  const s = getStatus(field);
  if (s.cls === 'grazing') return '#22c55e';
  if (s.cls === 'ready') return '#4ade80';
  if (s.cls === 'resting') return '#facc15';
  if (s.cls === 'danger') return '#f87171';
  return field.color || '#2d6a4f';
}

const MapView = forwardRef<MapViewHandle, Props>(function MapView(
  { selectedFieldId, onSelectField, onDeselect, tool, onFieldDrawn, onBoundaryDrawn, previewGeometries, ndviEnabled, ndviDate, ndviOpacity, pressureEnabled, onVertexCount, onStatus },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const fieldLayerGroupRef = useRef<L.FeatureGroup | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const pendingLayerRef = useRef<L.Layer | null>(null);
  const previewLayerGroupRef = useRef<L.FeatureGroup | null>(null);
  const ndviLayerRef = useRef<L.TileLayer | null>(null);
  const selectedFieldIdRef = useRef<string | null>(null);
  const toolRef = useRef(tool);
  const onBoundaryDrawnRef = useRef(onBoundaryDrawn);
  toolRef.current = tool;
  onBoundaryDrawnRef.current = onBoundaryDrawn;

  useEffect(() => {
    selectedFieldIdRef.current = selectedFieldId;
  }, [selectedFieldId]);

  // ---- one-time map setup ----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const location = loadFarmProfile()?.location;
    const mapCenter: L.LatLngExpression = location
      ? [location.latitude, location.longitude]
      : [-33.9, 18.5];
    const map = L.map(containerRef.current).setView(mapCenter, 15);
    mapRef.current = map;

    const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap contributors',
    });
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
      attribution: 'Tiles &copy; Esri',
    }).addTo(map);
    const terrain = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
      attribution: 'Tiles &copy; Esri',
    });
    L.control.layers({ Satellite: satellite, Streets: streets, Terrain: terrain }, {}, { position: 'topleft' }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);

    const fieldLayerGroup = new L.FeatureGroup().addTo(map);
    fieldLayerGroupRef.current = fieldLayerGroup;
    previewLayerGroupRef.current = new L.FeatureGroup().addTo(map);

    // Same shape options as the original: polygon-only, dashed while
    // drawing, no rectangle/circle/marker tools.
    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: false,
          shapeOptions: { color: '#52b788', fillColor: '#52b788', fillOpacity: 0.25, weight: 2.5, dashArray: '6 4' },
        },
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false,
      } as any,
      edit: false as any,
    });
    drawControlRef.current = drawControl;

    map.on((L as any).Draw.Event.CREATED, (e: any) => {
      pendingLayerRef.current = e.layer;
      fieldLayerGroup.addLayer(e.layer);
      try {
        map.removeControl(drawControl);
      } catch {
        /* already removed */
      }
      onVertexCount(0);
      if (toolRef.current === 'split') {
        onBoundaryDrawnRef.current(e.layer.toGeoJSON().geometry as FieldGeometry);
      } else {
        onFieldDrawn();
      }
    });

    map.on('draw:drawvertex', (e: any) => {
      const pts: L.LatLng[] = [];
      e.layers.eachLayer((l: any) => pts.push(l.getLatLng()));
      onVertexCount(pts.length);
      if (pts.length >= 3) {
        const geo = {
          type: 'Polygon' as const,
          coordinates: [[...pts, pts[0]].map((p) => [p.lng, p.lat])],
        };
        onStatus(`Drawing — ${pts.length} points · ~${calcAreaHa(geo).toFixed(1)} ha · double-click to finish`);
      } else {
        onStatus(`Drawing — ${pts.length} point${pts.length !== 1 ? 's' : ''} placed · need at least 3`);
      }
    });

    map.on('click', () => {
      // Matches the original: a plain map click while in select mode
      // (i.e. not mid-draw) clears the current selection.
      if (!pendingLayerRef.current) onDeselect();
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- rebuild all field polygons whenever the underlying data changes ----
  function rebuildFieldLayers() {
    const map = mapRef.current;
    const group = fieldLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const fields = loadFields();
    const events = loadEvents();
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const cutoffDate = cutoff.toISOString().slice(0, 10);
    const pressures = fields.map((field) => {
      const animalDays = events
        .filter((event) => event.fieldId === field.id && event.endDate >= cutoffDate)
        .reduce((sum, event) => sum + event.animalCount * daysBetween(event.startDate < cutoffDate ? cutoffDate : event.startDate, event.endDate), 0);
      return { id: field.id, value: field.areaHa > 0 ? animalDays / field.areaHa : 0 };
    });
    const maxPressure = Math.max(1, ...pressures.map((pressure) => pressure.value));

    fields.forEach((field) => {
      const layer = L.geoJSON(field.geometry as any, {
        style: () => {
          const pressure = pressures.find((item) => item.id === field.id)?.value ?? 0;
          const ratio = pressure / maxPressure;
          const fill = pressureEnabled
            ? ratio > 0.75 ? '#b91c1c' : ratio > 0.5 ? '#ea580c' : ratio > 0.25 ? '#eab308' : '#65a30d'
            : statusFillColor(field);
          return { color: fill, fillColor: fill, fillOpacity: 0.38, weight: 2.5 };
        },
      });
      layer.eachLayer((l: any) => {
        l.options.fieldId = field.id;
        l.bindTooltip(`<strong>${field.name}</strong><br>${field.areaHa.toFixed(1)} ha`, {
          permanent: true,
          direction: 'center',
          className: 'field-label',
        });
        l.on('click', (e: any) => {
          L.DomEvent.stopPropagation(e);
          onSelectField(field.id);
        });
      });
      group.addLayer(layer);
    });
  }

  useEffect(() => {
    rebuildFieldLayers();
    return onDataChanged(rebuildFieldLayers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pressureEnabled]);

  useEffect(() => {
    const group = previewLayerGroupRef.current;
    if (!group) return;
    group.clearLayers();
    const colors = ['#286747', '#387a91', '#ad6538', '#62894d', '#93674e', '#5578a4'];
    previewGeometries.forEach((geometry, index) => {
      const preview = L.geoJSON(geometry as any, {
        style: { color: '#fff', fillColor: colors[index % colors.length], fillOpacity: 0.6, weight: 2, dashArray: '5 3' },
      }).addTo(group);
      preview.eachLayer((layer) => {
        layer.bindTooltip(
          `P${String(index + 1).padStart(2, '0')}`,
          { permanent: true, direction: 'center', className: 'camp-lbl', opacity: 1 },
        );
      });
    });
  }, [previewGeometries]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (ndviLayerRef.current) {
      map.removeLayer(ndviLayerRef.current);
      ndviLayerRef.current = null;
    }
    if (!ndviEnabled) return;
    let hadTileError = false;
    const layer = L.tileLayer(
      `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${ndviDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`,
      { maxNativeZoom: 9, maxZoom: 20, opacity: ndviOpacity, attribution: 'NASA GIBS / MODIS' },
    );
    layer.on('tileerror', () => {
      if (hadTileError) return;
      hadTileError = true;
      onStatus('Vegetation imagery is unavailable for this date or area.');
    });
    layer.addTo(map);
    ndviLayerRef.current = layer;
  }, [ndviEnabled, ndviDate, ndviOpacity]);

  // ---- draw tool on/off, mirrors the original's setTool('draw') ----
  useEffect(() => {
    const map = mapRef.current;
    const drawControl = drawControlRef.current;
    if (!map || !drawControl) return;

    if (tool === 'draw' || tool === 'split') {
      map.addControl(drawControl);
      const timer = setTimeout(() => {
        const btn = document.querySelector<HTMLElement>('.leaflet-draw-draw-polygon');
        btn?.click();
      }, 60);
      onStatus(tool === 'split' ? 'Auto-split: trace the outside boundary · double-click to finish' : 'Click to place corners · double-click (or first point) to close · Esc to cancel');
      return () => clearTimeout(timer);
    } else {
      try {
        map.removeControl(drawControl);
      } catch {
        /* wasn't added */
      }
    }
  }, [tool]);

  useImperativeHandle(ref, () => ({
    commitPendingField(details) {
      const layer = pendingLayerRef.current as any;
      if (!layer) return;
      const group = fieldLayerGroupRef.current;
      group?.removeLayer(layer); // the persisted-field rebuild effect will redraw it properly styled
      pendingLayerRef.current = null;

      const geometry = layer.toGeoJSON().geometry;
      const field: Field = {
        id: uid(),
        name: details.name,
        type: details.type,
        restTarget: details.restTarget,
        maxAUperHa: details.maxAUperHa,
        geometry,
        areaHa: calcAreaHa(geometry),
        color: nextColor(),
        createdAt: new Date().toISOString(),
      };
      saveFields([...loadFields(), field]);
      onStatus(`Saved "${field.name}" — ${field.areaHa.toFixed(2)} ha`);
    },

    cancelPendingField() {
      const layer = pendingLayerRef.current;
      if (layer) {
        fieldLayerGroupRef.current?.removeLayer(layer);
        pendingLayerRef.current = null;
      }
      onVertexCount(0);
    },

    undoLastVertex() {
      // Same trick as the original: Leaflet-Draw listens for Ctrl+Z on
      // the document to pop the last placed vertex — there's no public
      // JS API for it, so we synthesize the same keyboard event.
      const evt = new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true, cancelable: true });
      Object.defineProperty(evt, 'keyCode', { get: () => 90 });
      document.dispatchEvent(evt);
    },

    flyToField(id) {
      const map = mapRef.current;
      const group = fieldLayerGroupRef.current;
      if (!map || !group) return;
      group.eachLayer((l: any) => {
        if (l.options?.fieldId === id) {
          map.fitBounds(l.getBounds(), { padding: [60, 60], maxZoom: 17 });
        }
      });
    },

    invalidateSize() {
      // The map panel is kept mounted (not unmounted) when another tab is
      // active, just hidden via CSS — Leaflet needs this nudge once it's
      // visible again or tiles render at the wrong size/offset.
      requestAnimationFrame(() => mapRef.current?.invalidateSize());
    },
  }));

  return <div ref={containerRef} id="map" aria-label="Farm field map" />;
});

export default MapView;
