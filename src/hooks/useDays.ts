import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { emptyDay, emptyReadiness, READINESS_KEYS } from "../lib/types";
import type { DayLog, IntensityType, Readiness, SetEntry } from "../lib/types";
import { uid } from "../lib/format";

export type DayMap = Record<string, DayLog>;

const numberOr = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const INTENSITY: IntensityType[] = ["rpe", "pct", "none"];

/**
 * A set needs an exercise to belong to; anything else is defaulted rather than
 * dropped, so one bad field cannot cost the user the set.
 */
function normalizeSet(raw: unknown): SetEntry | null {
  if (!isObject(raw) || typeof raw.exerciseId !== "string") return null;
  const s = raw as Partial<SetEntry>;
  return {
    ...s,
    id: typeof s.id === "string" ? s.id : uid(),
    groupId: typeof s.groupId === "string" ? s.groupId : uid(),
    exerciseId: raw.exerciseId,
    weight: numberOr(s.weight, 0),
    reps: numberOr(s.reps, 0),
    intensityType: INTENSITY.includes(s.intensityType as IntensityType) ? (s.intensityType as IntensityType) : "none",
    intensityValue: typeof s.intensityValue === "number" && Number.isFinite(s.intensityValue) ? s.intensityValue : null,
  };
}

/**
 * Saved days are checked on the way in. A day written by an older build — or by
 * a migration — must not be able to crash a render on a field that moved.
 */
function normalizeDay(raw: unknown): DayLog {
  const d = (isObject(raw) ? raw : {}) as Partial<DayLog>;
  const readiness = { ...emptyReadiness(), ...(isObject(d.readiness) ? d.readiness : {}) } as Readiness;
  for (const key of READINESS_KEYS) readiness[key] = numberOr(readiness[key], 0);

  return {
    sets: Array.isArray(d.sets) ? d.sets.map(normalizeSet).filter((s): s is SetEntry => s !== null) : [],
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

function normalizeDays(raw: unknown): DayMap {
  const out: DayMap = {};
  if (!isObject(raw)) return out;
  for (const [key, value] of Object.entries(raw)) out[key] = normalizeDay(value);
  return out;
}

export function useDays() {
  const [days, setDays] = useLocalStorage<DayMap>("ironlog.days", {}, normalizeDays);

  const getDay = useCallback((key: string): DayLog => days[key] ?? emptyDay(), [days]);

  const updateDay = useCallback(
    (key: string, patch: (day: DayLog) => DayLog) => {
      setDays((prev) => ({ ...prev, [key]: patch(prev[key] ?? emptyDay()) }));
    },
    [setDays],
  );

  return { days, getDay, updateDay };
}
