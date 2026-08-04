/**
 * Every number the Progress and Trends panes draw, derived here as pure
 * functions so the charts stay dumb and the maths stays testable.
 *
 * Weights are canonical kg throughout — exactly as they are stored. Conversion
 * to the display unit happens at render, never here, so flipping kg/lb can
 * never walk a stored value.
 */

import { estimate1RM } from "./format.ts";
import { totalsFor } from "./food.ts";
import type { FoodDay, FoodGoals } from "./food.ts";
import type { DayLog, Exercise, SetEntry } from "./types.ts";
import { READINESS_KEYS } from "./types.ts";
import { CAN_KCAL } from "./food.ts";
import { eachDay, eachWeek, weekStart } from "./chart.ts";
import type { Datum } from "./chart.ts";

export type DayMap = Record<string, DayLog>;
export type FoodDayMap = Record<string, FoodDay>;

export interface Range {
  from: string;
  to: string;
}

/** A week bucket, keyed by its Monday. */
export interface WeekBucket<T> {
  week: string;
  value: T;
}

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

/** Session duration in minutes, manual entry winning over the clock times. */
function sessionMinutes(day: DayLog): number | null {
  if (day.manualDurationMin !== null) return day.manualDurationMin;
  const m = /^(\d{1,2}):(\d{2})$/;
  const a = m.exec(day.sessionStart);
  const b = m.exec(day.sessionEnd);
  if (!a || !b) return null;
  const start = Number(a[1]) * 60 + Number(a[2]);
  const end = Number(b[1]) * 60 + Number(b[2]);
  return end >= start ? end - start : end + 24 * 60 - start;
}

/** Volume in kg for a list of sets. Bodyweight work at 0 kg contributes 0. */
export function setVolume(sets: SetEntry[]): number {
  return sum(sets.map((s) => s.weight * s.reps));
}

/**
 * The earliest and latest day with anything logged, across both modules. Used
 * to resolve the "All" range without guessing.
 */
export function dataBounds(days: DayMap, foodDays: FoodDayMap): Range | null {
  const keys = [
    ...Object.entries(days)
      .filter(([, d]) => d.sets.length > 0)
      .map(([k]) => k),
    ...Object.entries(foodDays)
      .filter(([, d]) => d.entries.length > 0 || d.bw !== null || d.water > 0 || d.cans > 0)
      .map(([k]) => k),
  ].sort();

  if (keys.length === 0) return null;
  return { from: keys[0], to: keys[keys.length - 1] };
}

// --- training ----------------------------------------------------------------

export interface E1rmPoint {
  key: string;
  /** Best estimated 1RM of the day, kg. */
  e1rm: number;
  /** The set that produced it. */
  weight: number;
  reps: number;
  /** This day beat every day before it in the series. */
  pr: boolean;
}

/**
 * One point per session, taking the set with the highest Epley estimate rather
 * than the heaviest weight — a hard triple can out-rank a lighter single, and
 * that is the point of the estimate.
 *
 * Timed holds carry no meaningful 1RM and are the caller's job to exclude.
 */
export function e1rmSeries(days: DayMap, exerciseId: string, range: Range): E1rmPoint[] {
  const out: E1rmPoint[] = [];
  let best = 0;

  for (const key of eachDay(range.from, range.to)) {
    const sets = days[key]?.sets.filter((s) => s.exerciseId === exerciseId && s.reps > 0) ?? [];
    if (sets.length === 0) continue;

    let top = sets[0];
    let topEst = estimate1RM(top.weight, top.reps);
    for (const s of sets.slice(1)) {
      const est = estimate1RM(s.weight, s.reps);
      if (est > topEst) {
        top = s;
        topEst = est;
      }
    }
    if (topEst <= 0) continue;

    const pr = topEst > best;
    if (pr) best = topEst;
    out.push({ key, e1rm: topEst, weight: top.weight, reps: top.reps, pr });
  }

  return out;
}

