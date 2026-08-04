import { EXERCISE_GROUPS } from "../../data/exercises";
import type { MacroKey } from "../../lib/stats";

/**
 * Chart series colours, as CSS custom properties so a theme change reaches the
 * SVG without a re-render.
 *
 * These are not the UI accent colours. The accents are stepped for text and
 * buttons and sit too light against the chart surface to stay apart under
 * colour-blind simulation; these are the same hue identities re-stepped for the
 * plot and validated as a set. The hue a thing *means* is unchanged — protein
 * and deadlifts are still red, carbs and squats still gold.
 */
export const VIZ = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)", "var(--viz-5)"];

export const MACRO_COLOR: Record<MacroKey, string> = {
  protein: VIZ[0],
  fat: VIZ[1],
  carbs: VIZ[2],
  fiber: VIZ[3],
};

export const MACRO_LABEL: Record<MacroKey, string> = {
  protein: "Protein",
  carbs: "Carbs",
  fat: "Fat",
  fiber: "Fiber",
};

/**
 * Stack and legend order — deliberately not the P/C/F reading order used in the
 * text rows. Red beside gold is the one adjacent pair in this palette that a
 * red-green colour-blind reader cannot separate; red-blue-gold-green can be
 * told apart by everyone. Segments that touch have to be from that order.
 */
export const MACRO_STACK: MacroKey[] = ["protein", "fat", "carbs", "fiber"];

/**
 * Group hues match the month calendar's, so a lift is the same colour wherever
 * it appears. The draw order is re-arranged for the same adjacency reason as
 * the macros: Bench (blue) sits between Deadlift (red) and Squat (gold).
 */
export const GROUP_COLOR: Record<string, string> = {
  "Deadlift / Pull": VIZ[0],
  "Bench / Press": VIZ[1],
  "Squat / Legs": VIZ[2],
  "Abs / Core": VIZ[3],
  Other: VIZ[4],
};

export const GROUP_STACK = [
  "Deadlift / Pull",
  "Bench / Press",
  "Squat / Legs",
  "Abs / Core",
  "Other",
] as const;

// A group added to EXERCISE_GROUPS without a colour here would draw as
// transparent. Say so at startup rather than shipping an invisible series.
const uncoloured = EXERCISE_GROUPS.filter((g) => !(g in GROUP_COLOR));
if (uncoloured.length > 0) console.warn("No chart colour for exercise group:", uncoloured);
