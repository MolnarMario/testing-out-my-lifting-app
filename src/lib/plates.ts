import type { Unit } from "./types";

/**
 * Everything in this module works in the *displayed* unit, not the canonical
 * kilograms the workout log stores. A plate loader is a calculator over the
 * plates physically in front of you: in lb mode the bar really is 45 lb and the
 * plates really are 45/35/25s, not converted kilos.
 */

export interface PlateSpec {
  weight: number;
  label: string;
  color: string;
  /** Rendered size in px, at the rig's natural scale. */
  h: number;
  w: number;
  metal?: boolean;
  black?: boolean;
  iron?: boolean;
}

const COLORS = {
  p25: "#c8312a",
  p20: "#2660c4",
  p15: "#f0c41b",
  p10: "#1f9d57",
  p5: "#e9eaee",
  p2: "#24282f",
  p1: "#aeb6c2",
};

const KG_PLATES: PlateSpec[] = [
  { weight: 25, label: "25 kg", color: COLORS.p25, h: 225, w: 13.5 },
  { weight: 20, label: "20 kg", color: COLORS.p20, h: 225, w: 12 },
  { weight: 15, label: "15 kg", color: COLORS.p15, h: 200, w: 11 },
  { weight: 10, label: "10 kg", color: COLORS.p10, h: 162.5, w: 10.5 },
  { weight: 5, label: "5 kg", color: COLORS.p5, h: 114, w: 10 },
  { weight: 2.5, label: "2.5 kg", color: COLORS.p2, h: 95, w: 10 },
  { weight: 1.25, label: "1.25 kg", color: COLORS.p1, h: 80, w: 8.5, metal: true },
];

/** Competition micro plates, only offered in kg once a load rounds down. */
const KG_PLATES_RECORD: PlateSpec[] = [
  ...KG_PLATES,
  { weight: 0.5, label: "0.5 kg", color: COLORS.p1, h: 65, w: 5.5, metal: true },
  { weight: 0.25, label: "0.25 kg", color: COLORS.p1, h: 55, w: 4.5, metal: true },
];

const LB_PLATES: PlateSpec[] = [
  { weight: 45, label: "45 lb", color: COLORS.p2, h: 222, w: 25, black: true, iron: true },
  { weight: 35, label: "35 lb", color: COLORS.p2, h: 178, w: 16.5, black: true, iron: true },
  { weight: 25, label: "25 lb", color: COLORS.p2, h: 138, w: 27, black: true, iron: true },
  { weight: 10, label: "10 lb", color: COLORS.p2, h: 113, w: 11.5, black: true, iron: true },
  { weight: 5, label: "5 lb", color: COLORS.p2, h: 98, w: 7.5, black: true, iron: true },
  { weight: 2.5, label: "2.5 lb", color: COLORS.p2, h: 80, w: 6.5, black: true, iron: true },
];

export type BarDimsKey = 15 | 20 | 25 | 30;

export interface BarOption {
  weight: number;
  label: string;
  dimsKey: BarDimsKey;
}

export interface RigDims {
  barTh: number;
  sleeveTh: number;
  sleeveLen: number;
  ringMark: number;
  plateMax: number;
  collarW: number;
}

/** Sleeve/shaft geometry per bar type, in px at natural scale. */
export const RIG_DIMS: Record<BarDimsKey, RigDims> = {
  15: { barTh: 12.5, sleeveTh: 25, sleeveLen: 159, ringMark: 125, plateMax: 225, collarW: 24 },
  20: { barTh: 14.5, sleeveTh: 25, sleeveLen: 216.5, ringMark: 125, plateMax: 225, collarW: 12 },
  25: { barTh: 16, sleeveTh: 25, sleeveLen: 215, ringMark: 150, plateMax: 225, collarW: 60 },
  30: { barTh: 17.5, sleeveTh: 25, sleeveLen: 238, ringMark: 150, plateMax: 225, collarW: 60 },
};

export const SHAFT_LEN = 120;

export interface UnitConfig {
  plates: PlateSpec[];
  platesRecord: PlateSpec[];
  bars: BarOption[];
  collars: number;
  collarsLabel: string;
  maxWeight: number;
  step: number;
  maxOptions: number[];
  addChips: number[];
  unit: Unit;
  secondary: Unit;
  toSecondary: (v: number) => string;
  /** Past the all-time raw total — nobody is lifting this. */
  eggLimit: number;
  /** Women's-bar world record threshold. */
  iwfLimit: number;
}

/** The women's bar; loading it past iwfLimit is the record easter egg. */
export const IWF_BAR_DIMS: BarDimsKey = 15;

export const PLATE_CONFIG: Record<Unit, UnitConfig> = {
  kg: {
    plates: KG_PLATES,
    platesRecord: KG_PLATES_RECORD,
    bars: [
      { weight: 15, label: "15 kg", dimsKey: 15 },
      { weight: 20, label: "20 kg", dimsKey: 20 },
      { weight: 25, label: "25 kg", dimsKey: 25 },
      { weight: 30, label: "30 kg", dimsKey: 30 },
    ],
    collars: 5,
    collarsLabel: "5 kg",
    maxWeight: 515,
    step: 2.5,
    maxOptions: [100, 150, 200, 250, 300, 350, 400, 450, 500, 515],
    addChips: [1.25, 2.5, 5, 10, 15, 20, 25],
    unit: "kg",
    secondary: "lb",
    toSecondary: (v) => (v * 2.20462).toFixed(1),
    eggLimit: 635.4,
    iwfLimit: 193,
  },
  lb: {
    plates: LB_PLATES,
    platesRecord: LB_PLATES,
    bars: [
      { weight: 33, label: "33 lb", dimsKey: 15 },
      { weight: 45, label: "45 lb", dimsKey: 20 },
      { weight: 55, label: "55 lb", dimsKey: 25 },
      { weight: 66, label: "66 lb", dimsKey: 30 },
    ],
    collars: 1,
    collarsLabel: "1 lb",
    maxWeight: 1135,
    step: 5,
    maxOptions: [220, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1135],
    addChips: [2.5, 5, 10, 25, 35, 45],
    unit: "lb",
    secondary: "kg",
    toSecondary: (v) => (v * 0.453592).toFixed(1),
    eggLimit: 1400.8,
    iwfLimit: 425.5,
  },
};