/**
 * Weekly tonnage in kg. Every week in the range appears, including the empty
 * ones — a gap in training is information, not a missing bar.
 */
export function weeklyVolume(
  days: DayMap,
  range: Range,
  filter?: (set: SetEntry) => boolean,
): WeekBucket<number>[] {
  const totals = new Map<string, number>();
  for (const week of eachWeek(range.from, range.to)) totals.set(week, 0);

  for (const key of eachDay(range.from, range.to)) {
    const sets = days[key]?.sets ?? [];
    if (sets.length === 0) continue;
    const week = weekStart(key);
    if (!totals.has(week)) continue;
    const matching = filter ? sets.filter(filter) : sets;
    totals.set(week, (totals.get(week) ?? 0) + setVolume(matching));
  }

  return [...totals].map(([week, value]) => ({ week, value }));
}

/**
 * Hard sets per muscle group per week — the metric that actually drives
 * hypertrophy programming, and the one Hevy and RP put front and centre.
 */
export function weeklySetsByGroup(
  days: DayMap,
  library: Exercise[],
  range: Range,
  groups: readonly string[],
): WeekBucket<Record<string, number>>[] {
  const groupOf = new Map(library.map((e) => [e.id, e.group]));
  const blank = () => Object.fromEntries(groups.map((g) => [g, 0])) as Record<string, number>;

  const weeks = new Map<string, Record<string, number>>();
  for (const week of eachWeek(range.from, range.to)) weeks.set(week, blank());

  for (const key of eachDay(range.from, range.to)) {
    const sets = days[key]?.sets ?? [];
    if (sets.length === 0) continue;
    const bucket = weeks.get(weekStart(key));
    if (!bucket) continue;
    for (const s of sets) {
      const group: string = groupOf.get(s.exerciseId) ?? "Other";
      // An exercise whose group was renamed or deleted still counts, under Other.
      const slot: string = group in bucket ? group : "Other";
      if (slot in bucket) bucket[slot]++;
    }
  }

  return [...weeks].map(([week, value]) => ({ week, value }));
}

export interface HeatCell {
  key: string;
  sets: number;
  /** Position in the grid — column is the week, row is Mon..Sun. */
  week: number;
  weekday: number;
}

/** A GitHub-style grid of training days: one column per week, Mon at the top. */
export function sessionHeatmap(days: DayMap, range: Range): { cells: HeatCell[]; weeks: string[] } {
  const weeks = eachWeek(range.from, range.to);
  const index = new Map(weeks.map((w, i) => [w, i]));
  const cells: HeatCell[] = [];

  for (const key of eachDay(weeks[0] ?? range.from, range.to)) {
    const week = index.get(weekStart(key));
    if (week === undefined) continue;
    const [y, m, d] = key.split("-").map(Number);
    cells.push({
      key,
      sets: days[key]?.sets.length ?? 0,
      week,
      weekday: (new Date(y, m - 1, d).getDay() + 6) % 7,
    });
  }

  return { cells, weeks };
}

export interface TrainingKpis {
  sessions: number;
  sets: number;
  /** kg. */
  volume: number;
  /** Minutes, averaged over the sessions that recorded a time. */
  avgMinutes: number | null;
  /** 0..5, averaged over the sessions that were rated. */
  avgRating: number | null;
  /** 0..5, averaged over the days readiness was filled in. */
  avgReadiness: number | null;
  /** Sessions per week over the range, for the "is this sustainable" read. */
  perWeek: number;
  /** Longest run of consecutive weeks with at least one session. */
  bestWeekStreak: number;
}

