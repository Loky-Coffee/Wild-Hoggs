import { useState, useEffect, useCallback } from 'preact/hooks';
import { useAuth } from './useAuth';
import { AUTH_TOKEN_KEY } from './useAuth';

// --- Cache constants ---
const CACHE_VERSION   = 1;
const FRESHNESS_MS    = 5 * 60 * 1000;  // 5 min — background meta-check window
const DEBOUNCE_MS     = 30_000;          // 30s  — wait 30s of inactivity before pushing
const MIN_REMOUNT_GAP = 10_000;          // 10s  — ignore dirty-push on re-mount if last push < 10s ago

interface CacheEntry<T> {
  state: T;
  lastModifiedAt: string;
  lastSyncedAt: string;
  version: number;
}

function cacheKey(calcType: string, calcKey: string) {
  return `wh-calc-${calcType}${calcKey !== 'main' ? `-${calcKey}` : ''}`;
}

function readCache<T>(calcType: string, calcKey: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(cacheKey(calcType, calcKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Phase 2 format: has 'state' + 'lastSyncedAt'
    if (parsed && typeof parsed === 'object' && 'state' in parsed && 'lastSyncedAt' in parsed) {
      return parsed as CacheEntry<T>;
    }
    // Phase 1 migration: raw state → wrap in CacheEntry
    return {
      state: parsed as T,
      lastModifiedAt: new Date().toISOString(),
      lastSyncedAt: '2000-01-01T00:00:00.000Z', // never synced
      version: CACHE_VERSION
    };
  } catch {
    return null;
  }
}

function writeCache<T>(
  calcType: string,
  calcKey: string,
  state: T,
  opts: { touch?: boolean; sync?: string }
) {
  const existing = readCache<T>(calcType, calcKey);
  const now = new Date().toISOString();
  const entry: CacheEntry<T> = {
    state,
    lastModifiedAt: opts.touch ? now : (existing?.lastModifiedAt ?? now),
    lastSyncedAt:   opts.sync  ?? (existing?.lastSyncedAt  ?? now),
    version: CACHE_VERSION
  };
  try {
    localStorage.setItem(cacheKey(calcType, calcKey), JSON.stringify(entry));
  } catch { /* storage full */ }
  return entry;
}

// --- Debounce + flush registry ---
const syncTimers  = new Map<string, ReturnType<typeof setTimeout>>();
const pendingKeys = new Set<string>();   // keys with in-flight debounce timers
const lastPushAt  = new Map<string, number>(); // key → ms timestamp of last push attempt

async function pushToServer(
  calcType: string, calcKey: string, state: unknown, token: string, keepalive = false
) {
  const key = `${calcType}:${calcKey}`;
  lastPushAt.set(key, Date.now());
  try {
    const res = await fetch(`/api/state/${calcType}?key=${calcKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ state }),
      keepalive, // true when called on page-hide, ensures request survives unload
    } as RequestInit);
    if (res.ok) {
      const { updated_at } = await res.json();
      writeCache(calcType, calcKey, state, { sync: updated_at });
      pendingKeys.delete(key);
    }
  } catch { /* offline — stays dirty, pushed on next mount */ }
}

function debouncedPush(calcType: string, calcKey: string, state: unknown, token: string) {
  const key = `${calcType}:${calcKey}`;
  pendingKeys.add(key);
  clearTimeout(syncTimers.get(key));
  syncTimers.set(key, setTimeout(() => {
    syncTimers.delete(key);
    pushToServer(calcType, calcKey, state, token);
  }, DEBOUNCE_MS));
}

// Flush all pending writes immediately — called on tab hide / page leave
function flushAllPending() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token || pendingKeys.size === 0) return;

  for (const key of [...pendingKeys]) {
    clearTimeout(syncTimers.get(key));
    syncTimers.delete(key);

    const [ct, ck] = key.split(':');
    const cached = readCache(ct, ck);
    if (cached && cached.lastModifiedAt > cached.lastSyncedAt) {
      // keepalive: true ensures the request survives even after the page is hidden
      pushToServer(ct, ck, cached.state, token, true);
    } else {
      pendingKeys.delete(key);
    }
  }
}

// Register page-hide listeners exactly once at module level
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAllPending();
  });
  window.addEventListener('pagehide', flushAllPending);
}

// --- Background validation (shared, runs once per 5-minute window) ---
let bgRunning = false;
const bgListeners: Array<(key: string, state: unknown) => void> = [];

async function runBackgroundValidation(token: string) {
  if (bgRunning) return;
  bgRunning = true;

  try {
    const lastCheck = localStorage.getItem('wh-meta-checked-at');
    if (lastCheck && Date.now() - new Date(lastCheck).getTime() < FRESHNESS_MS) {
      return; // Still fresh — skip entirely
    }

    const res = await fetch('/api/state/meta', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;

    const serverMeta: Record<string, string> = await res.json();
    localStorage.setItem('wh-meta-checked-at', new Date().toISOString());

    for (const [key, serverTs] of Object.entries(serverMeta)) {
      const [ct, ck] = key.split(':');
      const cached = readCache(ct, ck);

      if (!cached) {
        await fetchAndUpdate(ct, ck, token, key);
        continue;
      }

      // Server has newer data AND local has no unsaved changes
      if (serverTs > cached.lastSyncedAt && cached.lastModifiedAt <= cached.lastSyncedAt) {
        await fetchAndUpdate(ct, ck, token, key);
      }
    }
  } catch { /* network error — try again next time */ }
  finally { bgRunning = false; }
}

async function fetchAndUpdate(calcType: string, calcKey: string, token: string, key: string) {
  try {
    const r = await fetch(`/api/state/${calcType}?key=${calcKey}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!r.ok) return;
    const { state, updated_at } = await r.json();
    writeCache(calcType, calcKey, state, { sync: updated_at });
    bgListeners.forEach(fn => fn(key, state));
  } catch { /* ignore */ }
}

// --- The Hook ---
export function useCalculatorState<T>(
  calcType: string,
  calcKey: string,
  defaultState: T
): [T, (updater: T | ((prev: T) => T)) => void] {
  const { token } = useAuth();

  const [state, setStateRaw] = useState<T>(() => {
    const cached = readCache<T>(calcType, calcKey);
    return cached?.state ?? defaultState;
  });

  const setState = useCallback((updater: T | ((prev: T) => T)) => {
    setStateRaw(prev => {
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
      writeCache(calcType, calcKey, next, { touch: true });
      const t = token ?? localStorage.getItem(AUTH_TOKEN_KEY);
      if (t) debouncedPush(calcType, calcKey, next, t);
      return next;
    });
  }, [token, calcType, calcKey]);

  useEffect(() => {
    const t = token ?? localStorage.getItem(AUTH_TOKEN_KEY);
    if (!t) return;

    // Push dirty state on mount — but only if last push was > 10s ago.
    // Prevents double-push after Astro View Transition re-hydration.
    const cached = readCache<T>(calcType, calcKey);
    if (cached && cached.lastModifiedAt > cached.lastSyncedAt) {
      const key = `${calcType}:${calcKey}`;
      const last = lastPushAt.get(key) ?? 0;
      if (Date.now() - last > MIN_REMOUNT_GAP) {
        debouncedPush(calcType, calcKey, cached.state, t);
      }
    }

    // Register as listener for background updates
    const listener = (key: string, serverState: unknown) => {
      if (key === `${calcType}:${calcKey}`) {
        setStateRaw(serverState as T);
      }
    };
    bgListeners.push(listener);

    // Run background validation (shared, max once per 5min)
    runBackgroundValidation(t);

    return () => {
      const idx = bgListeners.indexOf(listener);
      if (idx !== -1) bgListeners.splice(idx, 1);
    };
  }, [token]);

  return [state, setState];
}

// --- First-login sync (called once after successful login) ---
export async function syncAllOnLogin(token: string) {
  const hasCache = Object.keys(localStorage).some(k => k.startsWith('wh-calc-'));

  if (!hasCache) {
    // New device: fetch all states at once
    try {
      const res = await fetch('/api/state/all', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      const all: Record<string, { state: unknown; updated_at: string }> = await res.json();
      for (const [key, { state, updated_at }] of Object.entries(all)) {
        const [ct, ck] = key.split(':');
        writeCache(ct, ck, state, { sync: updated_at });
      }
    } catch { /* offline */ }
  } else {
    // Has local cache: force an immediate meta check
    localStorage.removeItem('wh-meta-checked-at');
  }
}
