import {
  GRAMS_PER_OZ,
  ML_PER_FLOZ,
  baseUnitFor,
  buildFood,
  fromBaseQty,
  num,
  slugFood,
  toBaseQty,
  toggleUnit,
  totalsFor,
  unitLabel,
} from "./food.ts";
import type { Food, FoodDraft, FoodEntry } from "./food.ts";

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

// --- quantity conversion -----------------------------------------------------

check("8 oz -> grams", Number(toBaseQty(8, "oz").toFixed(4)), 226.796);
check("8 fl oz -> ml", Number(toBaseQty(8, "floz").toFixed(4)), 236.588);
check("grams pass through", toBaseQty(200, "g"), 200);
check("ml pass through", toBaseQty(500, "ml"), 500);

check("grams -> oz round trip", Number(fromBaseQty(toBaseQty(8, "oz"), "oz").toFixed(6)), 8);
check("ml -> fl oz round trip", Number(fromBaseQty(toBaseQty(12, "floz"), "floz").toFixed(6)), 12);
check("constants", [GRAMS_PER_OZ, ML_PER_FLOZ], [28.3495, 29.5735]);

// --- unit toggling -----------------------------------------------------------

check("solid toggles g <-> oz", [toggleUnit("g", "solid"), toggleUnit("oz", "solid")], ["oz", "g"]);
check(
  "liquid toggles ml <-> fl oz",
  [toggleUnit("ml", "liquid"), toggleUnit("floz", "liquid")],
  ["floz", "ml"],
);
check("base units", [baseUnitFor("solid"), baseUnitFor("liquid")], ["g", "ml"]);
check("fl oz gets a space", [unitLabel("floz"), unitLabel("g")], ["fl oz", "g"]);

// --- totals ------------------------------------------------------------------

check("empty day totals zero", totalsFor([]), {
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
});

// 200 g of chicken breast: everything scales by 2.
const chicken200 = entry({ qty: 200, kcal: 120, protein: 22.5, fat: 2.6 });
check("200 g scales by 2", totalsFor([chicken200]), {
  kcal: 240,
  protein: 45,
  carbs: 0,
  fat: 5.2,
  fiber: 0,
});

// 8 oz of the same food, stored canonically in grams.
const chicken8oz = entry({ qty: toBaseQty(8, "oz"), unit: "oz", kcal: 120, protein: 22.5, fat: 2.6 });
const oz = totalsFor([chicken8oz]);
check(
  "8 oz scales by 2.268",
  [Math.round(oz.kcal), Math.round(oz.protein), Number(oz.fat.toFixed(1))],
  [272, 51, 5.9],
);

const combined = totalsFor([chicken200, chicken8oz]);
check("totals add up", Math.round(combined.kcal), 512);

// --- formatting --------------------------------------------------------------

check("num trims trailing zero", [num(12), num(12.5), num(12.04), num(0)], ["12", "12.5", "12", "0"]);
check("slug is stable", slugFood("Greek yoghurt 2%"), "cf-greek-yoghurt-2");
check("slug trims edges", slugFood("  Whey isolate  "), "cf-whey-isolate");

// --- building a food from a draft --------------------------------------------
// Shared by the pantry form and the label scanner, so both reject the same things.

const draft = (over: Partial<FoodDraft> = {}): FoodDraft => ({
  name: "Greek yoghurt 2%",
  cat: "Dairy & Eggs",
  type: "solid",
  kcal: "59",
  protein: "10",
  carbs: "3.6",
  fat: "1.7",
  fiber: "",
  ...over,
});

const built = buildFood(draft(), []);
check("a full draft builds", built.ok && built.food, {
  id: "cf-greek-yoghurt-2",
  name: "Greek yoghurt 2%",
  cat: "Dairy & Eggs",
  type: "solid",
  kcal: 59,
  protein: 10,
  carbs: 3.6,
  fat: 1.7,
  fiber: 0,
});

check("blank macros become zero", built.ok && built.food.fiber, 0);
check("the name is trimmed", (buildFood(draft({ name: "  Whey  " }), []) as { food: Food }).food.name, "Whey");

check("an empty name is refused", buildFood(draft({ name: "   " }), []), {
  ok: false,
  error: "Give the food a name.",
});
check("missing calories are refused", buildFood(draft({ kcal: "" }), []), {
  ok: false,
  error: "Calories per 100 is required.",
});
check("negative calories are refused", buildFood(draft({ kcal: "-5" }), []), {
  ok: false,
  error: "Calories per 100 is required.",
});
check("nonsense calories are refused", buildFood(draft({ kcal: "abc" }), []), {
  ok: false,
  error: "Calories per 100 is required.",
});

// Names collide on their slug, not their spelling: "Whey Isolate" and "whey
// isolate" are the same pantry entry.
const existing: Food[] = [
  { id: "cf-whey-isolate", name: "Whey isolate", cat: "Other", type: "solid", kcal: 380, fat: 1, carbs: 4, fiber: 0, protein: 88 },
];
check("a duplicate name is refused", buildFood(draft({ name: "WHEY ISOLATE" }), existing), {
  ok: false,
  error: "A food with that name already exists.",
});
check("a different name is allowed", buildFood(draft({ name: "Whey concentrate" }), existing).ok, true);

// A negative macro is a typo, not an instruction to subtract from the day.
check(
  "negative macros fall back to zero",
  (buildFood(draft({ protein: "-10" }), []) as { food: Food }).food.protein,
  0,
);

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
// Throwing (rather than setting process.exitCode) fails the run without
// pulling node's type definitions into a DOM-only tsconfig.
if (fails > 0) throw new Error(`${fails} food test failure(s)`);
