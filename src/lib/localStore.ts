// ============================================================
//  localStore.ts — the offline source of truth. Every read/write in
//  the app goes through here first, so the app is ALWAYS usable with
//  zero connectivity — Supabase (sync.ts) is purely a background
//  target, never something a screen waits on.
//
//  Mirrors the original vanilla-JS app's gt-data.js: three separate
//  localStorage keys (gt_fields, gt_events, gt_groups), same colour
//  palette, same "notify on change" pattern (there it was direct DOM
//  calls; here it's a CustomEvent any component can subscribe to).
// ============================================================

import type { Field, GrazingEvent, AnimalGroup, FarmProfile } from './types';

const KEYS = {
  fields: 'gt_fields',
  events: 'gt_events',
  groups: 'gt_groups',
  farm: 'gt_farm',
} as const;

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

function emitChange() {
  window.dispatchEvent(new CustomEvent('gt:data-changed'));
  window.dispatchEvent(new CustomEvent('gt:dirty')); // tells sync.ts a push is owed
}

function save<T>(key: string, value: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    emitChange();
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError') {
      alert('Storage full! Export a backup first.');
    }
  }
}

export const loadFields = (): Field[] => load<Field>(KEYS.fields);
export const saveFields = (v: Field[]) => save(KEYS.fields, v);

export const loadEvents = (): GrazingEvent[] => load<GrazingEvent>(KEYS.events);
export const saveEvents = (v: GrazingEvent[]) => save(KEYS.events, v);

export const loadGroups = (): AnimalGroup[] => load<AnimalGroup>(KEYS.groups);
export const saveGroups = (v: AnimalGroup[]) => save(KEYS.groups, v);

export function loadFarmProfile(): FarmProfile | null {
  try {
    const raw = localStorage.getItem(KEYS.farm);
    return raw ? (JSON.parse(raw) as FarmProfile) : null;
  } catch {
    localStorage.removeItem(KEYS.farm);
    return null;
  }
}

export function saveFarmProfile(profile: FarmProfile | null) {
  try {
    if (profile) localStorage.setItem(KEYS.farm, JSON.stringify(profile));
    else localStorage.removeItem(KEYS.farm);
    emitChange();
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError') alert('Storage full! Export a backup first.');
  }
}

// Same 15-colour rotation as the original app, assigned in sequence as
// fields are created (so re-creating a field after deletes still cycles
// sensibly rather than clustering on one colour).
export const COLORS = [
  '#2d6a4f', '#52b788', '#40916c', '#74c69d', '#1b4332',
  '#34a0a4', '#0077b6', '#7b2d8b', '#d97706', '#dc2626',
  '#0891b2', '#059669', '#7c3aed', '#db2777', '#b45309',
];

export function nextColor(): string {
  const used = loadFields().length;
  return COLORS[used % COLORS.length];
}

export function getStorageUsage() {
  let used = 0;
  (Object.values(KEYS) as string[]).forEach((k) => {
    const v = localStorage.getItem(k);
    if (v) used += v.length * 2;
  });
  const max = 5 * 1024 * 1024;
  return { used, max, pct: Math.min(100, (used / max) * 100) };
}

export function onDataChanged(fn: () => void) {
  window.addEventListener('gt:data-changed', fn);
  return () => window.removeEventListener('gt:data-changed', fn);
}

export function clearAllData() {
  localStorage.removeItem(KEYS.fields);
  localStorage.removeItem(KEYS.events);
  localStorage.removeItem(KEYS.groups);
  localStorage.removeItem(KEYS.farm);
  emitChange();
}
