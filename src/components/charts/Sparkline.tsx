import { linePath, scale, snap } from "../../lib/chart";

interface Props {
  /** Nulls are gaps; the line breaks rather than dropping to zero. */
  data: (number | null)[];
  color?: string;
  width?: number;
  height?: number;
}

/**
 * The shape of a number over the range, drawn small enough to live inside a
 * stat tile. No axis and no labels on purpose — the tile carries the value, and
 * this only has to answer "up or down".
 */
export function Sparkline({ data, color = "var(--viz-mark-hi)", width = 100, height = 20 }: Props) {
  const points = data.filter((v): v is number => v !== null);
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const pad = 2;

  const runs: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];

  data.forEach((v, i) => {
    if (v === null) {
      if (current.length > 0) runs.push(current);
      current = [];
      return;
    }
    current.push({
      x: snap(scale(i, 0, Math.max(1, data.length - 1), 0, width)),
      y: snap(scale(v, min, max, height - pad, pad)),
    });
  });
  if (current.length > 0) runs.push(current);

  return (
    <svg
      className="spark"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {runs.map((run, i) => (
        <path key={i} d={linePath(run)} stroke={color} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
