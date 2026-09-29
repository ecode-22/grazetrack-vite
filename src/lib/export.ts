// ============================================================
//  export.ts — ported from gt-dashboard.js's exportJSON / exportGeoJSON /
//  exportCSV / importJSON / clearAllData.
// ============================================================

import {
  loadFields,
  saveFields,
  loadEvents,
  saveEvents,
  loadGroups,
  saveGroups,
  clearAllData as clearStore,
} from './localStore';
import { download, daysBetween } from './utils';

const DB_VERSION = 4;

export function exportJSON() {
  download(
    'grazingtrack-backup.json',
    JSON.stringify(
      {
        version: DB_VERSION,
        exportedAt: new Date().toISOString(),
        fields: loadFields(),
        events: loadEvents(),
        groups: loadGroups(),
      },
      null,
      2,
    ),
    'application/json',
  );
}

export function exportGeoJSON() {
  const fc = {
    type: 'FeatureCollection',
    features: loadFields().map((f) => ({
      type: 'Feature',
      properties: {
        id: f.id,
        name: f.name,
        type: f.type,
        area_ha: f.areaHa,
        rest_target_days: f.restTarget,
        max_au_per_ha: f.maxAUperHa || null,
        color: f.color,
      },
      geometry: f.geometry,
    })),
  };
  download('grazingtrack-fields.geojson', JSON.stringify(fc, null, 2), 'application/geo+json');
}

export function exportCSV() {
  const fields = loadFields();
  const events = [...loadEvents()].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const rows: (string | number)[][] = [
    ['Field', 'Start date', 'End date', 'Days', 'Animal type', 'Count', 'AU/ha', 'Notes'],
  ];
  events.forEach((e) => {
    const f = fields.find((x) => x.id === e.fieldId);
    const auHa = f ? (e.animalCount / f.areaHa).toFixed(2) : '';
    rows.push([
      f ? f.name : 'Unknown',
      e.startDate,
      e.endDate,
      daysBetween(e.startDate, e.endDate),
      e.animalType,
      e.animalCount,
      auHa,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ]);
  });
  download('grazingtrack-events.csv', rows.map((r) => r.join(',')).join('\n'), 'text/csv');
}

export function importJSON(file: File): Promise<{ fieldCount: number; eventCount: number } | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!Array.isArray(data.fields) || !Array.isArray(data.events)) throw new Error('Invalid backup file');
        saveFields(data.fields);
        saveEvents(data.events);
        if (Array.isArray(data.groups)) saveGroups(data.groups);
        resolve({ fieldCount: data.fields.length, eventCount: data.events.length });
      } catch {
        reject(new Error('Invalid backup file.'));
      }
    };
    reader.readAsText(file);
  });
}

export function clearAllData() {
  clearStore();
}
