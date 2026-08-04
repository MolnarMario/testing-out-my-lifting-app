import { formatDateShort, todayKey } from "../../lib/format";
import type { HeatCell } from "../../lib/stats";

interface Props {
  cells: HeatCell[];
  weeks: string[];
  onPick?: (key: string) => void;
}

const DOWS = ["M", "", "W", "", "F", "", "S"];

/** Five steps of one hue: more sets, more colour. Step 0 is the empty track. */
const STEPS = [
  "var(--surface-2)",
  "rgba(231,64,46,.22)",
  "rgba(231,64,46,.42)",
  "rgba(231,64,46,.66)",
  "var(--accent)",
];

function stepFor(sets: number, max: number): number {
  if (sets <= 0) return 0;
  if (max <= 1) return STEPS.length - 1;
  // Quartiles of the busiest day in view, so the ramp adapts to the lifter.
  return Math.min(STEPS.length - 1, 1 + Math.floor(((sets - 1) / max) * (STEPS.length - 1)));
}

/**
 * A year of training at a glance: one column per week, Monday at the top.
 * The month calendar answers "what did I do that day"; this answers "have I
 * actually been showing up", which no per-month view can.
 */
export function Heatmap({ cells, weeks, onPick }: Props) {
  const max = Math.max(1, ...cells.map((c) => c.sets));
  const today = todayKey();

  const byWeek = weeks.map((_, i) => {
    const column = new Array<HeatCell | null>(7).fill(null);
    for (const cell of cells) if (cell.week === i) column[cell.weekday] = cell;
    return column;
  });

  // Label a column only when its month differs from the column before it.
  const monthLabels = weeks.map((week, i) => {
    const month = week.slice(0, 7);
    if (i > 0 && weeks[i - 1].slice(0, 7) === month) return "";
    return formatDateShort(week).split(" ")[0];
  });

  return (
    <>
      <div className="month-scroll">
        <div className="heat">
          <div className="heat-dows" aria-hidden="true">
            {DOWS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          <div className="heat-cols">
            {byWeek.map((column, i) => (
              <div className="heat-col" key={weeks[i]}>
                <span className="heat-mon" aria-hidden="true">
                  {monthLabels[i]}
                </span>
                {column.map((cell, row) => {
                  if (!cell) return <span className="heat-cell" key={row} style={{ opacity: 0 }} />;
                  const lit = cell.sets > 0;
                  const classes = [
                    "heat-cell",
                    lit ? "lit" : "",
                    cell.key === today ? "today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      key={row}
                      className={classes}
                      style={{ background: STEPS[stepFor(cell.sets, max)] }}
                      disabled={!lit}
                      title={`${formatDateShort(cell.key)} — ${cell.sets} ${cell.sets === 1 ? "set" : "sets"}`}
                      aria-label={`${formatDateShort(cell.key)}, ${lit ? `${cell.sets} sets` : "rest"}`}
                      onClick={() => lit && onPick?.(cell.key)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="heat-scale">
        Rest
        {STEPS.map((step) => (
          <i key={step} style={{ background: step, border: "1px solid var(--border)" }} />
        ))}
        {max} sets
      </div>
    </>
  );
}
