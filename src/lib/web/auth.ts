export type Role = 'admin' | 'partner' | 'staff';

export interface AuthUser {
  email: string;
  role: Role;
  partnerId?: string | null;
  staffId?: string | null;
  name?: string | null;
}

export interface AuthPayload {
  token: string;
  user: AuthUser;
}

const KEY = 'zabava.auth';

export function saveAuth(payload: AuthPayload) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch {}
}

export function loadAuth(): AuthPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthPayload) : null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(KEY); } catch {}
}

export function getToken(): string | null {
  return loadAuth()?.token ?? null;
}

export function getCurrentUser(): AuthUser | null {
  return loadAuth()?.user ?? null;
}
