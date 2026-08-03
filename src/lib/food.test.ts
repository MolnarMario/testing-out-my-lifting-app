import {
  GRAMS_PER_OZ,
  ML_PER_FLOZ,
  baseUnitFor,
  fromBaseQty,
  num,
  slugFood,
  toBaseQty,
  toggleUnit,
  totalsFor,
  unitLabel,
} from "./food.ts";
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

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
// Throwing (rather than setting process.exitCode) fails the run without
// pulling node's type definitions into a DOM-only tsconfig.
if (fails > 0) throw new Error(`${fails} food test failure(s)`);
