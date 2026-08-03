import { useCallback, useSyncExternalStore } from "react";

/**
 * localStorage may be unavailable (Safari private mode) or full. We detect that
 * once up front and keep a process-memory mirror so the session still works —
 * but we record the failure rather than swallowing it, so the UI can warn that
 * nothing is being persisted.
 */
const memory = new Map<string, string>();

let storageWorks = true;
try {
  const probe = "__ironlog_probe__";
  window.localStorage.setItem(probe, "1");
  window.localStorage.removeItem(probe);
} catch {
  storageWorks = false;
}

let broken = !storageWorks;
const brokenListeners = new Set<() => void>();

function markBroken() {
  if (broken) return;
  broken = true;
  brokenListeners.forEach((fn) => fn());
}

function subscribeBroken(fn: () => void): () => void {
  brokenListeners.add(fn);
  return () => {
    brokenListeners.delete(fn);
  };
}

/**
 * True when writes are not reaching disk — data lives in memory only and will
 * be lost on reload.
 */
export function usePersistenceBroken(): boolean {
  return useSyncExternalStore(
    subscribeBroken,
    () => broken,
    () => false,
  );
}

function read(key: string): string | null {
  try {
    return storageWorks ? window.localStorage.getItem(key) : (memory.get(key) ?? null);
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, raw: string) {
  memory.set(key, raw);
  if (!storageWorks) return;
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    markBroken();
  }
}

interface Store {
  value: unknown;
  listeners: Set<() => void>;
}

/**
 * One store per key, shared by every hook instance. Without this, two components
 * reading the same key hold separate copies and silently diverge the moment one
 * of them writes.
 */
const stores = new Map<string, Store>();

function getStore<T>(key: string, initial: T): Store {
  const existing = stores.get(key);
  if (existing) return existing;

  let value: T;
  try {
    const raw = read(key);
    value = raw !== null ? (JSON.parse(raw) as T) : initial;
  } catch {
    value = initial;
  }

  const store: Store = { value, listeners: new Set() };
  stores.set(key, store);
  return store;
}

export function useLocalStorage<T>(key: string, initial: T) {
  const store = getStore(key, initial);

  const value = useSyncExternalStore(
    useCallback(
      (onChange: () => void) => {
        store.listeners.add(onChange);
        return () => {
          store.listeners.delete(onChange);
        };
      },
      [store],
    ),
    () => store.value as T,
  );

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(store.value as T) : next;
      if (Object.is(resolved, store.value)) return;

      store.value = resolved;
      write(key, JSON.stringify(resolved));
      store.listeners.forEach((fn) => fn());
    },
    [key, store],
  );

  return [value, setValue] as const;
}
