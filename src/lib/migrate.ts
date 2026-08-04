import { DEFAULT_EXERCISES } from "../data/exercises";
import { emptyReadiness, READINESS_KEYS } from "./types";
import type { DayLog, Exercise, IntensityType, SetEntry, Stance, Unit } from "./types";
import type { FoodDay, FoodState } from "./food";
import { emptyGoals } from "./food";
import { roundKg, toKg, uid } from "./format";

/**
 * One-time import of data written by the original single-file build.
 *
 * The two builds store different shapes under mostly different keys. This maps
 * the old onto the new and writes the result once, guarded by a marker so it can
 * never run twice and double-import a day. Legacy keys are left untouched — if
 * this gets something wrong, the original data is still there to retry from.
 */

const MARKER = "ironlog.migrated.v1";

/** Legacy shapes, as they actually appear in storage. */
interface LegacyEntry {
  id?: string;
  groupId?: string;
  exerciseName?: string;
  stance?: string | null;
  weight?: number | null;
  reps?: number | null;
  unit?: string;
  intensityType?: string;
  intensityValue?: number | null;
  straps?: boolean;
  beltless?: boolean;
  kneeGear?: string | null;
}

interface LegacyDay {
  entries?: LegacyEntry[];
  readinessOn?: boolean;
  readiness?: Record<string, number>;
  notesOn?: boolean;
  notes?: string;
  rating?: number;
  start?: string;
  end?: string;
  manualDuration?: string | number;
}

interface LegacyMaxes {
  squat?: number | null;
  bench?: number | null;
  deadlift?: number | null;
  unit?: string;
}

interface LegacyFoodDay {
  entries?: unknown[];
  water?: number;
  monster?: number;
  bw?: number | null;
}

export interface MigrationReport {
  ran: boolean;
  reason?: string;
  days: number;
  sets: number;
  unmatchedExercises: string[];
  customExercises: number;
  foodDays: number;
  maxes: boolean;
}

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function asUnit(raw: unknown): Unit {
  return raw === "lb" ? "lb" : "kg";
}

function mapIntensity(raw: unknown): IntensityType {
  if (raw === "RPE") return "rpe";
  if (raw === "%") return "pct";
  return "none";
}

/**
 * Old entries name their exercise; new ones reference an id. This resolves by
 * name against the built-ins first, then anything the user had added.
 */
function buildNameIndex(customs: Exercise[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const e of DEFAULT_EXERCISES) index.set(e.name.toLowerCase(), e.id);
  for (const e of customs) index.set(e.name.toLowerCase(), e.id);
  return index;
}

function migrateDay(legacy: LegacyDay, names: Map<string, string>, unmatched: Set<string>): DayLog {
  const readiness = emptyReadiness();
  for (const key of READINESS_KEYS) {
    const v = legacy.readiness?.[key];
    if (typeof v === "number" && Number.isFinite(v)) readiness[key] = v;
  }

  const sets: SetEntry[] = [];
  for (const e of legacy.entries ?? []) {
    const name = (e.exerciseName ?? "").trim();
    if (name === "") continue;

    const exerciseId = names.get(name.toLowerCase());
    if (!exerciseId) {
      unmatched.add(name);
      continue;
    }

    const weight = typeof e.weight === "number" ? e.weight : null;
    const reps = typeof e.reps === "number" ? e.reps : null;
    if (weight === null || reps === null) continue;

    const stance: Stance | undefined =
      e.stance === "sumo" ? "sumo" : e.stance === "conventional" ? "conventional" : undefined;

    sets.push({
      id: e.id ?? uid(),
      groupId: e.groupId ?? uid(),
      exerciseId,
      // Legacy weights were stored in whatever unit the set was logged in.
      weight: roundKg(toKg(weight, asUnit(e.unit))),
      reps,
      ...(stance ? { stance } : {}),
      intensityType: mapIntensity(e.intensityType),
      intensityValue:
        typeof e.intensityValue === "number" && Number.isFinite(e.intensityValue)
          ? e.intensityValue
          : null,
      ...(e.beltless === true ? { beltless: true } : {}),
      ...(e.straps === true ? { straps: true } : {}),
      ...(typeof e.kneeGear === "string" ? { kneeGear: e.kneeGear } : {}),
    });
  }

  const manual = Number(legacy.manualDuration);
  return {
    sets,
    readinessOn: legacy.readinessOn === true,
    readiness,
    notesOn: legacy.notesOn === true,
    notes: typeof legacy.notes === "string" ? legacy.notes : "",
    sessionStart: typeof legacy.start === "string" ? legacy.start : "",
    sessionEnd: typeof legacy.end === "string" ? legacy.end : "",
    manualDurationMin: Number.isFinite(manual) && manual > 0 ? manual : null,
    rating: typeof legacy.rating === "number" && Number.isFinite(legacy.rating) ? legacy.rating : 0,
  };
}

