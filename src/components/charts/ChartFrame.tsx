import type { ReactNode } from "react";

export interface LegendItem {
  label: string;
  color: string;
  /** Draw the swatch as a line rather than a block — for overlays and trends. */
  line?: boolean;
  /** A dashed line swatch, for reference lines the plot has no room to label. */
  dashed?: boolean;
}

interface Props {
  title: string;
  /** Small right-aligned note in the card head — usually the range or a total. */
  note?: ReactNode;
  legend?: LegendItem[];
  /** Sentence describing the chart for screen readers and for the empty state. */
  summary: string;
  /** The same data in text, so the chart is never the only way to read it. */
  table?: { head: string[]; rows: (string | number)[][] };
  /** When set, the chart is replaced by this message. */
  empty?: string | null;
  children: ReactNode;
}

/**
 * The shell every chart sits in: card, heading, legend, and the screen-reader
 * table. Written once here so no individual chart can forget the accessible
 * half — the SVG itself is always aria-hidden and the table carries the data.
 *
 * A legend is drawn for two or more series and omitted for one, where the title
 * already names what is plotted.
 */
export function ChartFrame({ title, note, legend, summary, table, empty, children }: Props) {
  const showLegend = !empty && legend && legend.length >= 2;

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">{title}</div>
        {note && <span className="card-note">{note}</span>}
      </div>

      {empty ? (
        <div className="mc-empty" style={{ marginTop: 14 }}>
          <span className="mc-pin">Not enough data yet</span>
          {empty}
        </div>
      ) : (
        <figure className="chart-fig">
          <figcaption className="sr-only">{summary}</figcaption>
          {children}

          {showLegend && (
            <div className="chart-legend">
              {legend.map((item) => (
                <span className="chart-leg" key={item.label}>
                  <span
                    className={item.line || item.dashed ? "chart-leg-dot line" : "chart-leg-dot"}
                    style={
                      item.dashed
                        ? { backgroundImage: `repeating-linear-gradient(90deg, ${item.color} 0 4px, transparent 4px 7px)` }
                        : { background: item.color }
                    }
                  />
                  {item.label}
                </span>
              ))}
            </div>
          )}

          {/* The wrapper carries .sr-only, not the table: table layout treats
              width as a minimum and ignores the 1px, so a bare .sr-only table
              lays out at full content width and widens the whole document. */}
          {table && (
            <div className="sr-only">
            <table>
              <caption>{title}</caption>
              <thead>
                <tr>
                  {table.head.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </figure>
      )}
    </div>
  );
}

interface TipProps {
  /** 0..1 across the plot, used to place the tooltip and flip it near an edge. */
  at: number;
  head: string;
  rows: { label: string; value: string; color?: string; tone?: "over" | "under" }[];
}

/**
 * The hover readout. Positioned in percent so it tracks the mark through a
 * resize, and clamped away from both edges so it never spills out of the card.
 */
export function ChartTip({ at, head, rows }: TipProps) {
  const clamped = Math.min(0.88, Math.max(0.12, at));

  return (
    <div className="chart-tip" style={{ left: `${clamped * 100}%`, top: -6 }}>
      <div className="chart-tip-head">{head}</div>
      {rows.map((row) => (
        <div className="chart-tip-row" key={row.label}>
          {row.color && <span className="chart-tip-dot" style={{ background: row.color }} />}
          <span className="k">{row.label}</span>
          <span className={row.tone ? `v ${row.tone}` : "v"}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
