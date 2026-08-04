export type TabKey = "workout" | "plates" | "food";

export type Unit = "kg" | "lb";

export type Stance = "conventional" | "sumo";

export type IntensityType = "rpe" | "pct" | "none";

export const READINESS_KEYS = [
  "motivation",
  "sleep",
  "calories",
  "protein",
  "hydration",
  "stimulants",
] as const;

export type ReadinessKey = (typeof READINESS_KEYS)[number];

export type Readiness = Record<ReadinessKey, number>;

/** Cells per readiness meter — a score runs 0..READINESS_MAX. */
export const READINESS_MAX = 5;

export interface SetEntry {
  id: string;
  /** Groups the sets that were logged together in one go. */
  groupId: string;
  exerciseId: string;
  weight: number;
  reps: number;
  stance?: Stance;
  intensityType: IntensityType;
  intensityValue: number | null;
  /**
   * Gear is recorded by exception, the way lifters actually talk about it: a
   * belted squat is the default, so it is the beltless one worth noting.
   */
  beltless?: boolean;
  straps?: boolean;
  kneeGear?: string | null;
}

export interface DayLog {
  sets: SetEntry[];
  readinessOn: boolean;
  readiness: Readiness;
  notesOn: boolean;
  notes: string;
  /** "HH:MM" as produced by <input type="time">, or "" when unset. */
  sessionStart: string;
  sessionEnd: string;
  /** Overrides the start/end calculation when set. */
  manualDurationMin: number | null;
  /** How the session itself went, 0..READINESS_MAX. */
  rating: number;
}

export interface Exercise {
  id: string;
  name: string;
  group: string;
  isCustom?: boolean;
  /** Conventional/sumo applies (deadlift variants). */
  hasStance?: boolean;
  /** Offer the gear toggles this movement is actually done with. */
  belt?: boolean;
  straps?: boolean;
  kneeGear?: boolean;
  /** Held for time rather than counted in reps. */
  timed?: boolean;
}

export function emptyReadiness(): Readiness {
  return {
    motivation: 0,
    sleep: 0,
    calories: 0,
    protein: 0,
    hydration: 0,
    stimulants: 0,
  };
}

export function emptyDay(): DayLog {
  return {
    sets: [],
    readinessOn: false,
    readiness: emptyReadiness(),
    notesOn: false,
    notes: "",
    sessionStart: "",
    sessionEnd: "",
    manualDurationMin: null,
    rating: 0,
  };
}