export function trainingKpis(days: DayMap, range: Range): TrainingKpis {
  let sessions = 0;
  let sets = 0;
  let volume = 0;
  const minutes: number[] = [];
  const ratings: number[] = [];
  const readiness: number[] = [];

  for (const key of eachDay(range.from, range.to)) {
    const day = days[key];
    if (!day || day.sets.length === 0) continue;
    sessions++;
    sets += day.sets.length;
    volume += setVolume(day.sets);

    const mins = sessionMinutes(day);
    if (mins !== null && mins > 0) minutes.push(mins);
    if (day.rating > 0) ratings.push(day.rating);

    if (day.readinessOn) {
      const scores = READINESS_KEYS.map((k) => day.readiness[k]).filter((v) => v > 0);
      if (scores.length > 0) readiness.push(sum(scores) / scores.length);
    }
  }

  const weeks = eachWeek(range.from, range.to);
  const trained = new Set<string>();
  for (const key of eachDay(range.from, range.to)) {
    if ((days[key]?.sets.length ?? 0) > 0) trained.add(weekStart(key));
  }

  let streak = 0;
  let best = 0;
  for (const week of weeks) {
    streak = trained.has(week) ? streak + 1 : 0;
    if (streak > best) best = streak;
  }

  const mean = (ns: number[]) => (ns.length === 0 ? null : sum(ns) / ns.length);

  return {
    sessions,
    sets,
    volume,
    avgMinutes: mean(minutes),
    avgRating: mean(ratings),
    avgReadiness: mean(readiness),
    perWeek: weeks.length === 0 ? 0 : sessions / weeks.length,
    bestWeekStreak: best,
  };
}

// --- nutrition ---------------------------------------------------------------

/** Cans are logged as taps, but their calories are still calories. */
function dayKcal(day: FoodDay): number {
  return totalsFor(day.entries).kcal + day.cans * CAN_KCAL;
}

/** True once a day has anything worth charting on the calorie axis. */
function ateSomething(day: FoodDay | undefined): day is FoodDay {
  return !!day && (day.entries.length > 0 || day.cans > 0);
}

/**
 * Daily calories across the range. Days with nothing logged come back as null
 * rather than zero: an unlogged day is missing data, and drawing it as a zero
 * would libel the user's adherence.
 */
export function kcalSeries(foodDays: FoodDayMap, range: Range): Datum[] {
  return eachDay(range.from, range.to).map((key) => {
    const day = foodDays[key];
    return { key, value: ateSomething(day) ? dayKcal(day) : null };
  });
}

export type MacroKey = "protein" | "carbs" | "fat" | "fiber";

/** Daily grams of one macro, null on unlogged days. */
export function macroSeries(foodDays: FoodDayMap, range: Range, macro: MacroKey): Datum[] {
  return eachDay(range.from, range.to).map((key) => {
    const day = foodDays[key];
    return { key, value: ateSomething(day) ? totalsFor(day.entries)[macro] : null };
  });
}

/** Daily bodyweight in kg, null on days without a weigh-in. */
export function bodyweightSeries(foodDays: FoodDayMap, range: Range): Datum[] {
  return eachDay(range.from, range.to).map((key) => ({ key, value: foodDays[key]?.bw ?? null }));
}

/** Daily water in ml, null on unlogged days. */
export function waterSeries(foodDays: FoodDayMap, range: Range): Datum[] {
  return eachDay(range.from, range.to).map((key) => {
    const day = foodDays[key];
    return { key, value: day && day.water > 0 ? day.water : null };
  });
}

/**
 * Protein per kg of bodyweight — the number that actually matters, and the one
 * the Today pane already shows for a single day. Needs both a weigh-in and a
 * food log, so it is sparser than either series alone; the most recent weight
 * on or before the day carries forward, since nobody weighs in daily.
 */
export function proteinPerKgSeries(foodDays: FoodDayMap, range: Range): Datum[] {
  let carried: number | null = null;

  // Walk from the first weigh-in on or before the range so day one is not blank
  // just because the last weigh-in was a few days earlier.
  const earlier = Object.keys(foodDays)
    .filter((k) => k < range.from && foodDays[k].bw !== null)
    .sort();
  if (earlier.length > 0) carried = foodDays[earlier[earlier.length - 1]].bw;

  return eachDay(range.from, range.to).map((key) => {
    const day = foodDays[key];
    if (day?.bw != null) carried = day.bw;
    if (!ateSomething(day) || carried === null || carried <= 0) return { key, value: null };
    return { key, value: totalsFor(day.entries).protein / carried };
  });
}

