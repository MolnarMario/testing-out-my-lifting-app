import { DEFAULT_EXERCISES } from "../data/exercises.ts";
import { DEFAULT_FOODS } from "../data/foods.ts";
import { emptyReadiness, READINESS_KEYS } from "./types.ts";
import type { DayLog, Exercise, IntensityType, SetEntry, Stance, Unit } from "./types.ts";
import type { Food, FoodDay, FoodEntry, FoodState, QtyUnit } from "./food.ts";
import { emptyGoals } from "./food.ts";
import { roundKg, slugify, toKg, uid } from "./format.ts";

/**
 * One-time import of data written by the original single-file build.
 *
 * The two builds store different shapes under partly the same keys. This maps
 * the old onto the new and writes the result once, guarded by a marker so it can
 * never run twice and double-import a day.
 *
 * Three of the keys (ironlog.days, ironlog.custom, ironlog.maxes) are shared, so
 * importing overwrites them. Their raw contents are copied to BACKUP first, under
 * a name outside the "ironlog." prefix so that "Clear saved data" in the error
 * screen leaves it alone. The old food journal lives under its own key and is
 * never touched.
 */

const MARKER = "ironlog.migrated.v1";
export const BACKUP = "ironlog-legacy-backup.v1";

/** The keys an import overwrites, and so the ones the backup has to hold. */
const OVERWRITTEN = ["ironlog.days", "ironlog.custom", "ironlog.maxes"] as const;

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
  timed?: boolean;
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

/** What the old build kept per day beside the food itself. Bodyweight is in kg. */
interface LegacyByDay {
  water?: number;
  monster?: number;
  bw?: number | null;
  bf?: number | null;
}

/**
 * The old food journal. A day is a bare array of entries; water, cans and
 * bodyweight live separately in extra.byDay, and the water goal in extra.water.
 * Older copies of this importer also accepted a day object with its own
 * entries/water/monster/bw, which is still read as a fallback.
 */
interface LegacyFood {
  foods?: unknown[];
  days?: Record<string, unknown>;
  goal?: Record<string, unknown>;
  removedFoods?: unknown[];
  foodOv?: Record<string, Record<string, unknown>>;
  extra?: {
    byDay?: Record<string, LegacyByDay>;
    water?: number;
    monKcal?: number | null;
    monCarbs?: number | null;
  };
}

export interface MigrationReport {
  ran: boolean;
  reason?: string;
  days: number;
  sets: number;
  /** Exercise names with no match in the library, added as custom exercises so their sets survive. */
  createdExercises: string[];
  /** Sets with no rep count, which cannot be represented and were left in the backup. */
  skippedSets: number;
  customExercises: number;
  foodDays: number;
  foodEntries: number;
  maxes: boolean;
  /** Things the new build has nowhere to put. They stay in the backup or the old food key. */
  leftBehind: string[];
}

function emptyReport(): MigrationReport {
  return {
    ran: false,
    days: 0,
    sets: 0,
    createdExercises: [],
    skippedSets: 0,
    customExercises: 0,
    foodDays: 0,
    foodEntries: 0,
    maxes: false,
    leftBehind: [],
  };
}

