// ============================================================
//  utils.ts — ported 1:1 from the original app's gt-utils.js so
//  dates, ids, and area math behave identically.
// ============================================================

export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.round((+new Date(b) - +new Date(a)) / 86400000));
}

export function daysSince(d: string): number {
  return daysBetween(d, todayStr());
}

export function fmtDate(s: string): string {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

export function cap(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function groupEmoji(type: string): string {
  const map: Record<string, string> = {
    cattle: '🐄', sheep: '🐑', goats: '🐐', horses: '🐎', pigs: '🐷', mixed: '🐾',
  };
  return map[(type || '').toLowerCase()] || '🐾';
}

export function download(filename: string, content: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
