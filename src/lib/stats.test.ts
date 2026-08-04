import {
  alphaForHalfLife,
  barPath,
  daysBetween,
  eachWeek,
  ema,
  labelIndices,
  linePath,
  niceScale,
  rollingMean,
  scale,
  weekStart,
} from "./chart.ts";
import {
  bodyweightSeries,
  dataBounds,
  e1rmSeries,
  kcalSeries,
  macroAverages,
  macroShareSeries,
  nutritionKpis,
  personalRecords,
  proteinPerKgSeries,
  setVolume,
  trainingKpis,
  weeklySetsByGroup,
  weeklyVolume,
} from "./stats.ts";
import type { DayMap, FoodDayMap } from "./stats.ts";
import { emptyDay } from "./types.ts";
import type { SetEntry } from "./types.ts";
import { emptyFoodDay, emptyGoals } from "./food.ts";
import type { FoodEntry } from "./food.ts";

let fails = 0;

function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    fails++;
    console.log(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  } else {
    console.log(`ok   ${name}  -> ${JSON.stringify(got)}`);
  }
}

const r2 = (n: number) => Number(n.toFixed(2));

const set = (over: Partial<SetEntry>): SetEntry => ({
  id: "s",
  groupId: "g",
  exerciseId: "squat",
  weight: 100,
  reps: 5,
  intensityType: "none",
  intensityValue: null,
  ...over,
});

const day = (sets: SetEntry[], over: Partial<ReturnType<typeof emptyDay>> = {}) => ({
  ...emptyDay(),
  sets,
  ...over,
});

const entry = (over: Partial<FoodEntry>): FoodEntry => ({
  id: "e",
  foodId: "f",
  name: "Food",
  type: "solid",
  qty: 100,
  unit: "g",
  kcal: 0,
  fat: 0,
  carbs: 0,
  fiber: 0,
  protein: 0,
  ...over,
});

// 2026-01-05 is a Monday, so these three days span two calendar weeks.
const DAYS: DayMap = {
  "2026-01-05": day([
    set({ id: "a", weight: 100, reps: 5 }),
    set({ id: "b", weight: 110, reps: 1 }),
  ]),
  "2026-01-07": day(
    [set({ id: "c", weight: 105, reps: 5 }), set({ id: "d", exerciseId: "ghost", weight: 40, reps: 10 })],
    { sessionStart: "17:00", sessionEnd: "18:30", rating: 4 },
  ),
  "2026-01-12": day([set({ id: "e", weight: 100, reps: 5 })]),
};

const RANGE = { from: "2026-01-05", to: "2026-01-25" };

// --- date bucketing ----------------------------------------------------------

check("weekStart snaps to Monday", weekStart("2026-01-07"), "2026-01-05");
check("weekStart of a Monday is itself", weekStart("2026-01-05"), "2026-01-05");
check("weekStart of a Sunday looks back", weekStart("2026-01-11"), "2026-01-05");
// 2027-01-01 is a Friday: its week began in the previous year.
check("weekStart crosses the year", weekStart("2027-01-01"), "2026-12-28");
check("eachWeek crosses the year", eachWeek("2026-12-28", "2027-01-04"), [
  "2026-12-28",
  "2027-01-04",
]);
check("daysBetween counts whole days", daysBetween("2026-01-05", "2026-01-12"), 7);

// --- geometry ----------------------------------------------------------------

check("niceScale rounds to the nearest 1/2/5", niceScale(0, 100, 4), {
  ticks: [0, 20, 40, 60, 80, 100],
  min: 0,
  max: 100,
});
check("niceScale pads a flat series", niceScale(80, 80, 4).min < 80, true);
check("niceScale survives an empty domain", niceScale(NaN, NaN), { ticks: [0, 1], min: 0, max: 1 });

check("linePath moves then lines", linePath([{ x: 0, y: 10 }, { x: 5, y: 0 }]), "M0 10 L5 0");
check("linePath of nothing is empty", linePath([]), "");
check(
  "barPath rounds only the top",
  barPath(0, 10, 8, 20, 4),
  "M0 30 L0 14 Q0 10 4 10 L4 10 Q8 10 8 14 L8 30 Z",
);
check("barPath of zero height draws nothing", barPath(0, 10, 8, 0), "");

check("labelIndices keeps them all when they fit", [...labelIndices(3, 6)], [0, 1, 2]);
check("labelIndices spreads and keeps the last", [...labelIndices(10, 3)], [0, 5, 9]);

// --- smoothing ---------------------------------------------------------------

const gappy = [
  { key: "1", value: null },
  { key: "2", value: 100 },
  { key: "3", value: 200 },
  { key: "4", value: null },
  { key: "5", value: 300 },
];

check("rollingMean skips unlogged days", rollingMean(gappy, 3), [null, 100, 150, 150, 250]);
check("ema holds the trend across a gap", ema([{ key: "1", value: 80 }, { key: "2", value: null }, { key: "3", value: 84 }], 0.5), [80, 80, 82]);
check("alphaForHalfLife of 7 days", r2(alphaForHalfLife(7) * 100), 9.43);

