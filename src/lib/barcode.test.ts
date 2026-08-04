import {
  guessCategory,
  guessType,
  isValidBarcode,
  macroDrafts,
  mapNutriments,
  productName,
  toProduct,
} from "./barcode.ts";

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

// --- check digits ------------------------------------------------------------
// A single misread bar would fetch a different product's macros and look
// entirely plausible. The check digit is what catches that locally.

check("valid EAN-13 (Romanian prefix)", isValidBarcode("5941234567899"), true);
check("valid EAN-13 (Coca-Cola)", isValidBarcode("5449000000996"), true);
check("valid EAN-8", isValidBarcode("96385074"), true);
check("valid UPC-A", isValidBarcode("036000291452"), true);
check("valid ITF-14", isValidBarcode("15941234567896"), true);

check("a wrong check digit is refused", isValidBarcode("5449000000997"), false);
check("a misread last digit is refused", isValidBarcode("5941234567890"), false);
check("wrong length is refused", isValidBarcode("12345"), false);
check("letters are refused", isValidBarcode("59412345678AB"), false);
check("empty is refused", isValidBarcode(""), false);
check("spaces are refused", isValidBarcode("5449 0000 00996"), false);

// --- nutriment mapping -------------------------------------------------------

const full = mapNutriments({
  "energy-kcal_100g": 477,
  proteins_100g: 6.8,
  carbohydrates_100g: 54.3,
  fat_100g: 24.5,
  fiber_100g: 3.4,
});
check("a complete record maps across", full.fields, {
  kcal: 477,
  protein: 6.8,
  carbs: 54.3,
  fat: 24.5,
  fiber: 3.4,
});
check("everything is marked found", full.found, {
  kcal: true,
  protein: true,
  carbs: true,
  fat: true,
  fiber: true,
});

// Crowd-sourced data arrives as strings about as often as numbers.
check(
  "string values are coerced",
  mapNutriments({ "energy-kcal_100g": "477", proteins_100g: "6,8" }).fields.protein,
  6.8,
);

// Plenty of European entries carry only kJ.
check(
  "kcal is derived from energy-kj_100g",
  mapNutriments({ "energy-kj_100g": 1996 }).fields.kcal,
  477.05,
);
check("kcal is derived from energy_100g", mapNutriments({ energy_100g: 1996 }).fields.kcal, 477.05);
check(
  "an explicit kcal beats the kJ figure",
  mapNutriments({ "energy-kcal_100g": 477, "energy-kj_100g": 9999 }).fields.kcal,
  477,
);

const sparse = mapNutriments({ "energy-kcal_100g": 45, proteins_100g: 3.2 });
check("missing macros stay zero", sparse.fields, { kcal: 45, protein: 3.2, carbs: 0, fat: 0, fiber: 0 });
check("and are marked unfound", [sparse.found.carbs, sparse.found.fiber], [false, false]);

check("junk is ignored", mapNutriments({ proteins_100g: "n/a", fat_100g: null }).found, {
  kcal: false,
  protein: false,
  carbs: false,
  fat: false,
  fiber: false,
});
check("an empty record finds nothing", mapNutriments({}).found.kcal, false);
check("negatives are rejected", mapNutriments({ "energy-kcal_100g": -10 }).found.kcal, false);
check("zero is a real value", mapNutriments({ "energy-kcal_100g": 0 }).found.kcal, true);

// --- solid vs liquid ---------------------------------------------------------

check("millilitres mean liquid", guessType({ quantity: "500 ml" }), "liquid");
check("litres mean liquid", guessType({ quantity: "1,5 L" }), "liquid");
check("grams mean solid", guessType({ quantity: "250 g" }), "solid");
check(
  "a beverage tag means liquid",
  guessType({ categories_tags: ["en:beverages", "en:sodas"] }),
  "liquid",
);
check("milk is liquid", guessType({ categories_tags: ["en:dairies", "en:milks"] }), "liquid");
check("nothing to go on means solid", guessType({}), "solid");

// --- categories --------------------------------------------------------------

