import type { Unit } from "./types";

const KG_PER_LB = 0.45359237;

export function toKg(value: number, unit: Unit): number {
  return unit === "kg" ? value : value * KG_PER_LB;
}

export function fromKg(kg: number, unit: Unit): number {
  return unit === "kg" ? kg : kg / KG_PER_LB;
}

export function convert(value: number, from: Unit, to: Unit): number {
  if (from === to) return value;
  return fromKg(toKg(value, from), to);
}

export function roundWeight(value: number, unit: Unit): number {
  const step = unit === "kg" ? 0.5 : 1;
  return Math.round(value / step) * step;
}

/**
 * Weights are stored canonically in kg. Snap to 2dp before storing: finer than
 * any plate increment, and coarse enough that showing the value in lb (also 2dp)
 * and saving it back is lossless. Without this, re-saving an untouched set while
 * in lb walks the value — 100 kg becomes 99.9989738902.
 */
export function roundKg(kg: number): number {
  return Math.round(kg * 100) / 100;
}

export function formatWeight(value: number, unit: Unit): string {
  const decimals = unit === "kg" ? 1 : 0;
  return value.toFixed(decimals).replace(/\.0$/, "");
}

/** Epley estimate. Returns the weight itself for a single. */
export function estimate1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

/** Minutes since midnight for an "HH:MM" value, or null when unparseable. */
export function parseTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Elapsed minutes from start to end, rolling past midnight when end < start. */
export function durationBetween(start: string, end: string): number | null {
  const a = parseTime(start);
  const b = parseTime(end);
  if (a === null || b === null) return null;
  return b >= a ? b - a : b + 24 * 60 - a;
}

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return dateKey(new Date());
}

export function addDays(key: string, delta: number): string {
  const d = keyToDate(key);
  d.setDate(d.getDate() + delta);
  return dateKey(d);
}

const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatDateLong(key: string): string {
  const d = keyToDate(key);
  if (key === todayKey()) return `Today, ${MONTH_LONG[d.getMonth()]} ${d.getDate()}`;
  return `${WEEKDAY_LONG[d.getDay()]}, ${MONTH_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function formatDateShort(key: string): string {
  const d = keyToDate(key);
  return `${MONTH_LONG[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
