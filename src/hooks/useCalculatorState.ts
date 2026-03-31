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

function cacheKey(profileId: string, calcType: string, calcKey: string) {
  return `wh-calc-${profileId}-${calcType}${calcKey !== 'main' ? `-${calcKey}` : ''}`;
}

function parseEntry<T>(raw: string): CacheEntry<T> | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'state' in parsed && 'lastSyncedAt' in parsed) {
      return parsed as CacheEntry<T>;
    }
    // Phase 1 migration: raw state → wrap in CacheEntry
    return {
      state: parsed as T,
      lastModifiedAt: new Date().toISOString(),
      lastSyncedAt: '2000-01-01T00:00:00.000Z',
      version: CACHE_VERSION
    };
  } catch {
    return null;
  }
}

function readCache<T>(profileId: string, calcType: string, calcKey: string): CacheEntry<T> | null {
  try {
    // Try new key format first
    const newKey = cacheKey(profileId, calcType, calcKey);
    const raw = localStorage.getItem(newKey);
    if (raw) return parseEntry<T>(raw);

    // Auto-migration: if profileId is 'local', check old key format (pre-profile)
    if (profileId === 'local') {
      const oldKey = `wh-calc-${calcType}${calcKey !== 'main' ? `-${calcKey}` : ''}`;
      const oldRaw = localStorage.getItem(oldKey);
      if (oldRaw) {
        const entry = parseEntry<T>(oldRaw);
        if (entry) {
          localStorage.setItem(newKey, oldRaw);
          localStorage.removeItem(oldKey);
          return entry;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

function writeCache<T>(
  profileId: string,
  calcType: string,
  calcKey: string,
  state: T,
  opts: { touch?: boolean; sync?: string }
) {
  const existing = readCache<T>(profileId, calcType, calcKey);
  const now = new Date().toISOString();
  const entry: CacheEntry<T> = {
    state,
    lastModifiedAt: opts.touch ? now : (existing?.lastModifiedAt ?? now),
    lastSyncedAt:   opts.sync  ?? (existing?.lastSyncedAt  ?? now),
    version: CACHE_VERSION
  };
  try {
    localStorage.setItem(cacheKey(profileId, calcType, calcKey), JSON.stringify(entry));
  } catch { /* storage full */ }
  return entry;
}

// --- Debounce + flush registry ---
// Key format: profileId:calcType:calcKey
const syncTimers  = new Map<string, ReturnType<typeof setTimeout>>();
const pendingKeys = new Set<string>();
const lastPushAt  = new Map<string, number>();

async function pushToServer(
  profileId: string, calcType: string, calcKey: string, state: unknown, token: string, keepalive = false
) {
  const key = `${profileId}:${calcType}:${calcKey}`;
  lastPushAt.set(key, Date.now());
  try {
    const res = await fetch(`/api/state/${calcType}?key=${calcKey}&profile=${profileId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ state }),
      keepalive,
    } as RequestInit);
    if (res.ok) {
      const { updated_at } = await res.json();
      writeCache(profileId, calcType, calcKey, state, { sync: updated_at });
      pendingKeys.delete(key);
    }
  } catch { /* offline — stays dirty, pushed on next mount */ }
}

function debouncedPush(profileId: string, calcType: string, calcKey: string, state: unknown, token: string) {
  const key = `${profileId}:${calcType}:${calcKey}`;
  pendingKeys.add(key);
  clearTimeout(syncTimers.get(key));
  syncTimers.set(key, setTimeout(() => {
    syncTimers.delete(key);
    pushToServer(profileId, calcType, calcKey, state, token);
  }, DEBOUNCE_MS));
}

// Flush all pending writes immediately — called on tab hide / page leave
function flushAllPending() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token || pendingKeys.size === 0) return;

  for (const key of [...pendingKeys]) {
    clearTimeout(syncTimers.get(key));
    syncTimers.delete(key);

    const [pid, ct, ck] = key.split(':');
    const cached = readCache(pid, ct, ck);
    if (cached && cached.lastModifiedAt > cached.lastSyncedAt) {
      pushToServer(pid, ct, ck, cached.state, token, true);
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

async function runBackgroundValidation(token: string, profileId: string) {
  if (bgRunning) return;
  bgRunning = true;

  try {
    const lastCheck = localStorage.getItem(`wh-meta-checked-at-${profileId}`);
    if (lastCheck && Date.now() - new Date(lastCheck).getTime() < FRESHNESS_MS) {
      return;
    }

    const res = await fetch(`/api/state/meta?profile=${profileId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;

    const serverMeta: Record<string, string> = await res.json();
    localStorage.setItem(`wh-meta-checked-at-${profileId}`, new Date().toISOString());

    for (const [key, serverTs] of Object.entries(serverMeta)) {
      const [ct, ck] = key.split(':');
      const cached = readCache(profileId, ct, ck);

      if (!cached) {
        await fetchAndUpdate(profileId, ct, ck, token, key);
        continue;
      }

      if (serverTs > cached.lastSyncedAt && cached.lastModifiedAt <= cached.lastSyncedAt) {
        await fetchAndUpdate(profileId, ct, ck, token, key);
      }
    }
  } catch { /* network error */ }
  finally { bgRunning = false; }
}

async function fetchAndUpdate(profileId: string, calcType: string, calcKey: string, token: string, key: string) {
  try {
    const r = await fetch(`/api/state/${calcType}?key=${calcKey}&profile=${profileId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!r.ok) return;
    const { state, updated_at } = await r.json();
    writeCache(profileId, calcType, calcKey, state, { sync: updated_at });
    bgListeners.forEach(fn => fn(key, state));
  } catch { /* ignore */ }
}

// --- The Hook ---
export function useCalculatorState<T>(
  calcType: string,
  calcKey: string,
  defaultState: T,
  profileId: string = 'local'
): [T, (updater: T | ((prev: T) => T)) => void] {
  const { token } = useAuth();

  const [state, setStateRaw] = useState<T>(() => {
    const cached = readCache<T>(profileId, calcType, calcKey);
    return cached?.state ?? defaultState;
  });

  // Re-read from localStorage when profileId changes (profile switch)
  useEffect(() => {
    const cached = readCache<T>(profileId, calcType, calcKey);
    setStateRaw(cached?.state ?? defaultState);
  }, [profileId]);

  const setState = useCallback((updater: T | ((prev: T) => T)) => {
    setStateRaw(prev => {
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
      writeCache(profileId, calcType, calcKey, next, { touch: true });
      const t = token ?? localStorage.getItem(AUTH_TOKEN_KEY);
      if (t) debouncedPush(profileId, calcType, calcKey, next, t);
      return next;
    });
  }, [token, profileId, calcType, calcKey]);

  useEffect(() => {
    const t = token ?? localStorage.getItem(AUTH_TOKEN_KEY);
    if (!t) return;

    const cached = readCache<T>(profileId, calcType, calcKey);
    if (cached && cached.lastModifiedAt > cached.lastSyncedAt) {
      const key = `${profileId}:${calcType}:${calcKey}`;
      const last = lastPushAt.get(key) ?? 0;
      if (Date.now() - last > MIN_REMOUNT_GAP) {
        debouncedPush(profileId, calcType, calcKey, cached.state, t);
      }
    }

    const listener = (key: string, serverState: unknown) => {
      if (key === `${calcType}:${calcKey}`) {
        setStateRaw(serverState as T);
      }
    };
    bgListeners.push(listener);

    runBackgroundValidation(t, profileId);

    return () => {
      const idx = bgListeners.indexOf(listener);
      if (idx !== -1) bgListeners.splice(idx, 1);
    };
  }, [token, profileId]);

  return [state, setState];
}

// --- First-login sync (called once after successful login) ---
export async function syncAllOnLogin(token: string, profileId?: string) {
  // If no profileId provided, fetch the user's first profile
  let pid = profileId;
  if (!pid) {
    try {
      const res = await fetch('/api/profiles', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const profiles: Array<{ id: string }> = await res.json();
        pid = profiles[0]?.id;
      }
    } catch { /* offline */ }
  }
  if (!pid) return;

  const hasCache = Object.keys(localStorage).some(k => k.startsWith(`wh-calc-${pid}-`));

  if (!hasCache) {
    try {
      const res = await fetch(`/api/state/all?profile=${pid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      const all: Record<string, { state: unknown; updated_at: string }> = await res.json();
      for (const [key, { state, updated_at }] of Object.entries(all)) {
        const [ct, ck] = key.split(':');
        writeCache(pid, ct, ck, state, { sync: updated_at });
      }
    } catch { /* offline */ }
  } else {
    localStorage.removeItem(`wh-meta-checked-at-${pid}`);
  }
}