/** True when there is legacy data present and it has not been imported yet. */
export function migrationAvailable(): boolean {
  if (window.localStorage.getItem(MARKER) !== null) return false;
  return (
    window.localStorage.getItem("ironlog.days") !== null ||
    window.localStorage.getItem("macroJournal.v1") !== null
  );
}

export function runMigration(): MigrationReport {
  const report: MigrationReport = {
    ran: false,
    days: 0,
    sets: 0,
    unmatchedExercises: [],
    customExercises: 0,
    foodDays: 0,
    maxes: false,
  };

  if (window.localStorage.getItem(MARKER) !== null) {
    report.reason = "already imported";
    return report;
  }

  // Custom exercises first — day entries resolve names against them.
  const legacyCustom = read<Record<string, unknown>[]>("ironlog.custom") ?? [];
  const customs: Exercise[] = legacyCustom
    .filter((c) => typeof c?.name === "string")
    .map((c) => ({
      id: typeof c.id === "string" ? c.id : "cx-" + slugOf(String(c.name)),
      name: String(c.name),
      group: typeof c.group === "string" ? c.group : "Other",
      isCustom: true,
      hasStance: c.hasStance === true,
      belt: c.belt === true,
      straps: c.straps === true,
      kneeGear: c.kneeGear === true,
      timed: c.timed === true,
    }));

  if (customs.length > 0) {
    write("ironlog.custom", customs);
    report.customExercises = customs.length;
  }

  const names = buildNameIndex(customs);
  const unmatched = new Set<string>();

  // Days. The legacy shape is only recognisable by its `entries` array.
  const legacyDays = read<Record<string, LegacyDay>>("ironlog.days");
  if (legacyDays && typeof legacyDays === "object") {
    const looksLegacy = Object.values(legacyDays).some((d) => Array.isArray(d?.entries));
    if (looksLegacy) {
      const migrated: Record<string, DayLog> = {};
      for (const [key, value] of Object.entries(legacyDays)) {
        const day = migrateDay(value ?? {}, names, unmatched);
        migrated[key] = day;
        report.days++;
        report.sets += day.sets.length;
      }
      write("ironlog.days", migrated);
    } else {
      report.reason = "days already in the new shape";
    }
  }

  // Maxes were stored in the display unit, with the unit alongside.
  const legacyMaxes = read<LegacyMaxes>("ironlog.maxes");
  if (legacyMaxes && typeof legacyMaxes.unit === "string") {
    const u = asUnit(legacyMaxes.unit);
    const conv = (v: number | null | undefined) =>
      typeof v === "number" && Number.isFinite(v) && v > 0 ? roundKg(toKg(v, u)) : null;

    write("ironlog.maxes", {
      squat: conv(legacyMaxes.squat),
      bench: conv(legacyMaxes.bench),
      deadlift: conv(legacyMaxes.deadlift),
    });
    report.maxes = true;
  }

  // Food journal moves key and renames its can counter.
  const legacyFood = read<{
    foods?: unknown[];
    days?: Record<string, LegacyFoodDay>;
    goal?: Record<string, unknown>;
    removedFoods?: unknown[];
  }>("macroJournal.v1");

  if (legacyFood && window.localStorage.getItem("ironlog.food.v1") === null) {
    const days: Record<string, FoodDay> = {};
    for (const [key, value] of Object.entries(legacyFood.days ?? {})) {
      days[key] = {
        entries: Array.isArray(value?.entries) ? (value.entries as FoodDay["entries"]) : [],
        water: typeof value?.water === "number" ? value.water : 0,
        bw: typeof value?.bw === "number" ? value.bw : null,
        cans: typeof value?.monster === "number" ? value.monster : 0,
      };
      report.foodDays++;
    }

    const goal = { ...emptyGoals() };
    for (const key of Object.keys(goal) as (keyof typeof goal)[]) {
      const v = legacyFood.goal?.[key];
      goal[key] = typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
    }

    const state: FoodState = {
      foods: Array.isArray(legacyFood.foods) ? (legacyFood.foods as FoodState["foods"]) : [],
      days,
      goal,
      removedFoods: Array.isArray(legacyFood.removedFoods)
        ? legacyFood.removedFoods.filter((x): x is string => typeof x === "string")
        : [],
    };
    write("ironlog.food.v1", state);
  }

  report.unmatchedExercises = [...unmatched].sort();
  report.ran = true;
  window.localStorage.setItem(MARKER, new Date().toISOString());
  return report;
}
