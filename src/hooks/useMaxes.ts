import { useLocalStorage } from "./useLocalStorage";

export interface Maxes {
  squat: number | null;
  bench: number | null;
  deadlift: number | null;
}

const EMPTY_MAXES: Maxes = { squat: null, bench: null, deadlift: null };

function normalizeMaxes(raw: unknown): Maxes {
  const m = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const kg = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  return { squat: kg(m.squat), bench: kg(m.bench), deadlift: kg(m.deadlift) };
}

export function useMaxes() {
  return useLocalStorage<Maxes>("ironlog.maxes", EMPTY_MAXES, normalizeMaxes);
}