export interface PlateDefaults {
  requested: number | null;
  barWeight: number;
  collarsWeight: number;
  recordMode: boolean;
  barDimsKey: BarDimsKey;
  sliderMax: number;
}

export function defaultsFor(unit: Unit): PlateDefaults {
  return unit === "lb"
    ? {
        requested: 225,
        barWeight: 45,
        collarsWeight: 0,
        recordMode: false,
        barDimsKey: 20,
        sliderMax: PLATE_CONFIG.lb.maxWeight,
      }
    : {
        requested: 125,
        barWeight: 20,
        collarsWeight: 5,
        recordMode: false,
        barDimsKey: 20,
        sliderMax: PLATE_CONFIG.kg.maxWeight,
      };
}

// Plate weights go to 0.25; work in thousandths so the greedy loop is exact.
const milli = (n: number) => Math.round(n * 1000);
const unMilli = (n: number) => n / 1000;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Trims float noise: 102.50 -> "102.5", 100 -> "100". */
export const fmt = (n: number) => Number(n.toFixed(2)).toString();

export const round2 = (n: number) => Math.round(n * 100) / 100;

export type LoadStatus = "empty" | "below-min" | "exact" | "rounded";

export interface LoadedPlate {
  plate: PlateSpec;
  count: number;
}

export interface LoadResult {
  plates: LoadedPlate[];
  status: LoadStatus;
  totalWeight: number;
  perSideWeight: number;
  /** How much the greedy fill fell short of the request, both sides combined. */
  shortBy: number;
  minWeight: number;
}

/**
 * Greedy fill, heaviest plate first. Plates load in pairs, so we solve for one
 * sleeve and double. Greedy is optimal here because every real plate set is
 * canonical (each denomination divides the next one up).
 */
export function solveLoad(
  requested: number | null,
  barWeight: number,
  collarsWeight: number,
  plates: PlateSpec[],
): LoadResult {
  const minWeight = barWeight + collarsWeight;
  const empty: LoadResult = {
    plates: [],
    status: "empty",
    totalWeight: 0,
    perSideWeight: 0,
    shortBy: 0,
    minWeight,
  };

  if (requested === null || !Number.isFinite(requested) || requested <= 0) return empty;

  if (milli(requested) < milli(minWeight)) {
    return { ...empty, status: "below-min", totalWeight: minWeight };
  }

  let remaining = (milli(requested) - milli(minWeight)) / 2;
  const loaded: LoadedPlate[] = [];

  for (const plate of plates) {
    const step = milli(plate.weight);
    const count = Math.floor(remaining / step);
    if (count > 0) {
      loaded.push({ plate, count });
      remaining -= count * step;
    }
  }

  const usedPerSide = (milli(requested) - milli(minWeight)) / 2 - remaining;

  return {
    plates: loaded,
    status: remaining > 0 ? "rounded" : "exact",
    totalWeight: unMilli(milli(minWeight) + usedPerSide * 2),
    perSideWeight: unMilli(usedPerSide),
    shortBy: unMilli(remaining * 2),
    minWeight,
  };
}

/**
 * Nudges a request onto a weight the plates can actually make. Skipped in kg
 * record mode, where micro plates make finer numbers reachable.
 */
export function snapRequest(
  requested: number | null,
  unit: Unit,
  barWeight: number,
  collarsWeight: number,
  recordMode: boolean,
  maxWeight: number,
): { value: number | null; snapped: boolean } {
  if (requested === null || !Number.isFinite(requested) || requested <= 0) {
    return { value: requested, snapped: false };
  }

  const min = barWeight + collarsWeight;
  const step = unit === "lb" ? 5 : 2.5;

  if (unit === "lb" || !recordMode) {
    const snapped = clamp(min + Math.round((requested - min) / step) * step, min, maxWeight);
    if (Math.abs(snapped - requested) > 0.01) return { value: snapped, snapped: true };
  }

  return { value: requested, snapped: false };
}

export function plateModifierClass(p: PlateSpec): string {
  if (p.metal) return " pl-plate--metal";
  let out = "";
  if (p.black) out += " pl-plate--black";
  if (p.iron) out += " pl-plate--iron";
  if (!p.black && !p.iron) {
    if (p.weight === 5) out += " pl-plate--white";
    if (p.weight === 2.5) out += " pl-plate--black";
  }
  return out;
}

export function legendChipClass(p: PlateSpec): string {
  if (p.metal) return " pl-lchip--metal";
  if (p.black) return "";
  return p.weight === 5 ? " pl-lchip--white" : "";
}

/** Readable text/border for a legend chip painted in the plate's own colour. */
export function plateInk(p: PlateSpec): { ink: string; bd: string } {
  const dark = { ink: "#181b20", bd: "rgba(0,0,0,.38)" };
  if (p.metal) return dark;

  const hex = p.color.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

  return luminance > 0.52 ? dark : { ink: "#f6f3ec", bd: "rgba(255,255,255,.28)" };
}
