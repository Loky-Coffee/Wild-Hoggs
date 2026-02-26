import { useState } from 'preact/hooks';

/**
 * Drop-in Ersatz für useState mit automatischer localStorage-Persistenz.
 * State überlebt Page-Reload. Funktioniert nur mit JSON-serialisierbaren Werten.
 * Set/Map müssen vor dem Speichern in Array/Object konvertiert werden.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, (updater: T | ((prev: T) => T)) => void] {
  const [state, setStateRaw] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return defaultValue;
      return JSON.parse(stored) as T;
    } catch {
      return defaultValue;
    }
  });

  const setState = (updater: T | ((prev: T) => T)) => {
    setStateRaw(prev => {
      const next = typeof updater === 'function'
        ? (updater as (p: T) => T)(prev)
        : updater;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage voll oder nicht verfügbar — State im Memory behalten
      }
      return next;
    });
  };

  return [state, setState];
}
