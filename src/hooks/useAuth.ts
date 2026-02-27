import { useState, useEffect } from 'preact/hooks';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  faction: string | null;
  server: string | null;
  language: string;
  formation_power_br: number | null;
  formation_power_wd: number | null;
  formation_power_go: number | null;
}

export const AUTH_TOKEN_KEY = 'wh-auth-token';
export const AUTH_USER_KEY  = 'wh-auth-user';

/** Reads auth state from localStorage. Listens for cross-island auth changes. */
export function useAuth() {
  const [token, setToken] = useState<string | null>(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null
  );
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof localStorage === 'undefined') return null;
    const stored = localStorage.getItem(AUTH_USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  // On hard reload: Preact hydrates from SSR-built HTML (localStorage was undefined
  // at build time → token = null). Explicitly sync from localStorage after mount
  // so the component always shows the correct auth state without needing an event.
  useEffect(() => {
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const storedUserStr = localStorage.getItem(AUTH_USER_KEY);
    const storedUser: AuthUser | null = storedUserStr ? JSON.parse(storedUserStr) : null;
    setToken(storedToken);
    setUser(storedUser);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { detail } = e as CustomEvent<{ user: AuthUser | null; token: string | null }>;
      setToken(detail.token);
      setUser(detail.user);
    };
    window.addEventListener('wh-auth-change', handler);
    return () => window.removeEventListener('wh-auth-change', handler);
  }, []);

  return { token, user, isLoggedIn: !!token };
}

/** Saves auth state to localStorage and notifies all islands. */
export function setAuthState(user: AuthUser, token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent('wh-auth-change', { detail: { user, token } }));
}

/** Clears auth state and notifies all islands. */
export function clearAuthState() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem('wh-meta-checked-at');
  window.dispatchEvent(new CustomEvent('wh-auth-change', { detail: { user: null, token: null } }));
}
