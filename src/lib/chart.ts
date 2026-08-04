/**
 * Chart geometry, kept free of React and of the DOM so it can be unit-tested
 * with plain node. Everything here works in chart space: values in, SVG user
 * units out.
 */

export interface Pt {
  x: number;
  y: number;
}

/** A day's worth of a series. `value` is null on days with nothing logged. */
export interface Datum {
  key: string;
  value: number | null;
}

/**
 * Round a number to at most `places` decimals and hand back a plain number.
 * SVG coordinates carry no meaning past two decimals, and trimming them keeps
 * path strings short enough to read while debugging.
 */
export function snap(value: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

/**
 * Maps a value in [d0,d1] onto [r0,r1]. A zero-width domain would divide by
 * zero, so it collapses to the middle of the range instead — a flat series
 * draws as a line through the centre rather than vanishing.
 */
export function scale(value: number, d0: number, d1: number, r0: number, r1: number): number {
  if (d1 === d0) return (r0 + r1) / 2;
  return r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
}

/**
 * Axis ticks on 1/2/5×10^n steps covering [min,max]. Returns the tick values
 * plus the rounded-out domain they imply, so the axis and the plot agree.
 */
export function niceScale(
  min: number,
  max: number,
  count = 4,
): { ticks: number[]; min: number; max: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { ticks: [0, 1], min: 0, max: 1 };
  if (min === max) {
    // A single distinct value still deserves a readable axis around it.
    const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 1;
    min -= pad;
    max += pad;
  }

  const raw = (max - min) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  // Geometric-midpoint thresholds, so a step is rounded to the *nearest* of
  // 1/2/5/10 rather than always up — otherwise a 0–100 axis lands on 0/50/100.
  const step = (norm >= Math.SQRT2 * 5 ? 10 : norm >= Math.sqrt(10) ? 5 : norm >= Math.SQRT2 ? 2 : 1) * mag;

  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;

  const ticks: number[] = [];
  // Accumulating with multiplication rather than += avoids float drift piling
  // up across a long axis (0.30000000000000004 and friends).
  for (let i = 0; lo + i * step <= hi + step / 1e6; i++) ticks.push(snap(lo + i * step, 6));

  return { ticks, min: lo, max: hi };
}

/** Polyline through the points. Empty string for fewer than two points. */
export function linePath(points: Pt[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${snap(p.x)} ${snap(p.y)}`).join(" ");
}

/** The same polyline closed down to a baseline, for a filled area. */
export function areaPath(points: Pt[], baselineY: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath(points)} L${snap(last.x)} ${snap(baselineY)} L${snap(first.x)} ${snap(baselineY)} Z`;
}

/**
 * A column with its top corners rounded and its base square, so the mark stays
 * anchored to the baseline. The radius shrinks on short bars rather than
 * bulging past them.
 */
export function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  const radius = Math.max(0, Math.min(r, w / 2, h));
  if (h <= 0) return "";
  const x2 = x + w;
  const y2 = y + h;
  return [
    `M${snap(x)} ${snap(y2)}`,
    `L${snap(x)} ${snap(y + radius)}`,
    `Q${snap(x)} ${snap(y)} ${snap(x + radius)} ${snap(y)}`,
    `L${snap(x2 - radius)} ${snap(y)}`,
    `Q${snap(x2)} ${snap(y)} ${snap(x2)} ${snap(y + radius)}`,
    `L${snap(x2)} ${snap(y2)}`,
    "Z",
  ].join(" ");
}

/**
 * Trailing mean over the last `window` entries that have a value. Days with
 * nothing logged are skipped rather than counted as zero — a missed day should
 * not drag the average down, it should simply not contribute.
 *
 * Returns null until at least one value has been seen.
 */
export function rollingMean(data: Datum[], window: number): (number | null)[] {
  return data.map((_, i) => {
    const from = Math.max(0, i - window + 1);
    let sum = 0;
    let n = 0;
    for (let j = from; j <= i; j++) {
      const v = data[j].value;
      if (v !== null) {
        sum += v;
        n++;
      }
    }
    return n === 0 ? null : sum / n;
  });
}

/**
 * Exponentially weighted trend, the shape a bodyweight chart wants: it follows
 * the drift without chasing every water-weight spike. Gaps hold the previous
 * trend value rather than resetting it.
 */
export function ema(data: Datum[], alpha = 0.25): (number | null)[] {
  let prev: number | null = null;
  return data.map((d) => {
    if (d.value === null) return prev;
    prev = prev === null ? d.value : alpha * d.value + (1 - alpha) * prev;
    return prev;
  });
}

/**
 * Half-life expressed in days, converted to the smoothing factor. A 7-day
 * half-life means a reading counts half as much a week later — gentle enough
 * to ignore a heavy dinner, quick enough to show a real drop.
 */
export function alphaForHalfLife(days: number): number {
  return 1 - 2 ** (-1 / days);
}

// --- date bucketing ----------------------------------------------------------
// Kept here rather than in format.ts: these are chart-axis concerns, and
// format.ts is about how a single date is written out.

const DAY_MS = 86400000;

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole days between two keys, ignoring DST shifts within the day. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseKey(to).getTime() - parseKey(from).getTime()) / DAY_MS);
}

/** Every date key from `from` to `to` inclusive. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const end = parseKey(to);
  for (const d = parseKey(from); d <= end; d.setDate(d.getDate() + 1)) out.push(toKey(d));
  return out;
}

/** The Monday on or before this date — weeks run Mon–Sun, as the calendars do. */
export function weekStart(key: string): string {
  const d = parseKey(key);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toKey(d);
}

/** Every week-start key from the week containing `from` through `to`. */
export function eachWeek(from: string, to: string): string[] {
  const out: string[] = [];
  const end = parseKey(weekStart(to));
  for (const d = parseKey(weekStart(from)); d <= end; d.setDate(d.getDate() + 7)) out.push(toKey(d));
  return out;
}

/**
 * Picks roughly `target` evenly spread indices to label, always including the
 * last one. Axis labels collide long before the marks do, so the axis shows a
 * subset while every mark stays drawn.
 */
export function labelIndices(count: number, target = 6): Set<number> {
  const out = new Set<number>();
  if (count <= 0) return out;
  if (count <= target) {
    for (let i = 0; i < count; i++) out.add(i);
    return out;
  }
  const step = (count - 1) / (target - 1);
  for (let i = 0; i < target; i++) out.add(Math.round(i * step));
  return out;
}
