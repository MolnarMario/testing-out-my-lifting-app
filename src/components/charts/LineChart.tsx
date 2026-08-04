import { useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChartTip } from "./ChartFrame";
import { useElementWidth } from "../../hooks/useElementWidth";
import { labelIndices, linePath, niceScale, scale, snap } from "../../lib/chart";

export interface LineSeries {
  label: string;
  color: string;
  /** Aligned with `labels`; null is a gap, not a zero. */
  data: (number | null)[];
  dots?: boolean;
  /** Draw the line dashed — used for smoothed or estimated series. */
  dashed?: boolean;
  /** Suppress the line and draw only the markers. */
  dotsOnly?: boolean;
  width?: number;
  opacity?: number;
}

export interface RefLine {
  value: number;
  label: string;
  color?: string;
}

interface Props {
  labels: string[];
  series: LineSeries[];
  height?: number;
  /** Y-axis and tooltip number formatting. */
  yFormat: (value: number) => string;
  /** X-axis label for a data index. */
  xFormat: (label: string) => string;
  /** Tooltip contents for the hovered index; null hides the tooltip. */
  tip: (index: number) => { head: string; rows: { label: string; value: string; color?: string }[] } | null;
  refLines?: RefLine[];
  /** A shaded target range, e.g. 1.6–2.2 g of protein per kg. */
  band?: { from: number; to: number };
  /** Marker indices to call out — PRs on the 1RM chart. */
  highlight?: number[];
  onPick?: (index: number) => void;
  /** Force the axis to include zero even when the data sits well above it. */
  includeZero?: boolean;
}

const PAD = { top: 14, right: 14, bottom: 22, left: 46 };

/**
 * Lines, dots and reference lines on a single shared y-axis.
 *
 * Deliberately single-axis: two measures of different scale get two charts or
 * a shared index, never a second y-axis, which is the fastest way to make a
 * chart say something the data does not.
 */
export function LineChart({
  labels,
  series,
  height = 190,
  yFormat,
  xFormat,
  tip,
  refLines = [],
  band,
  highlight,
  onPick,
  includeZero,
}: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = Math.max(0, height - PAD.top - PAD.bottom);

  const axis = useMemo(() => {
    const values = [
      ...series.flatMap((s) => s.data.filter((v): v is number => v !== null)),
      ...refLines.map((r) => r.value),
      ...(band ? [band.from, band.to] : []),
    ];
    if (values.length === 0) return niceScale(0, 1);

    const lo = includeZero ? Math.min(0, ...values) : Math.min(...values);
    const hi = Math.max(...values);
    return niceScale(lo, hi, 4);
  }, [series, refLines, band, includeZero]);

  const x = (i: number) =>
    labels.length <= 1 ? PAD.left + plotW / 2 : PAD.left + (i / (labels.length - 1)) * plotW;
  const y = (v: number) => scale(v, axis.min, axis.max, PAD.top + plotH, PAD.top);

  const xTicks = useMemo(() => labelIndices(labels.length, plotW > 420 ? 6 : 4), [labels.length, plotW]);

  /**
   * Null-separated runs, so a gap in logging leaves a gap in the line rather
   * than a straight segment implying data that was never there.
   */
  const runs = useMemo(
    () =>
      series.map((s) => {
        const out: { x: number; y: number }[][] = [];
        let current: { x: number; y: number }[] = [];
        s.data.forEach((v, i) => {
          if (v === null) {
            if (current.length > 0) out.push(current);
            current = [];
          } else {
            current.push({ x: x(i), y: y(v) });
          }
        });
        if (current.length > 0) out.push(current);
        return out;
      }),
    // x() and y() are rebuilt every render; the deps are what they read.
    [series, labels, axis, plotW, plotH],
  );

  /** Structural on purpose — the same reader serves pointermove and click. */
  function pointerIndex(e: Pick<ReactPointerEvent<SVGRectElement>, "clientX" | "currentTarget">): number | null {
    if (labels.length === 0 || plotW <= 0) return null;
    const box = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - box.left) / box.width;
    return Math.min(labels.length - 1, Math.max(0, Math.round(pos * (labels.length - 1))));
  }

  const tipData = hover === null ? null : tip(hover);
  const highlighted = new Set(highlight ?? []);

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

          {band && (
            <rect
              className="chart-band"
              x={PAD.left}
              y={snap(y(band.to))}
              width={plotW}
              height={Math.max(0, snap(y(band.from) - y(band.to)))}
              fill="var(--good)"
            />
          )}

          {refLines.map((r) => (
            <g key={r.label}>
              <line
                className="chart-ref"
                x1={PAD.left}
                x2={width - PAD.right}
                y1={snap(y(r.value))}
                y2={snap(y(r.value))}
                stroke={r.color ?? "var(--muted)"}
              />
              <text x={width - PAD.right} y={snap(y(r.value)) - 5} textAnchor="end" fill={r.color ?? "var(--muted)"}>
                {r.label}
              </text>
            </g>
          ))}

          {/* The top panel of a small-multiples pair formats to "", and an
              empty <text> is markup for nothing — skip it rather than emit it. */}
          {labels.map((label, i) =>
            xTicks.has(i) && xFormat(label) !== "" ? (
              <text key={label} x={snap(x(i))} y={height - 6} textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}>
                {xFormat(label)}
              </text>
            ) : null,
          )}

          {hover !== null && (
            <line className="chart-crosshair" x1={snap(x(hover))} x2={snap(x(hover))} y1={PAD.top} y2={PAD.top + plotH} />
          )}

          {series.map((s, si) => (
            <g key={s.label} opacity={s.opacity ?? 1}>
              {!s.dotsOnly &&
                runs[si].map((run, ri) => (
                  <path
                    key={ri}
                    className="chart-line"
                    d={linePath(run)}
                    stroke={s.color}
                    strokeWidth={s.width ?? 2}
                    strokeDasharray={s.dashed ? "5 4" : undefined}
                  />
                ))}

              {(s.dots || s.dotsOnly) &&
                s.data.map((v, i) =>
                  v === null ? null : (
                    <circle
                      key={i}
                      className={highlighted.has(i) ? "chart-pr" : "chart-dot"}
                      cx={snap(x(i))}
                      cy={snap(y(v))}
                      r={highlighted.has(i) ? 5 : hover === i ? 5 : 3.5}
                      fill={highlighted.has(i) ? undefined : s.color}
                    />
                  ),
                )}
            </g>
          ))}

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

      {tipData && hover !== null && (
        <ChartTip at={labels.length <= 1 ? 0.5 : hover / (labels.length - 1)} {...tipData} />
      )}
    </div>
  );
}
