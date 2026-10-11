// ============================================================
//  types.ts — mirrors the original app's gt_fields / gt_events /
//  gt_groups schema exactly (see gt-data.js, gt-map.js, gt-events.js
//  in the original vanilla-JS repo), so the database table and any
//  exported JSON stay compatible.
// ============================================================

export type FieldType = 'pasture' | 'hay' | 'crop' | 'other';
export type AnimalType = 'cattle' | 'sheep' | 'goats' | 'horses' | 'pigs' | 'mixed' | string;

export interface FieldGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: any;
}

export interface Field {
  id: string;
  name: string;
  type: FieldType;
  restTarget: number; // days
  maxAUperHa: number | null;
  geometry: FieldGeometry;
  areaHa: number;
  color: string;
  createdAt: string; // ISO
}

export interface GrazingEvent {
  id: string;
  fieldId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  animalType: AnimalType;
  animalCount: number;
  herd: string;
  notes: string;
  loggedAt: string; // ISO
}

export interface AnimalGroup {
  id: string;
  name: string;
  type: AnimalType;
  count: number;
  herd: string;
}

export interface FarmProfile {
  name: string;
  deviceMode: 'single' | 'multiple';
  location: {
    latitude: number;
    longitude: number;
    accuracyM: number;
    capturedAt: string;
  } | null;
}

export type FieldStatusClass = 'none' | 'grazing' | 'resting' | 'ready' | 'danger';

export interface FieldStatus {
  label: string;
  cls: FieldStatusClass;
}
