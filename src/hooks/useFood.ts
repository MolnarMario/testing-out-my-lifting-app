import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { DEFAULT_FOODS } from "../data/foods";
import { baseUnitFor, emptyFoodDay, emptyFoodState, emptyGoals } from "../lib/food";
import type { Food, FoodDay, FoodEntry, FoodGoals, FoodState } from "../lib/food";
import { uid } from "../lib/format";

/**
 * Saved JSON is trusted about as far as a text file should be. A day written by
 * an older build — or hand-edited — must not be able to crash a render, so every
 * field is checked on the way in rather than on every read.
 */
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** An entry with no usable quantity cannot be totalled; its macros default to 0. */
function normalizeEntry(raw: unknown): FoodEntry | null {
  if (!isObject(raw) || !finite(raw.qty)) return null;
  const e = raw as Partial<FoodEntry>;
  const type = e.type === "liquid" ? "liquid" : "solid";
  return {
    id: typeof e.id === "string" ? e.id : uid(),
    foodId: typeof e.foodId === "string" ? e.foodId : "",
    name: typeof e.name === "string" ? e.name : "Food",
    type,
    qty: raw.qty,
    unit: e.unit === "g" || e.unit === "ml" || e.unit === "oz" || e.unit === "floz" ? e.unit : baseUnitFor(type),
    kcal: finite(e.kcal) ? e.kcal : 0,
    fat: finite(e.fat) ? e.fat : 0,
    carbs: finite(e.carbs) ? e.carbs : 0,
    fiber: finite(e.fiber) ? e.fiber : 0,
    protein: finite(e.protein) ? e.protein : 0,
  };
}

function normalizeFood(raw: unknown): Food | null {
  if (!isObject(raw) || typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  const f = raw as Partial<Food>;
  return {
    id: raw.id,
    name: raw.name,
    cat: typeof f.cat === "string" ? f.cat : "Other",
    type: f.type === "liquid" ? "liquid" : "solid",
    kcal: finite(f.kcal) ? f.kcal : 0,
    fat: finite(f.fat) ? f.fat : 0,
    carbs: finite(f.carbs) ? f.carbs : 0,
    fiber: finite(f.fiber) ? f.fiber : 0,
    protein: finite(f.protein) ? f.protein : 0,
  };
}

function normalizeDay(raw: unknown): FoodDay {
  const d = (isObject(raw) ? raw : {}) as Partial<FoodDay>;
  return {
    entries: Array.isArray(d.entries)
      ? d.entries.map(normalizeEntry).filter((e): e is FoodEntry => e !== null)
      : [],
    water: typeof d.water === "number" && Number.isFinite(d.water) ? d.water : 0,
    bw: typeof d.bw === "number" && Number.isFinite(d.bw) ? d.bw : null,
    cans: typeof d.cans === "number" && Number.isFinite(d.cans) ? d.cans : 0,
  };
}

function normalizeState(raw: unknown): FoodState {
  const s = (isObject(raw) ? raw : {}) as Partial<FoodState>;
  const goal = { ...emptyGoals(), ...(isObject(s.goal) ? s.goal : {}) } as FoodGoals;

  for (const key of Object.keys(goal) as (keyof FoodGoals)[]) {
    const v = goal[key];
    if (typeof v !== "number" || !Number.isFinite(v)) goal[key] = null;
  }

  const days: Record<string, FoodDay> = {};
  for (const [key, value] of Object.entries(isObject(s.days) ? s.days : {})) {
    days[key] = normalizeDay(value);
  }

  return {
    foods: Array.isArray(s.foods) ? s.foods.map(normalizeFood).filter((f): f is Food => f !== null) : [],
    days,
    goal,
    removedFoods: Array.isArray(s.removedFoods) ? s.removedFoods.filter((x) => typeof x === "string") : [],
  };
}

export function useFood() {
  // Normalised as it is read, so setters' `prev` is as safe as what renders.
  const [state, setState] = useLocalStorage<FoodState>("ironlog.food.v1", emptyFoodState(), normalizeState);

  const pantry = useMemo<Food[]>(() => {
    const builtins = DEFAULT_FOODS.filter((f) => !state.removedFoods.includes(f.id));
    return [...builtins, ...state.foods].sort((a, b) => a.name.localeCompare(b.name));
  }, [state.foods, state.removedFoods]);

  const getDay = useCallback(
    (key: string): FoodDay => state.days[key] ?? emptyFoodDay(),
    [state.days],
  );

  const updateDay = useCallback(
    (key: string, patch: (day: FoodDay) => FoodDay) => {
      setState((prev) => ({
        ...prev,
        days: { ...prev.days, [key]: patch(prev.days[key] ?? emptyFoodDay()) },
      }));
    },
    [setState],
  );

  const setGoals = useCallback(
    (patch: Partial<FoodGoals>) => {
      setState((prev) => ({ ...prev, goal: { ...prev.goal, ...patch } }));
    },
    [setState],
  );

  const addFood = useCallback(
    (food: Food) => {
      setState((prev) => ({ ...prev, foods: [...prev.foods, food] }));
    },
    [setState],
  );

  /** Custom foods are dropped outright; built-ins are only hidden. */
  const removeFood = useCallback(
    (id: string) => {
      setState((prev) =>
        prev.foods.some((f) => f.id === id)
          ? { ...prev, foods: prev.foods.filter((f) => f.id !== id) }
          : { ...prev, removedFoods: [...prev.removedFoods, id] },
      );
    },
    [setState],
  );

  return { state, pantry, getDay, updateDay, setGoals, addFood, removeFood };
}
