import { useLocalStorage } from "./useLocalStorage";
import type { Unit } from "../lib/types";

const normalizeUnit = (raw: unknown): Unit => (raw === "lb" ? "lb" : "kg");

export function useUnit() {
  return useLocalStorage<Unit>("ironlog.unit", "kg", normalizeUnit);
}
