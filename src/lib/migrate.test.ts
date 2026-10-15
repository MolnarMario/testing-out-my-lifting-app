/**
 * The legacy import, run against storage shaped exactly as the original build
 * wrote it (legacy/index.html is the reference). Node has no localStorage, so a
 * Map stands in for it.
 */

const store = new Map<string, string>();
const storage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};
(globalThis as { window?: unknown }).window = { localStorage: storage };

const { BACKUP, migrationAvailable, runMigration } = await import("./migrate.ts");

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

const json = (key: string) => JSON.parse(store.get(key) ?? "null");

// --- a new-build user never sees the banner -------------------------------------

store.set("ironlog.days", JSON.stringify({ "2026-10-01": { sets: [], readinessOn: false } }));
check("new-format days alone offer no import", migrationAvailable(), false);
store.clear();

// Exercise edits alone still get the banner, so the summary can say they stayed behind.
store.set("ironlog.overrides", JSON.stringify({ "def-squat": { belt: false } }));
check("exercise edits alone offer an import", migrationAvailable(), true);
const editsOnly = runMigration();
check("and the summary names them", [editsOnly.ran, editsOnly.leftBehind], [true, ["edits to 1 built-in exercise"]]);
store.clear();

// --- the original build's storage ----------------------------------------------

const NEW_DAY = {
  sets: [{ id: "n1", groupId: "g", exerciseId: "def-bench-press", weight: 90, reps: 3, intensityType: "none", intensityValue: null }],
  readinessOn: false,
  notes: "",
};

const LEGACY_DAYS = {
  "2025-06-01": {
    entries: [
      { id: "a", groupId: "g1", exerciseName: "Squat", weight: 100, reps: 5, unit: "kg", intensityType: "RPE", intensityValue: 8 },
      // The old form saved an empty weight box as null: bodyweight work.
      { id: "b", groupId: "g2", exerciseName: "Pull-Up", weight: null, reps: 10, unit: "kg", intensityType: "-" },
      // Not in the library: must survive as a custom exercise, not vanish.
      { id: "c", groupId: "g3", exerciseName: "Zercher Squat", weight: 135, reps: 8, unit: "lb", intensityType: "-" },
      // No reps: nothing to represent.
      { id: "d", groupId: "g4", exerciseName: "Squat", weight: 100, reps: null, unit: "kg" },
    ],
    start: "17:00",
    end: "18:15",
    rating: 4,
  },
  // Logged in the new build while the import banner was put off.
  "2026-10-01": NEW_DAY,
};

store.set("ironlog.days", JSON.stringify(LEGACY_DAYS));
store.set("ironlog.maxes", JSON.stringify({ squat: 225, bench: null, deadlift: 500, unit: "lb" }));
store.set(
  "macroJournal.v1",
  JSON.stringify({
    foods: [],
    // A day is a bare array of entries; water, cans and bodyweight live in extra.byDay.
    days: {
      "2025-06-01": [
        { id: "e1", foodId: "df-potatoes", name: "Potatoes", type: "solid", kcal: 77, protein: 2, fat: 0.1, carbs: 17, fiber: 2.2, qty: 200 },
        { id: "e2", foodId: "cf-milk", name: "Milk", type: "liquid", kcal: 60, protein: 3.4, fat: 3.2, carbs: 4.8, fiber: 0, qty: 236.6, qu: "floz" },
      ],
    },
    goal: { kcal: 2500, protein: 180 },
    removedFoods: [],
    foodOv: { "df-potatoes": { kcal: 80 } },
    extra: {
      byDay: {
        "2025-06-01": { water: 1500, monster: 2, bw: 82.5 },
        "2025-06-02": { water: 500, monster: 0, bf: 15 },
      },
      water: 3000,
    },
  }),
);

check("legacy data offers an import", migrationAvailable(), true);

const report = runMigration();
check("import ran", report.ran, true);
check("report counts", [report.days, report.sets, report.skippedSets, report.foodDays, report.foodEntries, report.maxes], [1, 3, 1, 2, 2, true]);
check("unknown names become custom exercises", report.createdExercises, ["Zercher Squat"]);
check("what has nowhere to go is named", report.leftBehind, [
  "1 body-fat reading",
  // Two cans came across, and the old default counted 2 g of carbs each.
  "the old can settings (10 kcal and 2 g carbs a can; cans now count 10 kcal and no carbs)",
]);

const days = json("ironlog.days");
const sets = days["2025-06-01"].sets;
check("legacy sets map onto library ids", sets.map((s: { exerciseId: string }) => s.exerciseId), [
  "def-squat",
  "def-pull-up",
  "cx-zercher-squat",
]);
check("a null weight imports as bodyweight", sets[1].weight, 0);
check("lb weights convert to kg", sets[2].weight, 61.23);
check("intensity maps", [sets[0].intensityType, sets[0].intensityValue], ["rpe", 8]);
check("session times carry over", [days["2025-06-01"].sessionStart, days["2025-06-01"].sessionEnd], ["17:00", "18:15"]);
check("a day already in the new shape is untouched", days["2026-10-01"], NEW_DAY);

check("the created exercise is in the library", json("ironlog.custom").map((e: { id: string }) => e.id), ["cx-zercher-squat"]);
check("maxes convert from lb to kg", json("ironlog.maxes"), { squat: 102.06, bench: null, deadlift: 226.8 });

const food = json("ironlog.food.v1");
check("food entries come across", food.days["2025-06-01"].entries.map((e: { name: string; unit: string }) => [e.name, e.unit]), [
  ["Potatoes", "g"],
  ["Milk", "floz"],
]);
check("water, cans and bodyweight come from extra.byDay", [food.days["2025-06-01"].water, food.days["2025-06-01"].cans, food.days["2025-06-01"].bw], [1500, 2, 82.5]);
check("a day with only water still counts", food.days["2025-06-02"].water, 500);
check("the water goal comes from extra.water", [food.goal.kcal, food.goal.protein, food.goal.water], [2500, 180, 3000]);
check("an edited built-in becomes a custom food", food.foods.map((f: { id: string; kcal: number }) => [f.id, f.kcal]), [["cf-potatoes", 80]]);
check("and the original is hidden", food.removedFoods, ["df-potatoes"]);

const backup = json(BACKUP);
check("the overwritten keys are backed up raw", JSON.parse(backup.keys["ironlog.days"]), LEGACY_DAYS);
check("the old food journal is left alone", store.has("macroJournal.v1"), true);

check("it never runs twice", [migrationAvailable(), runMigration().reason], [false, "already imported"]);

// --- a write that fails part-way is rolled back ------------------------------

store.clear();
store.set("ironlog.days", JSON.stringify(LEGACY_DAYS));
store.set("ironlog.maxes", JSON.stringify({ squat: 225, bench: null, deadlift: 500, unit: "lb" }));
const originalSetItem = storage.setItem;
// Storage fills up on the maxes write, after the days have already landed.
storage.setItem = (k, v) => {
  if (k === "ironlog.maxes" && v.includes("102.06")) throw new Error("QuotaExceededError");
  originalSetItem(k, v);
};
const failed = runMigration();
storage.setItem = originalSetItem;
check("a failed import says so", [failed.ran, failed.reason], [false, "storage refused the import"]);
check("the days it had already written are put back", json("ironlog.days"), LEGACY_DAYS);
check("and no marker is left behind", store.has("ironlog.migrated.v1"), false);

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
if (fails > 0) throw new Error(`${fails} migrate test failure(s)`);