export interface MacroShare {
  key: string;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
}

/**
 * Each logged day's macros as a share of that day's macro grams. Ordered
 * protein → fat → carbs → fiber, the order the stacked bar draws in.
 */
export function macroShareSeries(foodDays: FoodDayMap, range: Range): MacroShare[] {
  const out: MacroShare[] = [];

  for (const key of eachDay(range.from, range.to)) {
    const day = foodDays[key];
    if (!ateSomething(day)) continue;

    const t = totalsFor(day.entries);
    const total = t.protein + t.fat + t.carbs + t.fiber;
    if (total <= 0) continue;

    out.push({
      key,
      protein: t.protein / total,
      fat: t.fat / total,
      carbs: t.carbs / total,
      fiber: t.fiber / total,
    });
  }

  return out;
}

export interface MacroAverage {
  macro: MacroKey;
  /** Mean grams across the logged days in the range. */
  average: number;
  goal: number | null;
}

const MACRO_KEYS: MacroKey[] = ["protein", "carbs", "fat", "fiber"];

/** Mean daily grams per macro against the configured goal, for bullet bars. */
export function macroAverages(
  foodDays: FoodDayMap,
  goals: FoodGoals,
  range: Range,
): MacroAverage[] {
  const logged = eachDay(range.from, range.to)
    .map((key) => foodDays[key])
    .filter(ateSomething);

  return MACRO_KEYS.map((macro) => {
    const values = logged.map((d) => totalsFor(d.entries)[macro]);
    return {
      macro,
      average: values.length === 0 ? 0 : sum(values) / values.length,
      goal: goals[macro],
    };
  });
}

export interface NutritionKpis {
  /** Days in the range with any food logged. */
  daysLogged: number;
  daysInRange: number;
  avgKcal: number | null;
  avgProtein: number | null;
  avgWater: number | null;
  /** kg, most recent weigh-in in the range. */
  latestBw: number | null;
  /** kg change from the first to the last smoothed weight in the range. */
  bwChange: number | null;
  /** kg per week implied by that change. */
  bwPerWeek: number | null;
}

/**
 * Range summary. The bodyweight change is measured on the smoothed trend
 * rather than raw endpoints, so a salty Sunday cannot manufacture a "gain".
 */
export function nutritionKpis(
  foodDays: FoodDayMap,
  range: Range,
  trend: (number | null)[],
): NutritionKpis {
  const keys = eachDay(range.from, range.to);
  const logged = keys.map((k) => foodDays[k]).filter(ateSomething);

  const waters = keys.map((k) => foodDays[k]?.water ?? 0).filter((w) => w > 0);
  const weighIns = keys.map((k) => foodDays[k]?.bw).filter((b): b is number => b != null);

  const trendPoints = trend.filter((v): v is number => v !== null);
  const first = trendPoints[0] ?? null;
  const last = trendPoints[trendPoints.length - 1] ?? null;
  const change = first !== null && last !== null && trendPoints.length > 1 ? last - first : null;
  const weeks = Math.max(1, keys.length / 7);

  const mean = (ns: number[]) => (ns.length === 0 ? null : sum(ns) / ns.length);

  return {
    daysLogged: logged.length,
    daysInRange: keys.length,
    avgKcal: mean(logged.map(dayKcal)),
    avgProtein: mean(logged.map((d) => totalsFor(d.entries).protein)),
    avgWater: mean(waters),
    latestBw: weighIns.length > 0 ? weighIns[weighIns.length - 1] : null,
    bwChange: change,
    bwPerWeek: change === null ? null : change / weeks,
  };
}