/** Storage can refuse even a read (blocked cookies, some private modes). */
function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function read<T>(key: string): T | null {
  const raw = readRaw(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function asUnit(raw: unknown): Unit {
  return raw === "lb" ? "lb" : "kg";
}

function mapIntensity(raw: unknown): IntensityType {
  if (raw === "RPE") return "rpe";
  if (raw === "%") return "pct";
  return "none";
}

/** A legacy day is the one with an `entries` array; a new one has `sets`. */
function isLegacyDay(day: unknown): day is LegacyDay {
  return isObject(day) && Array.isArray(day.entries) && !Array.isArray(day.sets);
}

function hasLegacyDays(days: unknown): boolean {
  return isObject(days) && Object.values(days).some(isLegacyDay);
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

/** A custom-exercise id no other exercise is using. */
function freeId(name: string, taken: Set<string>): string {
  const slug = slugify(name);
  let id = "cx-" + (slug === "" ? uid() : slug);
  while (taken.has(id)) id = `cx-${slug}-${uid().slice(0, 4)}`;
  taken.add(id);
  return id;
}

interface DayContext {
  names: Map<string, string>;
  customs: Exercise[];
  taken: Set<string>;
  created: string[];
  report: MigrationReport;
}

/**
 * An exercise name nothing in the library matches. Dropping its sets would lose
 * them for good, since the day they sit in is about to be overwritten, so the
 * name becomes a custom exercise instead.
 */
function resolveExercise(name: string, entry: LegacyEntry, ctx: DayContext): string {
  const known = ctx.names.get(name.toLowerCase());
  if (known) return known;

  const id = freeId(name, ctx.taken);
  ctx.customs.push({ id, name, group: "Other", isCustom: true, ...(entry.timed === true ? { timed: true } : {}) });
  ctx.names.set(name.toLowerCase(), id);
  ctx.created.push(name);
  return id;
}

function migrateDay(legacy: LegacyDay, ctx: DayContext): DayLog {
  const readiness = emptyReadiness();
  for (const key of READINESS_KEYS) {
    const v = legacy.readiness?.[key];
    if (finite(v)) readiness[key] = v;
  }

  const sets: SetEntry[] = [];
  for (const e of legacy.entries ?? []) {
    if (!isObject(e)) continue;
    const name = typeof e.exerciseName === "string" ? e.exerciseName.trim() : "";
    if (name === "") {
      ctx.report.skippedSets++;
      continue;
    }

    // The old form saved an empty weight box as null; that is bodyweight work.
    const weight = finite(e.weight) ? e.weight : 0;
    if (!finite(e.reps) || e.reps <= 0) {
      ctx.report.skippedSets++;
      continue;
    }

    const stance: Stance | undefined =
      e.stance === "sumo" ? "sumo" : e.stance === "conventional" ? "conventional" : undefined;

    sets.push({
      id: typeof e.id === "string" ? e.id : uid(),
      groupId: typeof e.groupId === "string" ? e.groupId : uid(),
      exerciseId: resolveExercise(name, e, ctx),
      // Legacy weights were stored in whatever unit the set was logged in.
      weight: roundKg(toKg(weight, asUnit(e.unit))),
      reps: e.reps,
      ...(stance ? { stance } : {}),
      intensityType: mapIntensity(e.intensityType),
      intensityValue: finite(e.intensityValue) ? e.intensityValue : null,
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
    rating: finite(legacy.rating) ? legacy.rating : 0,
  };
}

/**
 * A logged portion. The old build kept the typed unit only when it was oz or
 * fl oz, under `qu`; anything else was entered in g or ml.
 */
function migrateFoodEntry(raw: unknown): FoodEntry | null {
  if (!isObject(raw) || !finite(raw.qty)) return null;
  const type = raw.type === "liquid" ? "liquid" : "solid";
  const typed = raw.qu ?? raw.unit;
  const unit: QtyUnit =
    type === "liquid" ? (typed === "floz" ? "floz" : "ml") : typed === "oz" ? "oz" : "g";
  const macro = (v: unknown) => (finite(v) ? v : 0);

  return {
    id: typeof raw.id === "string" ? raw.id : uid(),
    foodId: typeof raw.foodId === "string" ? raw.foodId : "",
    name: typeof raw.name === "string" ? raw.name : "Food",
    type,
    qty: raw.qty,
    unit,
    kcal: macro(raw.kcal),
    fat: macro(raw.fat),
    carbs: macro(raw.carbs),
    fiber: macro(raw.fiber),
    protein: macro(raw.protein),
  };
}

function migrateFood(legacy: LegacyFood, report: MigrationReport): FoodState {
  const byDay = isObject(legacy.extra?.byDay) ? legacy.extra.byDay : {};
  const rawDays = isObject(legacy.days) ? legacy.days : {};
  const keys = [...new Set([...Object.keys(rawDays), ...Object.keys(byDay)])].sort();

  let bodyFat = 0;
  const days: Record<string, FoodDay> = {};
  for (const key of keys) {
    const value = rawDays[key];
    const dayObject = isObject(value) ? value : null;
    const rawEntries = Array.isArray(value) ? value : Array.isArray(dayObject?.entries) ? dayObject.entries : [];
    const extra: LegacyByDay = isObject(byDay[key]) ? byDay[key] : {};

    const entries = rawEntries.map(migrateFoodEntry).filter((e): e is FoodEntry => e !== null);
    const water = finite(extra.water) ? extra.water : finite(dayObject?.water) ? dayObject.water : 0;
    const cans = finite(extra.monster) ? extra.monster : finite(dayObject?.monster) ? dayObject.monster : 0;
    const bw = finite(extra.bw) && extra.bw > 0 ? extra.bw : finite(dayObject?.bw) ? dayObject.bw : null;
    if (finite(extra.bf) && extra.bf > 0) bodyFat++;

    if (entries.length === 0 && water <= 0 && cans <= 0 && bw === null) continue;
    days[key] = { entries, water: Math.max(0, water), bw, cans: Math.max(0, Math.round(cans)) };
    report.foodDays++;
    report.foodEntries += entries.length;
  }

  const goal = emptyGoals();
  for (const key of Object.keys(goal) as (keyof typeof goal)[]) {
    const v = legacy.goal?.[key];
    goal[key] = finite(v) && v > 0 ? v : null;
  }
  // The old build kept the water goal beside the other extras, not in goal.
  if (goal.water === null && finite(legacy.extra?.water) && legacy.extra.water > 0) {
    goal.water = legacy.extra.water;
  }

  const foods = (Array.isArray(legacy.foods) ? legacy.foods : []).filter(
    (f): f is Food => isObject(f) && typeof f.id === "string" && typeof f.name === "string",
  );
  const removedFoods = Array.isArray(legacy.removedFoods)
    ? legacy.removedFoods.filter((x): x is string => typeof x === "string")
    : [];

  // Edits to a built-in food. The new pantry has no overrides, so an edited
  // built-in becomes a custom food carrying the edits, and the original is hidden.
  const taken = new Set([...foods.map((f) => f.id), ...DEFAULT_FOODS.map((f) => f.id)]);
  for (const [id, override] of Object.entries(isObject(legacy.foodOv) ? legacy.foodOv : {})) {
    const builtin = DEFAULT_FOODS.find((f) => f.id === id);
    if (!builtin || !isObject(override) || removedFoods.includes(id)) continue;

    const merged: Food = { ...builtin };
    if (typeof override.name === "string" && override.name.trim() !== "") merged.name = override.name.trim();
    if (typeof override.cat === "string") merged.cat = override.cat;
    if (override.type === "solid" || override.type === "liquid") merged.type = override.type;
    for (const macro of ["kcal", "fat", "carbs", "fiber", "protein"] as const) {
      if (finite(override[macro]) && override[macro] >= 0) merged[macro] = override[macro];
    }

    let customId = "cf-" + (slugify(merged.name) || uid());
    while (taken.has(customId)) customId = `cf-${slugify(merged.name)}-${uid().slice(0, 4)}`;
    taken.add(customId);

    foods.push({ ...merged, id: customId });
    removedFoods.push(id);
  }

  if (bodyFat > 0) {
    report.leftBehind.push(`${bodyFat} body-fat ${bodyFat === 1 ? "reading" : "readings"}`);
  }
  // The old build counted a can as monKcal (default 10) and monCarbs (default
  // 2 g); the new one counts 10 kcal and no carbs. Only matters if cans came
  // across, and then even the defaults lose 2 g of carbs a can.
  const cansImported = Object.values(days).reduce((sum, d) => sum + d.cans, 0);
  const monKcal = legacy.extra?.monKcal;
  const monCarbs = legacy.extra?.monCarbs;
  const kcalPerCan = finite(monKcal) && monKcal > 0 ? monKcal : 10;
  const carbsPerCan = finite(monCarbs) && monCarbs >= 0 ? monCarbs : 2;
  if (cansImported > 0 && (carbsPerCan > 0 || kcalPerCan !== 10)) {
    report.leftBehind.push(
      `the old can settings (${kcalPerCan} kcal and ${carbsPerCan} g carbs a can; cans now count 10 kcal and no carbs)`,
    );
  }

  return { foods, days, goal, removedFoods };
}

/** True when there is legacy data present and it has not been imported yet. */
export function migrationAvailable(): boolean {
  if (readRaw(MARKER) !== null) return false;
  if (hasLegacyDays(read<unknown>("ironlog.days"))) return true;
  if (readRaw("macroJournal.v1") !== null && readRaw("ironlog.food.v1") === null) return true;
  const maxes = read<LegacyMaxes>("ironlog.maxes");
  if (isObject(maxes) && typeof maxes.unit === "string") return true;
  // Edits to built-in exercises are all some old installs have. The import
  // cannot carry them, but it is how the user finds out they stayed behind.
  const overrides = read<unknown>("ironlog.overrides");
  return isObject(overrides) && Object.keys(overrides).length > 0;
}

/** Copies the keys about to be overwritten, once. A later import never replaces the first backup. */
function backUp() {
  if (readRaw(BACKUP) !== null) return;
  const keys: Record<string, string> = {};
  // The exercise overrides are not overwritten, but nothing reads them any more
  // either, so they travel with the rest.
  for (const key of [...OVERWRITTEN, "ironlog.overrides"]) {
    const raw = readRaw(key);
    if (raw !== null) keys[key] = raw;
  }
  write(BACKUP, { savedAt: new Date().toISOString(), keys });
}

export function runMigration(): MigrationReport {
  const report = emptyReport();

  if (readRaw(MARKER) !== null) {
    report.reason = "already imported";
    return report;
  }

  // Everything is worked out before anything is written, so a failure part-way
  // through planning leaves storage exactly as it was.
  const legacyCustom = read<unknown>("ironlog.custom");
  const customs: Exercise[] = (Array.isArray(legacyCustom) ? legacyCustom : [])
    .filter((c): c is Record<string, unknown> => isObject(c) && typeof c.name === "string")
    .map((c) => ({
      id: typeof c.id === "string" ? c.id : "cx-" + slugify(String(c.name)),
      name: String(c.name),
      group: typeof c.group === "string" ? c.group : "Other",
      isCustom: true,
      hasStance: c.hasStance === true,
      belt: c.belt === true,
      straps: c.straps === true,
      kneeGear: c.kneeGear === true,
      timed: c.timed === true,
    }));
  const customsBefore = customs.length;

  const ctx: DayContext = {
    names: buildNameIndex(customs),
    customs,
    taken: new Set([...DEFAULT_EXERCISES.map((e) => e.id), ...customs.map((e) => e.id)]),
    created: [],
    report,
  };

  // Days, one at a time by shape. A day logged in the new build while the
  // import was put off already has `sets` and passes through untouched.
  const legacyDays = read<unknown>("ironlog.days");
  let days: Record<string, unknown> | null = null;
  if (hasLegacyDays(legacyDays) && isObject(legacyDays)) {
    days = {};
    for (const [key, value] of Object.entries(legacyDays)) {
      if (isLegacyDay(value)) {
        const day = migrateDay(value, ctx);
        days[key] = day;
        report.days++;
        report.sets += day.sets.length;
      } else {
        days[key] = value;
      }
    }
  }

  // Maxes were stored in the display unit, with the unit alongside.
  const legacyMaxes = read<LegacyMaxes>("ironlog.maxes");
  let maxes: Record<string, number | null> | null = null;
  if (isObject(legacyMaxes) && typeof legacyMaxes.unit === "string") {
    const u = asUnit(legacyMaxes.unit);
    const conv = (v: unknown) => (finite(v) && v > 0 ? roundKg(toKg(v, u)) : null);
    maxes = { squat: conv(legacyMaxes.squat), bench: conv(legacyMaxes.bench), deadlift: conv(legacyMaxes.deadlift) };
    report.maxes = true;
  }

  const legacyFood = read<LegacyFood>("macroJournal.v1");
  const food = isObject(legacyFood) && readRaw("ironlog.food.v1") === null ? migrateFood(legacyFood, report) : null;

  const overrides = read<unknown>("ironlog.overrides");
  if (isObject(overrides) && Object.keys(overrides).length > 0) {
    const n = Object.keys(overrides).length;
    report.leftBehind.push(`edits to ${n} built-in ${n === 1 ? "exercise" : "exercises"}`);
  }

  const writes: [string, unknown][] = [];
  if (customs.length > 0) writes.push(["ironlog.custom", customs]);
  if (days !== null) writes.push(["ironlog.days", days]);
  if (maxes !== null) writes.push(["ironlog.maxes", maxes]);
  if (food !== null) writes.push(["ironlog.food.v1", food]);

  // What each key held before, so a failure part-way through can put it back.
  // A half-applied import is worse than none: the app's in-memory stores still
  // hold the old data and would write it over whatever half did land.
  const before = new Map(writes.map(([key]) => [key, readRaw(key)]));

  try {
    backUp();
    for (const [key, value] of writes) write(key, value);
    window.localStorage.setItem(MARKER, new Date().toISOString());
  } catch {
    for (const [key, raw] of before) {
      try {
        if (raw === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, raw);
      } catch {
        // Restoring the smaller original rarely fails; if it does, the backup
        // still holds it.
      }
    }
    return { ...emptyReport(), reason: "storage refused the import" };
  }

  report.customExercises = customsBefore;
  report.createdExercises = [...ctx.created].sort();
  report.ran = true;
  return report;
}