// --- training ----------------------------------------------------------------

check("setVolume multiplies weight by reps", setVolume([set({ weight: 100, reps: 5 })]), 500);

const e1rm = e1rmSeries(DAYS, "squat", RANGE);
check("e1rm has one point per session", e1rm.map((p) => p.key), [
  "2026-01-05",
  "2026-01-07",
  "2026-01-12",
]);
// 100x5 estimates 116.7, beating the heavier 110x1 single at 110.
check("e1rm picks the best estimate, not the heaviest bar", [e1rm[0].weight, e1rm[0].reps], [100, 5]);
check("e1rm values", e1rm.map((p) => r2(p.e1rm)), [116.67, 122.5, 116.67]);
check("e1rm flags only real PRs", e1rm.map((p) => p.pr), [true, true, false]);
check("e1rm ignores other exercises", e1rmSeries(DAYS, "ghost", RANGE).length, 1);

check("weeklyVolume buckets by Monday, empty weeks included", weeklyVolume(DAYS, RANGE), [
  { week: "2026-01-05", value: 100 * 5 + 110 * 1 + 105 * 5 + 40 * 10 },
  { week: "2026-01-12", value: 500 },
  { week: "2026-01-19", value: 0 },
]);
check(
  "weeklyVolume honours a filter",
  weeklyVolume(DAYS, RANGE, (s) => s.exerciseId === "squat")[0].value,
  100 * 5 + 110 * 1 + 105 * 5,
);

const LIBRARY = [{ id: "squat", name: "Squat", group: "Squat / Legs" }];
const GROUPS = ["Squat / Legs", "Other"] as const;

check("weeklySetsByGroup counts sets, unknown lifts fall to Other", weeklySetsByGroup(DAYS, LIBRARY, RANGE, GROUPS), [
  { week: "2026-01-05", value: { "Squat / Legs": 3, Other: 1 } },
  { week: "2026-01-12", value: { "Squat / Legs": 1, Other: 0 } },
  { week: "2026-01-19", value: { "Squat / Legs": 0, Other: 0 } },
]);

const kpis = trainingKpis(DAYS, RANGE);
check(
  "trainingKpis totals",
  [kpis.sessions, kpis.sets, kpis.volume, kpis.avgMinutes, kpis.avgRating],
  [3, 5, 100 * 5 + 110 + 105 * 5 + 400 + 500, 90, 4],
);
check("trainingKpis best streak stops at the empty week", kpis.bestWeekStreak, 2);
check("trainingKpis rate over three weeks", r2(kpis.perWeek), 1);
check("trainingKpis ignores an empty range", trainingKpis({}, RANGE).sessions, 0);

// --- personal records --------------------------------------------------------

const PR_DAYS: DayMap = {
  // Heaviest bar ever, but only a single — beaten on estimate by the triple below.
  "2026-01-05": day([set({ id: "p1", weight: 200, reps: 1 })]),
  "2026-01-07": day([set({ id: "p2", weight: 185, reps: 3 })]),
  // Matching the record later must not move the date.
  "2026-01-12": day([set({ id: "p3", weight: 185, reps: 3 })]),
  // A timed hold and a bodyweight set: neither has a meaningful 1RM.
  "2026-01-14": day([
    set({ id: "p4", exerciseId: "plank", weight: 0, reps: 1 }),
    set({ id: "p5", exerciseId: "pullup", weight: 0, reps: 12 }),
    set({ id: "p6", exerciseId: "bench", weight: 100, reps: 5 }),
  ]),
};

const PR_LIB = [
  { id: "squat", name: "Squat", group: "Squat / Legs" },
  { id: "bench", name: "Bench", group: "Bench / Press" },
  { id: "pullup", name: "Pull-Up", group: "Deadlift / Pull" },
  { id: "plank", name: "Plank", group: "Abs / Core", timed: true },
];

const prs = personalRecords(PR_DAYS, PR_LIB, "2026-01-13");

check("PRs are listed most recent first", prs.map((p) => p.exerciseId), ["bench", "squat"]);
// 185x3 estimates 203.5, beating the 200 kg single.
check("PR takes the best estimate, not the heaviest bar", [r2(prs[1].e1rm), prs[1].weight, prs[1].reps], [203.5, 185, 3]);
check("PR keeps the heaviest single alongside it", [prs[1].topWeight, prs[1].topWeightKey], [200, "2026-01-05"]);
check("matching a record does not move its date", prs[1].key, "2026-01-07");
check("only records set inside the range are flagged new", prs.map((p) => p.recent), [true, false]);
check("timed and bodyweight lifts are left out", prs.some((p) => p.exerciseId === "plank" || p.exerciseId === "pullup"), false);
check("no records without training", personalRecords({}, PR_LIB, "2026-01-01"), []);

// --- nutrition ---------------------------------------------------------------

const FOOD: FoodDayMap = {
  "2026-01-04": { ...emptyFoodDay(), bw: 80 },
  "2026-01-05": {
    ...emptyFoodDay(),
    entries: [entry({ kcal: 200, protein: 20, carbs: 60, fat: 20 })],
    water: 2000,
    cans: 1,
  },
  "2026-01-07": {
    ...emptyFoodDay(),
    entries: [entry({ qty: 200, kcal: 100, protein: 80 })],
    bw: 79,
  },
};

