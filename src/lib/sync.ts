// ============================================================
//  sync.ts — background bridge between the offline localStore and
//  Supabase's gt_user_data table (see sql/schema.sql — one row per
//  user, three jsonb array columns). Mirrors the original app's
//  scheduleSyncToSupabase(): whole-blob push, debounced, fires on
//  reconnect.
//
//  Nothing in the UI ever awaits this. It is fire-and-forget: local
//  writes always succeed instantly; sync just tries to catch up.
// ============================================================

import { supabase, supabaseConfigured } from './supabase';
import { loadFields, saveFields, loadEvents, saveEvents, loadGroups, saveGroups, loadFarmProfile, saveFarmProfile } from './localStore';

const LAST_CHANGE_KEY = 'gt_last_local_change';
let pushTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 2500;

export type SyncStatus = 'offline' | 'synced' | 'syncing' | 'pending' | 'error' | 'no-account';

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
  localStorage.setItem(LAST_CHANGE_KEY, new Date().toISOString());
}

function getLastLocalChange(): number {
  return new Date(localStorage.getItem(LAST_CHANGE_KEY) || 0).getTime();
}

async function pushToSupabase() {
  if (!isOnline() || !supabaseConfigured()) return;
  const { data: auth } = await supabase!.auth.getUser();
  if (!auth.user) {
    setStatus('no-account');
    return;
  }
  setStatus('syncing');
  const { error } = await supabase!.from('gt_user_data').upsert({
    user_id: auth.user.id,
    fields: loadFields(),
    events: loadEvents(),
    groups: loadGroups(),
    farm: loadFarmProfile(),
  });
  setStatus(error ? 'error' : 'synced');
}

function scheduleSyncToSupabase() {
  markLocalChange();
  setStatus('pending');
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(pushToSupabase, DEBOUNCE_MS);
}

// Pulls the remote blob once — used right after login, or on first
// reconnect of a session, to reconcile a device that was offline when
// changes were made elsewhere. Last-write-wins, same conflict policy
// as the original app.
export async function pullFromSupabaseIfNewer() {
  if (!isOnline() || !supabaseConfigured()) return;
  const { data: auth } = await supabase!.auth.getUser();
  if (!auth.user) {
    setStatus('no-account');
    return;
  }
  setStatus('syncing');
  const { data, error } = await supabase!
    .from('gt_user_data')
    .select('fields, events, groups, farm, updated_at')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (error) {
    setStatus('error');
    return;
  }
  if (!data) {
    setStatus('synced');
    return;
  }

  const remoteUpdatedAt = new Date(data.updated_at ?? 0).getTime();
  if (remoteUpdatedAt > getLastLocalChange()) {
    saveFields(data.fields ?? []);
    saveEvents(data.events ?? []);
    saveGroups(data.groups ?? []);
    if (data.farm) saveFarmProfile(data.farm);
    // saveFields/saveEvents/saveGroups above each fire gt:dirty, which
    // would otherwise re-push what we just pulled straight back up —
    // harmless, but wasteful, so stamp the local-change clock to match
    // what the server just told us instead.
    localStorage.setItem(LAST_CHANGE_KEY, data.updated_at ?? new Date().toISOString());
  }
  setStatus('synced');
}

let initialized = false;

export function initSync() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  setStatus(isOnline() ? 'synced' : 'offline');

  window.addEventListener('online', () => {
    pullFromSupabaseIfNewer().then(pushToSupabase);
  });
  window.addEventListener('offline', () => setStatus('offline'));
  window.addEventListener('gt:dirty', scheduleSyncToSupabase);
}
