import { useLocalStorage } from "./useLocalStorage";

export interface Maxes {
  squat: number | null;
  bench: number | null;
  deadlift: number | null;
}

const EMPTY_MAXES: Maxes = { squat: null, bench: null, deadlift: null };

export function useMaxes() {
  return useLocalStorage<Maxes>("ironlog.maxes", EMPTY_MAXES);
}
