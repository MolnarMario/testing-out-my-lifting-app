import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { DEFAULT_FOODS } from "../data/foods";
import { emptyFoodDay, emptyFoodState, emptyGoals } from "../lib/food";
import type { Food, FoodDay, FoodGoals, FoodState } from "../lib/food";

/**
 * Saved JSON is trusted about as far as a text file should be. A day written by
 * an older build — or hand-edited — must not be able to crash a render, so every
 * field is checked on the way in rather than on every read.
 */
function normalizeDay(raw: unknown): FoodDay {
  const d = (raw ?? {}) as Partial<FoodDay>;
  return {
    entries: Array.isArray(d.entries) ? d.entries : [],
    water: typeof d.water === "number" && Number.isFinite(d.water) ? d.water : 0,
    bw: typeof d.bw === "number" && Number.isFinite(d.bw) ? d.bw : null,
    cans: typeof d.cans === "number" && Number.isFinite(d.cans) ? d.cans : 0,
  };
}

function normalizeState(raw: FoodState): FoodState {
  const s = (raw ?? {}) as Partial<FoodState>;
  const goal = { ...emptyGoals(), ...(s.goal ?? {}) } as FoodGoals;

  for (const key of Object.keys(goal) as (keyof FoodGoals)[]) {
    const v = goal[key];
    if (typeof v !== "number" || !Number.isFinite(v)) goal[key] = null;
  }

  const days: Record<string, FoodDay> = {};
  for (const [key, value] of Object.entries(s.days ?? {})) {
    days[key] = normalizeDay(value);
  }

  return {
    foods: Array.isArray(s.foods) ? s.foods : [],
    days,
    goal,
    removedFoods: Array.isArray(s.removedFoods) ? s.removedFoods.filter((x) => typeof x === "string") : [],
  };
}

export function useFood() {
  const [stored, setState] = useLocalStorage<FoodState>("ironlog.food.v1", emptyFoodState());
  const state = useMemo(() => normalizeState(stored), [stored]);

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
