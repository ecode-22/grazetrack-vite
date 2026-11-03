import type { AnimalGroup, FarmProfile, Field, GrazingEvent } from './types';
import { setActiveAccount } from './localStore';

const DEFAULT_API_HOST = typeof window !== 'undefined' && window.location.hostname
  ? window.location.hostname
  : 'localhost';
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
  || `${typeof window !== 'undefined' ? window.location.protocol : 'http:'}//${DEFAULT_API_HOST}:8000/api`;
const SESSION_KEY = 'gt_api_session';
const LEGACY_TOKEN_KEYS = ['gt_api_access', 'gt_api_refresh'];

type AuthMode = 'signin' | 'signup';

export type FarmData = {
  fields: Field[];
  events: GrazingEvent[];
  groups: AnimalGroup[];
  farm: FarmProfile | null;
  updated_at: string | null;
};


type SessionResponse = {
  user: { id: number; email: string };
};

export type AccountInfo = { id: number; email: string; date_joined: string };

let csrfToken: string | null = null;

if (typeof window !== 'undefined') {
  for (const key of LEGACY_TOKEN_KEYS) localStorage.removeItem(key);
}

export function hasApiSession() {
  return localStorage.getItem(SESSION_KEY) === '1';
}

let authExpired = false;

export function isAuthExpired() {
  return authExpired;
}

function saveSession(userId: number) {
  authExpired = false;
  localStorage.setItem(SESSION_KEY, '1');
  setActiveAccount(userId);
}

export function clearApiSession() {
  localStorage.removeItem(SESSION_KEY);
  for (const key of LEGACY_TOKEN_KEYS) localStorage.removeItem(key);
  csrfToken = null;
  setActiveAccount(null);
  window.dispatchEvent(new CustomEvent('gt:auth-changed'));
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API_URL}/auth/csrf/`, { credentials: 'include' });
  if (!response.ok) throw await responseError(response);
  const body = await response.json() as { csrfToken: string };
  csrfToken = body.csrfToken;
  return csrfToken;
}

async function responseError(response: Response) {
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  const firstMessage = body && Object.values(body).flatMap((value) =>
    Array.isArray(value) ? value : [value],
  ).find((value) => typeof value === 'string');
  const error = new Error(typeof firstMessage === 'string' ? firstMessage : `Request failed (${response.status}).`);
  Object.assign(error, { status: response.status });
  return error;
}

export async function authenticate(email: string, password: string, mode: AuthMode, confirmPassword?: string, fullName?: string) {
  const token = await getCsrfToken();
  const response = await fetch(`${API_URL}/auth/${mode === 'signin' ? 'login' : 'register'}/`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': token },
    body: JSON.stringify({
      email: email.trim(),
      password,
      ...(mode === 'signup' ? { confirm_password: confirmPassword, full_name: fullName?.trim() } : {}),
    }),
  });
  if (!response.ok) throw await responseError(response);
  const session = await response.json() as SessionResponse;
  saveSession(session.user.id);
}

export function requestPasswordReset(email: string) {
  return apiRequest<{ detail: string }>('/auth/password-reset/', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim() }),
  });
}

export function confirmPasswordReset(uid: string, token: string, password: string, confirmPassword: string) {
  return apiRequest<{ detail: string }>('/auth/password-reset/confirm/', {
    method: 'POST',
    body: JSON.stringify({ uid, token, password, confirm_password: confirmPassword }),
  });
}

export function getCurrentAccount() {
  return apiRequest<AccountInfo>('/auth/me/');
}

export function changeAccountPassword(currentPassword: string, newPassword: string) {
  return apiRequest<{ detail: string }>('/auth/password/', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export async function logoutAccount() {
  try {
    if (hasApiSession()) await apiRequest<{ detail: string }>('/auth/logout/', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  } finally {
    clearApiSession();
  }
}

async function refreshAccessToken() {
  try {
    const token = await getCsrfToken();
    const response = await fetch(`${API_URL}/auth/refresh/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': token },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      authExpired = true;
      return null;
    }
    return true;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const method = (init.method ?? 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    headers.set('X-CSRFToken', await getCsrfToken());
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const signal = init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
  try {
  let response = await fetch(`${API_URL}${path}`, { ...init, headers, signal, credentials: 'include' });
  if (response.status === 401 && hasApiSession()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await fetch(`${API_URL}${path}`, { ...init, headers, signal, credentials: 'include' });
    } else {
      clearApiSession();
    }
  }
  if (!response.ok) throw await responseError(response);
  return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}
