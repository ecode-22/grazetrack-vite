import type { AnimalGroup, FarmProfile, Field, GrazingEvent } from './types';
import { setActiveAccount } from './localStore';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
  || 'http://localhost:8000/api';
const ACCESS_TOKEN_KEY = 'gt_api_access';
const REFRESH_TOKEN_KEY = 'gt_api_refresh';

type AuthMode = 'signin' | 'signup';

export type FarmData = {
  fields: Field[];
  events: GrazingEvent[];
  groups: AnimalGroup[];
  farm: FarmProfile | null;
  updated_at: string | null;
};

type TokenResponse = {
  access: string;
  refresh: string;
  user: { id: number; email: string };
};

export type AccountInfo = { id: number; email: string; date_joined: string };

export function hasApiSession() {
  return Boolean(localStorage.getItem(ACCESS_TOKEN_KEY) && localStorage.getItem(REFRESH_TOKEN_KEY));
}

function saveTokens(tokens: TokenResponse) {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
}

export function clearApiSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  setActiveAccount(null);
}

async function responseError(response: Response) {
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  const firstMessage = body && Object.values(body).flatMap((value) =>
    Array.isArray(value) ? value : [value],
  ).find((value) => typeof value === 'string');
  return new Error(typeof firstMessage === 'string' ? firstMessage : `Request failed (${response.status}).`);
}

export async function authenticate(email: string, password: string, mode: AuthMode) {
  const response = await fetch(`${API_URL}/auth/${mode === 'signin' ? 'login' : 'register'}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  if (!response.ok) throw await responseError(response);
  const tokens = await response.json() as TokenResponse;
  setActiveAccount(tokens.user.id);
  saveTokens(tokens);
}

export function getCurrentAccount() {
  return apiRequest<AccountInfo>('/auth/me/');
}

export function changeAccountPassword(currentPassword: string, newPassword: string) {
  return apiRequest<{ detail: string }>('/auth/password/', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
      refresh: localStorage.getItem(REFRESH_TOKEN_KEY),
    }),
  });
}

export async function logoutAccount() {
  try {
    const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refresh) {
      await apiRequest<{ detail: string }>('/auth/logout/', {
        method: 'POST',
        body: JSON.stringify({ refresh }),
      });
    }
  } finally {
    clearApiSession();
  }
}

async function refreshAccessToken() {
  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refresh) return null;
  try {
    const response = await fetch(`${API_URL}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!response.ok) {
      clearApiSession();
      return null;
    }
    const tokens = await response.json() as { access: string };
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
    return tokens.access;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const access = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (access) headers.set('Authorization', `Bearer ${access}`);

  let response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401 && access) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${refreshed}`);
      response = await fetch(`${API_URL}${path}`, { ...init, headers });
    }
  }
  if (!response.ok) throw await responseError(response);
  return await response.json() as T;
}