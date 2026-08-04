/**
 * Development-only harness for eyeballing the chart panes against realistic
 * data. Not part of the app bundle — index.html never imports it.
 */
import { createRoot } from "react-dom/client";
import { DEFAULT_EXERCISES } from "./data/exercises";
import { ProgressPane } from "./components/workout/ProgressPane";
import { TrendsPane } from "./components/food/TrendsPane";
import { addDays, dateKey, todayKey } from "./lib/format";
import { emptyDay } from "./lib/types";
import type { DayLog, SetEntry } from "./lib/types";
import { emptyFoodDay } from "./lib/food";
import type { FoodDay, FoodEntry } from "./lib/food";
import "./styles/base.css";

// Deterministic noise, so two runs produce the same picture to compare.
let seed = 20260804;
function rnd(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const jitter = (span: number) => (rnd() - 0.5) * 2 * span;

const WEEKS = 16;
const today = todayKey();
const start = addDays(today, -(WEEKS * 7 - 1));

const days: Record<string, DayLog> = {};
const food: Record<string, FoodDay> = {};

let id = 0;
const set = (over: Partial<SetEntry>): SetEntry => ({
  id: `s${id++}`,
  groupId: `g${id}`,
  exerciseId: "def-squat",
  weight: 100,
  reps: 5,
  intensityType: "none",
  intensityValue: null,
  ...over,
});

const entry = (over: Partial<FoodEntry>): FoodEntry => ({
  id: `e${id++}`,
  foodId: "f",
  name: "Day total",
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

/** Mon/Tue/Thu/Fri, the way a four-day upper/lower actually falls. */
const SESSIONS: Record<number, { lift: string; accessories: string[] }> = {
  1: { lift: "def-squat", accessories: ["def-leg-press", "def-hanging-leg-raise"] },
  2: { lift: "def-bench-press", accessories: ["def-pendlay-row", "def-triceps-extension"] },
  4: { lift: "def-deadlift", accessories: ["def-pull-up", "def-ab-wheel-rollout"] },
  5: { lift: "def-overhead-press", accessories: ["def-lateral-raises", "def-cable-crunch"] },
};

const BASE: Record<string, number> = {
  "def-squat": 130,
  "def-bench-press": 92,
  "def-deadlift": 160,
  "def-overhead-press": 55,
};

for (let i = 0; i < WEEKS * 7; i++) {
  const key = addDays(start, i);
  const date = new Date(key + "T00:00:00");
  const dow = date.getDay();
  const week = Math.floor(i / 7);
  const deload = week === 6 || week === 13;

  // --- training ---
  const plan = SESSIONS[dow];
  // Two weeks lost to a holiday, so the heatmap and streak have something real
  // to show rather than a perfect grid.
  const skipped = week === 9 || (week === 4 && dow === 5);

  if (plan && !skipped) {
    const progress = 1 + week * 0.011;
    const top = Math.round(BASE[plan.lift] * progress * (deload ? 0.85 : 1) * 2) / 2;
    const sets: SetEntry[] = [];

    for (let s = 0; s < (deload ? 3 : 5); s++) {
      sets.push(
        set({
          exerciseId: plan.lift,
          weight: Math.round((top - s * 5) * 2) / 2,
          reps: s === 0 ? (week % 3 === 0 ? 3 : 5) : 5,
          intensityType: "rpe",
          intensityValue: 8,
        }),
      );
    }
    for (const acc of plan.accessories) {
      for (let s = 0; s < 3; s++) {
        sets.push(set({ exerciseId: acc, weight: acc === "def-pull-up" ? 0 : 40 + week, reps: 10 }));
      }
    }

    const startMin = 17 * 60 + Math.round(jitter(30));
    const len = (deload ? 55 : 78) + Math.round(jitter(15));
    const hh = (n: number) => String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");

    days[key] = {
      ...emptyDay(),
      sets,
      readinessOn: true,
      readiness: {
        motivation: 3 + Math.round(rnd() * 2),
        sleep: 2 + Math.round(rnd() * 3),
        calories: 3 + Math.round(rnd() * 2),
        protein: 4,
        hydration: 3 + Math.round(rnd() * 2),
        stimulants: 2 + Math.round(rnd() * 2),
      },
      sessionStart: hh(startMin),
      sessionEnd: hh(startMin + len),
      rating: deload ? 3 : 3 + Math.round(rnd() * 2),
    };
  }

  // --- food ---
  // Roughly one day in nine goes unlogged, which is what the gaps are for.
  if (rnd() > 0.11) {
    const weekend = dow === 0 || dow === 6;
    const kcal = Math.round(2450 + (weekend ? 320 : 0) + jitter(260));
    const protein = Math.round(178 + jitter(28));
    const fat = Math.round(78 + (weekend ? 14 : 0) + jitter(16));
    const fiber = Math.round(32 + jitter(9));
    const carbs = Math.max(120, Math.round((kcal - protein * 4 - fat * 9) / 4));

    food[key] = {
      ...emptyFoodDay(),
      entries: [entry({ kcal, protein, carbs, fat, fiber })],
      water: Math.round((2600 + jitter(900)) / 250) * 250,
      cans: rnd() > 0.6 ? 1 : 0,
      // Weigh-ins skip a day here and there, drifting down about 2.5 kg overall.
      bw: rnd() > 0.25 ? Math.round((82.4 - i * 0.016 + jitter(0.55)) * 10) / 10 : null,
    };
  }
}

localStorage.setItem("ironlog.days", JSON.stringify(days));
localStorage.setItem(
  "ironlog.food.v1",
  JSON.stringify({
    foods: [],
    days: food,
    goal: { kcal: 2500, protein: 185, carbs: 280, fat: 80, fiber: 35, water: 3000 },
    removedFoods: [],
  }),
);

const logged = Object.keys(days).length;
console.log(`[harness] seeded ${logged} sessions, ${Object.keys(food).length} food days from ${start}`);
console.log(`[harness] today is ${dateKey(new Date())}`);

createRoot(document.getElementById("root")!).render(
  <div className="wrap">
    <h1 style={{ fontFamily: "var(--font-display)", letterSpacing: ".14em", fontSize: 15 }}>
      WORKOUT ▸ PROGRESS
    </h1>
    <ProgressPane
      days={days}
      library={DEFAULT_EXERCISES}
      maxes={{ squat: 172.5, bench: 122.5, deadlift: 215 }}
      unit="kg"
      onOpenDay={(d) => console.log("open day", d)}
    />

    <h1 style={{ fontFamily: "var(--font-display)", letterSpacing: ".14em", fontSize: 15, marginTop: 40 }}>
      FOOD ▸ TRENDS
    </h1>
    <TrendsPane
      days={food}
      goals={{ kcal: 2500, protein: 185, carbs: 280, fat: 80, fiber: 35, water: 3000 }}
      unit="kg"
      onOpenDay={(d) => console.log("open day", d)}
      onOpenGoals={() => console.log("open goals")}
    />
  </div>,
);
