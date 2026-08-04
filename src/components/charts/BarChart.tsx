import { useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChartTip } from "./ChartFrame";
import { useElementWidth } from "../../hooks/useElementWidth";
import { barPath, labelIndices, linePath, niceScale, scale, snap } from "../../lib/chart";

export interface BarSeries {
  label: string;
  color: string;
  data: number[];
}

interface Props {
  labels: string[];
  /** More than one series stacks; the draw order is the array order. */
  series: BarSeries[];
  /** Normalise each column to 100 % — for composition over time. */
  percent?: boolean;
  height?: number;
  yFormat: (value: number) => string;
  xFormat: (label: string) => string;
  tip: (index: number) => { head: string; rows: { label: string; value: string; color?: string; tone?: "over" | "under" }[] } | null;
  /** A line drawn over the columns — the rolling average on the calorie chart. */
  overlay?: { label: string; color: string; data: (number | null)[] };
  refLine?: { value: number; label: string; color?: string };
  onPick?: (index: number) => void;
}

const PAD = { top: 14, right: 14, bottom: 22, left: 46 };
/** Surface showing between segments is what separates them without a second colour. */
const SEGMENT_GAP = 2;

/**
 * Columns, stacked or plain, with an optional overlay line and target line.
 *
 * Bars are anchored to the baseline with only their top corners rounded, so a
 * short column still reads as starting at zero.
 */
export function BarChart({
  labels,
  series,
  percent,
  height = 190,
  yFormat,
  xFormat,
  tip,
  overlay,
  refLine,
  onPick,
}: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = Math.max(0, height - PAD.top - PAD.bottom);

  const totals = useMemo(
    () => labels.map((_, i) => series.reduce((sum, s) => sum + (s.data[i] ?? 0), 0)),
    [labels, series],
  );

  const axis = useMemo(() => {
    if (percent) return { ticks: [0, 0.25, 0.5, 0.75, 1], min: 0, max: 1 };
    const values = [
      ...totals,
      ...(overlay?.data.filter((v): v is number => v !== null) ?? []),
      ...(refLine ? [refLine.value] : []),
    ];
    return niceScale(0, values.length === 0 ? 1 : Math.max(...values), 4);
  }, [totals, overlay, refLine, percent]);

  const step = labels.length === 0 ? 0 : plotW / labels.length;
  // Slim marks with room to breathe, but never so thin they stop being a bar.
  const barW = Math.max(2, Math.min(28, step * 0.66));
  const x = (i: number) => PAD.left + step * i + step / 2;
  const y = (v: number) => scale(v, axis.min, axis.max, PAD.top + plotH, PAD.top);
  const baseY = PAD.top + plotH;

  const xTicks = useMemo(() => labelIndices(labels.length, plotW > 420 ? 6 : 4), [labels.length, plotW]);

  const overlayRuns = useMemo(() => {
    if (!overlay) return [];
    const out: { x: number; y: number }[][] = [];
    let current: { x: number; y: number }[] = [];
    overlay.data.forEach((v, i) => {
      if (v === null) {
        if (current.length > 0) out.push(current);
        current = [];
      } else {
        current.push({ x: x(i), y: y(v) });
      }
    });
    if (current.length > 0) out.push(current);
    return out;
  }, [overlay, labels, axis, plotW, plotH]);

  /** Structural on purpose — the same reader serves pointermove and click. */
  function pointerIndex(e: Pick<ReactPointerEvent<SVGRectElement>, "clientX" | "currentTarget">): number | null {
    if (labels.length === 0 || plotW <= 0) return null;
    const box = e.currentTarget.getBoundingClientRect();
    const pos = ((e.clientX - box.left) / box.width) * width - PAD.left;
    return Math.min(labels.length - 1, Math.max(0, Math.floor(pos / step)));
  }

  const tipData = hover === null ? null : tip(hover);

  return (
    <div className={hover === null ? "chart-wrap" : "chart-wrap hovering"} ref={ref}>
      {width > 0 && (
        <svg className="chart-svg" width={width} height={height} aria-hidden="true">
          {axis.ticks.map((t) => (
            <g key={t}>
              <line className="chart-grid" x1={PAD.left} x2={width - PAD.right} y1={snap(y(t))} y2={snap(y(t))} />
              <text x={PAD.left - 8} y={snap(y(t)) + 3.5} textAnchor="end">
                {yFormat(t)}
              </text>
            </g>
          ))}

          {labels.map((label, i) => {
            const total = percent ? (totals[i] === 0 ? 0 : 1) : totals[i];
            if (total <= 0) return null;

            // Stack upward from the baseline, in series order.
            let cursor = 0;
            return (
              <g key={label} className={hover === i ? "chart-bar on" : "chart-bar"}>
                {series.map((s, si) => {
                  const raw = s.data[i] ?? 0;
                  const value = percent ? (totals[i] === 0 ? 0 : raw / totals[i]) : raw;
                  if (value <= 0) return null;

                  const top = y(cursor + value);
                  const bottom = y(cursor);
                  cursor += value;

                  // Only the topmost drawn segment keeps rounded corners; the
                  // gap below every upper segment is what separates them.
                  const isTop = series.slice(si + 1).every((rest) => (rest.data[i] ?? 0) <= 0);
                  const gap = si === 0 ? 0 : SEGMENT_GAP;
                  const h = Math.max(0, bottom - top - gap);

                  return (
                    <path
                      key={s.label}
                      d={barPath(x(i) - barW / 2, top, barW, h, isTop ? 4 : 0)}
                      fill={s.color}
                    />
                  );
                })}
              </g>
            );
          })}

          {refLine && (
            <g>
              <line
                className="chart-ref"
                x1={PAD.left}
                x2={width - PAD.right}
                y1={snap(y(refLine.value))}
                y2={snap(y(refLine.value))}
                stroke={refLine.color ?? "var(--muted)"}
              />
              <text x={width - PAD.right} y={snap(y(refLine.value)) - 5} textAnchor="end" fill={refLine.color ?? "var(--muted)"}>
                {refLine.label}
              </text>
            </g>
          )}

          {overlay &&
            overlayRuns.map((run, i) => (
              <path key={i} className="chart-line" d={linePath(run)} stroke={overlay.color} />
            ))}

          {labels.map((label, i) =>
            xTicks.has(i) ? (
              <text key={label} x={snap(x(i))} y={height - 6} textAnchor="middle">
                {xFormat(label)}
              </text>
            ) : null,
          )}

          <line className="chart-baseline" x1={PAD.left} x2={width - PAD.right} y1={baseY} y2={baseY} />

          <rect
            className="chart-hit"
            x={0}
            y={0}
            width={width}
            height={height}
            onPointerMove={(e) => setHover(pointerIndex(e))}
            onPointerLeave={() => setHover(null)}
            onClick={(e) => {
              const i = pointerIndex(e);
              if (i !== null && onPick) onPick(i);
            }}
          />
        </svg>
      )}

      {tipData && hover !== null && width > 0 && (
        <ChartTip at={(PAD.left + step * hover + step / 2) / width} {...tipData} />
      )}
    </div>
  );
}
