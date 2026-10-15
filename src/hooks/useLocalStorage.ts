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

/**
 * Turns whatever JSON is stored under a key into a value of the right shape.
 * Saved data is trusted about as far as a text file: an older build, a hand
 * edit or a stray `null` must not reach a component, or a setter's `prev`.
 */
export type Normalize<T> = (raw: unknown) => T;

interface Store {
  value: unknown;
  listeners: Set<() => void>;
  /** Kept so a change from another tab can be parsed the same way. */
  parse: (raw: string | null) => unknown;
}

/**
 * One store per key, shared by every hook instance. Without this, two components
 * reading the same key hold separate copies and silently diverge the moment one
 * of them writes.
 */
const stores = new Map<string, Store>();

function getStore<T>(key: string, initial: T, normalize?: Normalize<T>): Store {
  const existing = stores.get(key);
  if (existing) return existing;

  const parse = (raw: string | null): T => {
    if (raw === null) return initial;
    try {
      const value: unknown = JSON.parse(raw);
      return normalize ? normalize(value) : (value as T);
    } catch {
      return initial;
    }
  };

  const store: Store = { value: parse(read(key)), listeners: new Set(), parse };
  stores.set(key, store);
  return store;
}

/**
 * Another tab wrote to storage. Without this, a second open tab keeps its old
 * copy and its next write puts that copy back, erasing whatever the first tab
 * logged in between. A null key means the other tab cleared everything.
 */
window.addEventListener("storage", (event) => {
  if (event.storageArea !== null && event.storageArea !== window.localStorage) return;

  const targets = event.key === null ? [...stores.entries()] : [[event.key, stores.get(event.key)] as const];
  for (const [key, store] of targets) {
    if (!store) continue;
    const raw = event.key === null ? read(key) : event.newValue;
    if (raw === null) memory.delete(key);
    else memory.set(key, raw);
    store.value = store.parse(raw);
    store.listeners.forEach((fn) => fn());
  }
});

export function useLocalStorage<T>(key: string, initial: T, normalize?: Normalize<T>) {
  const store = getStore(key, initial, normalize);

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