check("yoghurt is dairy", guessCategory(["en:dairies", "en:yogurts"]), "Dairy & Eggs");
check("chicken is meat", guessCategory(["en:meats", "en:poultry"]), "Meat & Fish");
check("bread is grains", guessCategory(["en:cereals-and-potatoes", "en:breads"]), "Grains & Bread");
check("juice is a beverage", guessCategory(["en:beverages", "en:fruit-juices"]), "Beverages");
check("almonds are nuts", guessCategory(["en:plant-based-foods", "en:almonds"]), "Nuts & Seeds");
check("lentils are legumes", guessCategory(["en:legumes", "en:lentils"]), "Legumes");
check("olive oil is fats", guessCategory(["en:fats", "en:olive-oils"]), "Fats & Condiments");
check("romanian tags match too", guessCategory(["ro:lactate", "ro:iaurt"]), "Dairy & Eggs");
check("an unknown tag falls back", guessCategory(["en:snacks"]), "Other");
check("no tags fall back", guessCategory(undefined), "Other");
// The specific tag should win over the general one it sits under.
check(
  "the most specific tag wins",
  guessCategory(["en:plant-based-foods-and-beverages", "en:nuts"]),
  "Nuts & Seeds",
);

// --- names -------------------------------------------------------------------

check("the brand is prefixed", productName({ product_name: "Iaurt grecesc", brands: "Napolact" }), "Napolact Iaurt grecesc");
check(
  "a brand already in the name is not repeated",
  productName({ product_name: "Napolact Iaurt", brands: "Napolact" }),
  "Napolact Iaurt",
);
check(
  "the romanian name is preferred",
  productName({ product_name: "Greek yogurt", product_name_ro: "Iaurt grecesc" }),
  "Iaurt grecesc",
);
check("only the first brand is used", productName({ product_name: "Lapte", brands: "Zuzu, Albalact" }), "Zuzu Lapte");
check("a generic name is a last resort", productName({ generic_name: "Iaurt" }), "Iaurt");
check("no name at all is empty", productName({}), "");

// --- whole payloads ----------------------------------------------------------

const payload = {
  status: 1,
  product: {
    product_name: "Iaurt grecesc 10%",
    brands: "Napolact",
    quantity: "150 g",
    categories_tags: ["en:dairies", "en:yogurts"],
    nutriments: {
      "energy-kcal_100g": 97,
      proteins_100g: 5.7,
      carbohydrates_100g: 3.6,
      fat_100g: 10,
      fiber_100g: 0,
    },
  },
};

check("a real payload maps end to end", toProduct("5941234567899", payload), {
  code: "5941234567899",
  name: "Napolact Iaurt grecesc 10%",
  fields: { kcal: 97, protein: 5.7, carbs: 3.6, fat: 10, fiber: 0 },
  found: { kcal: true, protein: true, carbs: true, fat: true, fiber: true },
  type: "solid",
  cat: "Dairy & Eggs",
});

// Not in the database: the caller falls through to reading the label.
check("a miss returns null", toProduct("5941234567899", { status: 0 }), null);
check("an empty body returns null", toProduct("5941234567899", {}), null);
check("a null body returns null", toProduct("5941234567899", null), null);
// An entry with no calories is not worth interrupting the scan for.
check(
  "a product without calories returns null",
  toProduct("5941234567899", { status: 1, product: { product_name: "X", nutriments: {} } }),
  null,
);

// --- drafts ------------------------------------------------------------------
// A macro the database was missing must stay blank, never a confident zero.

const partial = toProduct("5449000000996", {
  status: 1,
  product: { product_name: "Cola", quantity: "500 ml", nutriments: { "energy-kcal_100g": 42, sugars_100g: 10.6 } },
});

check("a partial product still maps", partial !== null, true);
check("unknown macros stay blank", partial && macroDrafts(partial), {
  kcal: "42",
  protein: "",
  carbs: "",
  fat: "",
  fiber: "",
});
check("and the drink is liquid", partial?.type, "liquid");

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
// Throwing (rather than setting process.exitCode) fails the run without pulling
// node's type definitions into a DOM-only tsconfig.
if (fails > 0) throw new Error(`${fails} barcode test failure(s)`);
