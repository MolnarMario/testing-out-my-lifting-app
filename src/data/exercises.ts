import type { Exercise } from "../lib/types";

/** Matches the original build's groups; "Other" holds custom exercises only. */
export const EXERCISE_GROUPS = [
  "Deadlift / Pull",
  "Squat / Legs",
  "Bench / Press",
  "Abs / Core",
  "Other",
] as const;

/** Knee gear options offered on squat variations. */
export const KNEE_GEAR = [
  { value: "Sleeveless", label: "None" },
  { value: "Gen 1 Sleeves", label: "Gen 1" },
  { value: "Stiff Sleeves", label: "Stiff" },
  { value: "Wraps", label: "Wraps" },
] as const;

export const DEFAULT_EXERCISES: Exercise[] = [

  // Deadlift / Pull
  { id: "def-deadlift", name: "Deadlift", group: "Deadlift / Pull", hasStance: true, belt: true, straps: true },
  { id: "def-rdl", name: "RDL", group: "Deadlift / Pull", hasStance: true, belt: true, straps: true },
  { id: "def-stiff-leg-dl", name: "Stiff-Leg DL", group: "Deadlift / Pull", hasStance: true, belt: true, straps: true },
  { id: "def-snatch-grip-dl", name: "Snatch-Grip DL", group: "Deadlift / Pull", hasStance: true, belt: true, straps: true },
  { id: "def-rack-pull", name: "Rack Pull", group: "Deadlift / Pull", hasStance: true, belt: true, straps: true },
  { id: "def-block-pull", name: "Block Pull", group: "Deadlift / Pull", hasStance: true, belt: true, straps: true },
  { id: "def-deficit-dl", name: "Deficit DL", group: "Deadlift / Pull", hasStance: true, belt: true, straps: true },
  { id: "def-deadlift-row", name: "Deadlift Row", group: "Deadlift / Pull", belt: true, straps: true },
  { id: "def-pendlay-row", name: "Pendlay Row", group: "Deadlift / Pull", belt: true, straps: true },
  { id: "def-pull-up", name: "Pull-Up", group: "Deadlift / Pull", straps: true },
  { id: "def-chest-supported-row", name: "Chest-Supported Row", group: "Deadlift / Pull", straps: true },
  { id: "def-hamstring-curl", name: "Hamstring Curl", group: "Deadlift / Pull" },
  { id: "def-face-pulls", name: "Face Pulls", group: "Deadlift / Pull" },

  // Squat / Legs
  { id: "def-squat", name: "Squat", group: "Squat / Legs", belt: true, kneeGear: true },
  { id: "def-pause-squat", name: "Pause Squat", group: "Squat / Legs", belt: true, kneeGear: true },
  { id: "def-tempo-squat", name: "Tempo Squat", group: "Squat / Legs", belt: true, kneeGear: true },
  { id: "def-pin-squat", name: "Pin Squat", group: "Squat / Legs", belt: true, kneeGear: true },
  { id: "def-hatfield-squat", name: "Hatfield Squat", group: "Squat / Legs", belt: true, kneeGear: true },
  { id: "def-ssb-squat", name: "SSB Squat", group: "Squat / Legs", belt: true, kneeGear: true },
  { id: "def-belt-squat", name: "Belt Squat", group: "Squat / Legs", kneeGear: true },
  { id: "def-pendulum-squat", name: "Pendulum Squat", group: "Squat / Legs", belt: true, kneeGear: true },
  { id: "def-hack-squat", name: "Hack Squat", group: "Squat / Legs", belt: true, kneeGear: true },
  { id: "def-leg-press", name: "Leg Press", group: "Squat / Legs" },
  { id: "def-split-squat", name: "Split Squat", group: "Squat / Legs" },
  { id: "def-leg-extension", name: "Leg Extension", group: "Squat / Legs" },

  // Bench / Press
  { id: "def-bench-press", name: "Bench Press", group: "Bench / Press", belt: true },
  { id: "def-long-pause-bench", name: "Long-Pause Bench", group: "Bench / Press", belt: true },
  { id: "def-close-grip-bench", name: "Close-Grip Bench", group: "Bench / Press", belt: true },
  { id: "def-wide-grip-bench", name: "Wide-Grip Bench", group: "Bench / Press", belt: true },
  { id: "def-tempo-bench", name: "Tempo Bench", group: "Bench / Press", belt: true },
  { id: "def-larson-press", name: "Larson Press", group: "Bench / Press" },
  { id: "def-feet-up-bench", name: "Feet-Up Bench", group: "Bench / Press" },
  { id: "def-overhead-press", name: "Overhead Press", group: "Bench / Press", belt: true },
  { id: "def-push-press", name: "Push Press", group: "Bench / Press", belt: true },
  { id: "def-chest-press", name: "Chest Press", group: "Bench / Press" },
  { id: "def-incline-press", name: "Incline Press", group: "Bench / Press", belt: true },
  { id: "def-decline-press", name: "Decline Press", group: "Bench / Press" },
  { id: "def-dips", name: "Dips", group: "Bench / Press" },
  { id: "def-dip-machine", name: "Dip Machine", group: "Bench / Press" },
  { id: "def-triceps-extension", name: "Triceps Extension", group: "Bench / Press" },
  { id: "def-lateral-raises", name: "Lateral Raises", group: "Bench / Press" },

  // Abs / Core
  { id: "def-plank", name: "Plank", group: "Abs / Core", timed: true },
  { id: "def-hanging-leg-raise", name: "Hanging Leg Raise", group: "Abs / Core" },
  { id: "def-ab-wheel-rollout", name: "Ab Wheel Rollout", group: "Abs / Core" },
  { id: "def-cable-crunch", name: "Cable Crunch", group: "Abs / Core" },
  { id: "def-weighted-sit-up", name: "Weighted Sit-Up", group: "Abs / Core" },
  { id: "def-russian-twist", name: "Russian Twist", group: "Abs / Core" },
];
