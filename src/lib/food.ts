export type FoodType = "solid" | "liquid";

/** Entry quantities are stored in grams (solids) or millilitres (liquids). */
export type QtyUnit = "g" | "ml" | "oz" | "floz";

export const FOOD_CATEGORIES = [
  "Vegetables & Roots",
  "Meat & Fish",
  "Dairy & Eggs",
  "Fruits",
  "Grains & Bread",
  "Fats & Condiments",
  "Beverages",
  "Nuts & Seeds",
  "Legumes",
  "Other",
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

/** All macros are per 100 g / 100 ml. */
export interface Food {
  id: string;
  name: string;
  cat: string;
  type: FoodType;
  kcal: number;
  fat: number;
  carbs: number;
  fiber: number;
  protein: number;
}

/**
 * Logged portions snapshot the food's macros. Editing a pantry entry later must
 * not silently rewrite what yesterday's meal contained.
 */
export interface FoodEntry {
  id: string;
  foodId: string;
  name: string;
  type: FoodType;
  /** Always grams or millilitres, whatever unit was typed. */
  qty: number;
  /** The unit the user entered, kept so the entry reads back the way they wrote it. */
  unit: QtyUnit;
  kcal: number;
  fat: number;
  carbs: number;
  fiber: number;
  protein: number;
}

export interface FoodDay {
  entries: FoodEntry[];
  /** Millilitres. */
  water: number;
  /** Kilograms, canonical like the rest of the app. */
  bw: number | null;
}

export interface FoodGoals {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  water: number | null;
}

export interface FoodState {
  /** Custom foods only; the built-in table is merged in at read time. */
  foods: Food[];
  days: Record<string, FoodDay>;
  goal: FoodGoals;
  /** Built-in foods the user has hidden. */
  removedFoods: string[];
}

export const GRAMS_PER_OZ = 28.3495;
export const ML_PER_FLOZ = 29.5735;

export function emptyFoodDay(): FoodDay {
  return { entries: [], water: 0, bw: null };
}

export function emptyGoals(): FoodGoals {
  return { kcal: null, protein: null, carbs: null, fat: null, fiber: null, water: null };
}

export function emptyFoodState(): FoodState {
  return { foods: [], days: {}, goal: emptyGoals(), removedFoods: [] };
}

/** Converts a typed quantity into the canonical g/ml. */
export function toBaseQty(value: number, unit: QtyUnit): number {
  if (unit === "oz") return value * GRAMS_PER_OZ;
  if (unit === "floz") return value * ML_PER_FLOZ;
  return value;
}

/** Converts canonical g/ml back into the unit the entry was logged in. */
export function fromBaseQty(qty: number, unit: QtyUnit): number {
  if (unit === "oz") return qty / GRAMS_PER_OZ;
  if (unit === "floz") return qty / ML_PER_FLOZ;
  return qty;
}

export function unitLabel(unit: QtyUnit): string {
  return unit === "floz" ? "fl oz" : unit;
}

/** The unit toggle flips between metric and imperial for the food's own type. */
export function toggleUnit(unit: QtyUnit, type: FoodType): QtyUnit {
  if (type === "liquid") return unit === "ml" ? "floz" : "ml";
  return unit === "g" ? "oz" : "g";
}

export function baseUnitFor(type: FoodType): QtyUnit {
  return type === "liquid" ? "ml" : "g";
}

export interface Totals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export function totalsFor(entries: FoodEntry[]): Totals {
  return entries.reduce<Totals>(
    (sum, e) => {
      const factor = e.qty / 100;
      return {
        kcal: sum.kcal + e.kcal * factor,
        protein: sum.protein + e.protein * factor,
        carbs: sum.carbs + e.carbs * factor,
        fat: sum.fat + e.fat * factor,
        fiber: sum.fiber + e.fiber * factor,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

/** One decimal, trailing zero trimmed — 12.0 reads as 12, 12.5 stays 12.5. */
export function num(value: number): string {
  return Number(value.toFixed(1)).toString();
}

export function slugFood(name: string): string {
  return (
    "cf-" +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}
