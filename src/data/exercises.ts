import type { Exercise } from "../lib/types";

export const EXERCISE_GROUPS = ["Squat", "Bench Press", "Deadlift", "Accessory"] as const;

export const DEFAULT_EXERCISES: Exercise[] = [
  { id: "back-squat", name: "Back Squat", group: "Squat", isMain: true },
  { id: "front-squat", name: "Front Squat", group: "Squat" },
  { id: "box-squat", name: "Box Squat", group: "Squat" },
  { id: "pause-squat", name: "Pause Squat", group: "Squat" },
  { id: "safety-bar-squat", name: "Safety Bar Squat", group: "Squat" },
  { id: "leg-press", name: "Leg Press", group: "Squat" },
  { id: "bulgarian-split-squat", name: "Bulgarian Split Squat", group: "Squat" },
  { id: "walking-lunge", name: "Walking Lunge", group: "Squat" },

  { id: "bench-press", name: "Bench Press", group: "Bench Press", isMain: true },
  { id: "close-grip-bench", name: "Close-Grip Bench", group: "Bench Press" },
  { id: "paused-bench", name: "Paused Bench", group: "Bench Press" },
  { id: "incline-bench", name: "Incline Bench Press", group: "Bench Press" },
  { id: "spoto-press", name: "Spoto Press", group: "Bench Press" },
  { id: "overhead-press", name: "Overhead Press", group: "Bench Press" },
  { id: "dumbbell-bench", name: "Dumbbell Bench Press", group: "Bench Press" },
  { id: "dips", name: "Dips", group: "Bench Press" },

  { id: "deadlift", name: "Deadlift", group: "Deadlift", isMain: true, hasStance: true },
  { id: "deficit-deadlift", name: "Deficit Deadlift", group: "Deadlift", hasStance: true },
  { id: "rack-pull", name: "Rack Pull", group: "Deadlift" },
  { id: "romanian-deadlift", name: "Romanian Deadlift", group: "Deadlift" },
  { id: "good-morning", name: "Good Morning", group: "Deadlift" },
  { id: "block-pull", name: "Block Pull", group: "Deadlift" },

  { id: "barbell-row", name: "Barbell Row", group: "Accessory" },
  { id: "pull-up", name: "Pull-Up", group: "Accessory" },
  { id: "lat-pulldown", name: "Lat Pulldown", group: "Accessory" },
  { id: "seated-cable-row", name: "Seated Cable Row", group: "Accessory" },
  { id: "face-pull", name: "Face Pull", group: "Accessory" },
  { id: "lateral-raise", name: "Lateral Raise", group: "Accessory" },
  { id: "bicep-curl", name: "Bicep Curl", group: "Accessory" },
  { id: "triceps-pushdown", name: "Triceps Pushdown", group: "Accessory" },
  { id: "leg-curl", name: "Leg Curl", group: "Accessory" },
  { id: "leg-extension", name: "Leg Extension", group: "Accessory" },
  { id: "calf-raise", name: "Calf Raise", group: "Accessory" },
  { id: "hanging-leg-raise", name: "Hanging Leg Raise", group: "Accessory" },
  { id: "plank", name: "Plank", group: "Accessory" },
  { id: "back-extension", name: "Back Extension", group: "Accessory" },
  { id: "farmers-carry", name: "Farmer's Carry", group: "Accessory" },
];
