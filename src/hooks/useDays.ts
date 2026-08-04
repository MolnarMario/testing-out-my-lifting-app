import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { emptyDay, emptyReadiness, READINESS_KEYS } from "../lib/types";
import type { DayLog, Readiness } from "../lib/types";

export type DayMap = Record<string, DayLog>;

const numberOr = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/**
 * Saved days are checked on the way in. A day written by an older build — or by
 * a migration — must not be able to crash a render on a field that moved.
 */
function normalizeDay(raw: unknown): DayLog {
  const d = (raw ?? {}) as Partial<DayLog>;
  const readiness = { ...emptyReadiness(), ...(d.readiness ?? {}) } as Readiness;
  for (const key of READINESS_KEYS) readiness[key] = numberOr(readiness[key], 0);

  return {
    sets: Array.isArray(d.sets) ? d.sets : [],
    readinessOn: d.readinessOn === true,
    readiness,
    notesOn: d.notesOn === true,
    notes: typeof d.notes === "string" ? d.notes : "",
    sessionStart: typeof d.sessionStart === "string" ? d.sessionStart : "",
    sessionEnd: typeof d.sessionEnd === "string" ? d.sessionEnd : "",
    manualDurationMin:
      typeof d.manualDurationMin === "number" && Number.isFinite(d.manualDurationMin)
        ? d.manualDurationMin
        : null,
    rating: numberOr(d.rating, 0),
  };
}

export function useDays() {
  const [stored, setDays] = useLocalStorage<DayMap>("ironlog.days", {});

  const days = useMemo(() => {
    const out: DayMap = {};
    for (const [key, value] of Object.entries(stored)) out[key] = normalizeDay(value);
    return out;
  }, [stored]);

  const getDay = useCallback((key: string): DayLog => days[key] ?? emptyDay(), [days]);

  const updateDay = useCallback(
    (key: string, patch: (day: DayLog) => DayLog) => {
      setDays((prev) => ({ ...prev, [key]: patch(normalizeDay(prev[key])) }));
    },
    [setDays],
  );

  return { days, getDay, updateDay };
}
