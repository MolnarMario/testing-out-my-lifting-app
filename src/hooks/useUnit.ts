import { useLocalStorage } from "./useLocalStorage";
import type { Unit } from "../lib/types";

export function useUnit() {
  return useLocalStorage<Unit>("ironlog.unit", "kg");
}