const FOOD_RANGE = { from: "2026-01-05", to: "2026-01-07" };

check("kcalSeries folds cans in and leaves gaps null", kcalSeries(FOOD, FOOD_RANGE), [
  { key: "2026-01-05", value: 210 },
  { key: "2026-01-06", value: null },
  { key: "2026-01-07", value: 200 },
]);
check("bodyweightSeries is null where there was no weigh-in", bodyweightSeries(FOOD, FOOD_RANGE), [
  { key: "2026-01-05", value: null },
  { key: "2026-01-06", value: null },
  { key: "2026-01-07", value: 79 },
]);

check("macroShareSeries drops unlogged days and sums to one", macroShareSeries(FOOD, FOOD_RANGE), [
  { key: "2026-01-05", protein: 0.2, fat: 0.2, carbs: 0.6, fiber: 0 },
  { key: "2026-01-07", protein: 1, fat: 0, carbs: 0, fiber: 0 },
]);

// The 4th's weigh-in carries into the 5th even though it is before the range.
check("proteinPerKg carries the last weight forward", proteinPerKgSeries(FOOD, FOOD_RANGE).map((d) => (d.value === null ? null : r2(d.value))), [
  0.25,
  null,
  r2(160 / 79),
]);

check("macroAverages averages the logged days only", macroAverages(FOOD, emptyGoals(), FOOD_RANGE).map((m) => [m.macro, r2(m.average)]), [
  ["protein", 90],
  ["carbs", 30],
  ["fat", 10],
  ["fiber", 0],
]);

const nk = nutritionKpis(FOOD, FOOD_RANGE, [null, null, 79]);
check("nutritionKpis counts only logged days", [nk.daysLogged, nk.daysInRange], [2, 3]);
check("nutritionKpis averages", [nk.avgKcal, nk.avgProtein, nk.avgWater], [205, 90, 2000]);
// One trend point is not a trend; the change stays null rather than reading zero.
check("nutritionKpis needs two trend points", [nk.bwChange, nk.bwPerWeek], [null, null]);

const nk2 = nutritionKpis(FOOD, FOOD_RANGE, [80, null, 79]);
check("nutritionKpis measures change on the trend", [nk2.bwChange, r2(nk2.bwPerWeek ?? 0)], [-1, -1]);

check("dataBounds spans both modules", dataBounds(DAYS, FOOD), {
  from: "2026-01-04",
  to: "2026-01-12",
});
check("dataBounds is null with nothing logged", dataBounds({}, {}), null);

// --- the coordinate pipeline -------------------------------------------------
// The charts compose niceScale -> scale -> path. A NaN anywhere in that chain
// reaches the DOM as an invalid attribute and silently blanks the plot, so the
// composition is checked here rather than left to be noticed on screen.

function plot(values: (number | null)[], width: number, height: number): string[] {
  const pad = { top: 14, right: 14, bottom: 22, left: 46 };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = Math.max(0, height - pad.top - pad.bottom);
  const real = values.filter((v): v is number => v !== null);
  const axis = niceScale(real.length === 0 ? 0 : Math.min(...real), real.length === 0 ? 1 : Math.max(...real), 4);

  const x = (i: number) =>
    values.length <= 1 ? pad.left + plotW / 2 : pad.left + (i / (values.length - 1)) * plotW;
  const y = (v: number) => scale(v, axis.min, axis.max, pad.top + plotH, pad.top);

  const points = values
    .map((v, i) => (v === null ? null : { x: x(i), y: y(v) }))
    .filter((p): p is { x: number; y: number } => p !== null);

  const step = values.length === 0 ? 0 : plotW / values.length;
  return [
    linePath(points),
    ...values.map((v, i) => (v === null ? "" : barPath(x(i) - step / 3, y(v), step * 0.66, pad.top + plotH - y(v)))),
    ...axis.ticks.map((t) => String(y(t))),
  ];
}

const CASES: [string, (number | null)[]][] = [
  ["a normal series", [1200, 2400, 1800, null, 2600, 2200]],
  ["a single point", [2000]],
  ["a flat series", [100, 100, 100]],
  ["all zeroes", [0, 0, 0]],
  ["nothing but gaps", [null, null]],
  ["one real value among gaps", [null, 340, null]],
  ["an empty series", []],
  ["negative values", [-2.5, 0, 3.5]],
];

for (const [name, values] of CASES) {
  for (const [w, h] of [[800, 190], [320, 120], [0, 190]]) {
    const bad = plot(values, w, h).filter((s) => s.includes("NaN") || s.includes("Infinity"));
    check(`plot survives ${name} at ${w}px`, bad, []);
  }
}

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
// Throwing (rather than setting process.exitCode) fails the run without
// pulling node's type definitions into a DOM-only tsconfig.
if (fails > 0) throw new Error(`${fails} stats test failure(s)`);
