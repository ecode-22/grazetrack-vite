// ============================================================
//  sync.ts — background bridge between the offline localStore and
//  Django farm-data API (one row per user, JSON fields). Mirrors the original app's
//  scheduleSyncToApi(): whole-blob push, debounced, fires on
//  reconnect.
//
//  Nothing in the UI ever awaits this. It is fire-and-forget: local
//  writes always succeed instantly; sync just tries to catch up.
// ============================================================

import { apiRequest, hasApiSession, isAuthExpired, type FarmData } from './api';
import { getScopedStorageKey, loadSyncRecords, saveSyncRecords, loadFarmProfile, saveFarmProfile } from './localStore';
import { mergeSyncRecords } from './syncMerge';
export { mergeSyncRecords } from './syncMerge';

const LAST_CHANGE_KEY = 'gt_last_local_change';
const SERVER_VERSION_KEY = 'gt_server_updated_at';
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let applyingRemoteData = false;
const DEBOUNCE_MS = 2500;

export type SyncStatus = 'offline' | 'synced' | 'syncing' | 'pending' | 'error' | 'no-account' | 'auth-expired';

let status: SyncStatus = 'offline';
const listeners = new Set<(s: SyncStatus) => void>();

function setStatus(s: SyncStatus) {
  status = s;
  listeners.forEach((fn) => fn(s));
}

export function onSyncStatusChange(fn: (s: SyncStatus) => void) {
  listeners.add(fn);
  fn(status);
  return () => {
    listeners.delete(fn);
  };
}

export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : false;
}

function markLocalChange() {
  localStorage.setItem(getScopedStorageKey(LAST_CHANGE_KEY), new Date().toISOString());
}

function getLastLocalChange(): number {
  return new Date(localStorage.getItem(getScopedStorageKey(LAST_CHANGE_KEY)) || 0).getTime();
}

async function pushToApi(): Promise<boolean> {
  if (!isOnline()) return false;
  if (!hasApiSession()) {
    setStatus('no-account');
    return false;
  }
  setStatus('syncing');
  try {
    const response = await apiRequest<FarmData>('/farm-data/', {
      method: 'PUT',
      body: JSON.stringify({
        ...loadSyncRecords(),
        farm: loadFarmProfile(),
        expected_updated_at: localStorage.getItem(getScopedStorageKey(SERVER_VERSION_KEY)) || null,
      }),
    });
    localStorage.setItem(getScopedStorageKey(SERVER_VERSION_KEY), response.updated_at ?? '');
    setStatus('synced');
    return true;
  } catch (error) {
    if ((error as Error & { status?: number }).status === 409) {
      await pullFromApiIfNewer();
      return false;
    }
    if (isAuthExpired()) setStatus('auth-expired');
    else setStatus('error');
    return false;
  }
}

function scheduleSyncToApi() {
  if (applyingRemoteData) return;
  markLocalChange();
  setStatus('pending');
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(pushToApi, DEBOUNCE_MS);
}

// Pulls the remote blob once — used right after login, or on first
// reconnect of a session, to reconcile a device that was offline when
// changes were made elsewhere. Last-write-wins, same conflict policy
// as the original app.
export async function pullFromApiIfNewer() {
  if (!isOnline()) return;
  if (!hasApiSession()) {
    setStatus('no-account');
    return;
  }
  setStatus('syncing');
  let data: FarmData | null;
  try {
    data = await apiRequest<FarmData | null>('/farm-data/');
  } catch {
    setStatus(isAuthExpired() ? 'auth-expired' : 'error');
    return;
  }
  if (!data || !data.updated_at) {
    await pushToApi();
    return;
  }

  const remoteUpdatedAt = new Date(data.updated_at ?? 0).getTime();
  const localUpdatedAt = getLastLocalChange();
  const localRecords = loadSyncRecords();
  const merged = {
    fields: mergeSyncRecords(localRecords.fields, data.fields ?? []),
    events: mergeSyncRecords(localRecords.events, data.events ?? []),
    groups: mergeSyncRecords(localRecords.groups, data.groups ?? []),
  };
  const recordsChanged = JSON.stringify(merged) !== JSON.stringify(localRecords);
  const farmChanged = remoteUpdatedAt > localUpdatedAt && JSON.stringify(data.farm) !== JSON.stringify(loadFarmProfile());
  if (recordsChanged || farmChanged) {
    applyingRemoteData = true;
    try {
      if (recordsChanged) saveSyncRecords(merged);
      if (farmChanged) saveFarmProfile(data.farm);
    } finally {
      applyingRemoteData = false;
    }
    if (remoteUpdatedAt > localUpdatedAt) {
      localStorage.setItem(getScopedStorageKey(LAST_CHANGE_KEY), data.updated_at);
    }
    localStorage.setItem(getScopedStorageKey(SERVER_VERSION_KEY), data.updated_at);
  }

  localStorage.setItem(getScopedStorageKey(SERVER_VERSION_KEY), data.updated_at);
  if (JSON.stringify(merged) !== JSON.stringify(data.fields ? {
    fields: data.fields ?? [], events: data.events ?? [], groups: data.groups ?? [],
  } : merged) || localUpdatedAt > remoteUpdatedAt) {
    await pushToApi();
    return;
  }

  setStatus('synced');
}

let initialized = false;

export function initSync() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  if (!isOnline()) setStatus('offline');
  else if (hasApiSession()) void pullFromApiIfNewer();
  else setStatus('no-account');

  window.addEventListener('online', () => {
    void pullFromApiIfNewer();
  });
  window.addEventListener('offline', () => setStatus('offline'));
  window.addEventListener('gt:dirty', scheduleSyncToApi);
  window.addEventListener('focus', () => { void pullFromApiIfNewer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void pullFromApiIfNewer();
  });
}
