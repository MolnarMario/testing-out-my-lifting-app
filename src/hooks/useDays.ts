import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { emptyDay } from "../lib/types";
import type { DayLog } from "../lib/types";

export type DayMap = Record<string, DayLog>;

export function useDays() {
  const [days, setDays] = useLocalStorage<DayMap>("ironlog.days", {});

  const getDay = useCallback(
    (key: string): DayLog => days[key] ?? emptyDay(),
    [days],
  );

  const updateDay = useCallback(
    (key: string, patch: (day: DayLog) => DayLog) => {
      setDays((prev) => ({ ...prev, [key]: patch(prev[key] ?? emptyDay()) }));
    },
    [setDays],
  );

  return { days, getDay, updateDay };
}
