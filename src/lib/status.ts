// ============================================================
//  status.ts — ported 1:1 from gt-map.js's getStatus() / getReadinessPct().
//  Governs the coloured status pill on every field, the map tint, and
//  the dashboard KPIs, so all three stay consistent with each other —
//  exactly like the original app.
// ============================================================

import type { Field, FieldStatus } from './types';
import { loadEvents } from './localStore';
import { todayStr, daysSince } from './utils';

export function getEffectiveRestTarget(field: Field): number {
  return field.restTarget;
}

export function getStatus(field: Field): FieldStatus {
  const events = loadEvents()
    .filter((e) => e.fieldId === field.id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  if (!events.length) return { label: 'Never grazed', cls: 'none' };

  const latest = events[0];
  const today = todayStr();

  if (latest.startDate <= today && latest.endDate >= today) {
    return { label: 'Grazing now', cls: 'grazing' };
  }

  const rest = daysSince(latest.endDate);
  if (rest < 0) return { label: 'Planned', cls: 'resting' };

  const target = getEffectiveRestTarget(field);
  if (rest >= target) return { label: 'Ready', cls: 'ready' };
  if (rest >= target * 0.6) return { label: `${rest}d / ${target}d rest`, cls: 'resting' };
  return { label: 'Needs rest', cls: 'danger' };
}

export function getReadinessPct(field: Field): number {
  const events = loadEvents()
    .filter((e) => e.fieldId === field.id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  if (!events.length) return 100;

  const latest = events[0];
  const today = todayStr();
  if (latest.startDate <= today && latest.endDate >= today) return 0;

  const target = getEffectiveRestTarget(field);
  return Math.min(100, Math.round((Math.max(0, daysSince(latest.endDate)) / target) * 100));
}
