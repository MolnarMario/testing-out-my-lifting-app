import { addDays, todayKey } from "../../lib/format";
import type { Range } from "../../lib/stats";

export type RangeKey = "4w" | "12w" | "6m" | "all";

const OPTIONS: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "4w", label: "4W", days: 28 },
  { key: "12w", label: "12W", days: 84 },
  { key: "6m", label: "6M", days: 182 },
  { key: "all", label: "All", days: null },
];

export const RANGE_KEYS = OPTIONS.map((o) => o.key);

export function isRangeKey(value: unknown): value is RangeKey {
  return typeof value === "string" && (RANGE_KEYS as string[]).includes(value);
}

/**
 * Turns a range choice into concrete dates. "All" needs the earliest day that
 * has anything in it — passed in rather than guessed, since only the caller
 * knows which module's data is on screen.
 *
 * The range always ends today: a chart that quietly stopped last Tuesday would
 * hide the very gap it exists to show.
 */
export function resolveRange(key: RangeKey, earliest: string | null): Range {
  const to = todayKey();
  const option = OPTIONS.find((o) => o.key === key) ?? OPTIONS[1];

  if (option.days === null) return { from: earliest ?? addDays(to, -27), to };
  return { from: addDays(to, -(option.days - 1)), to };
}

interface Props {
  value: RangeKey;
  onChange: (next: RangeKey) => void;
  /** Right-hand caption, e.g. how many days are covered. */
  note?: string;
}

export function RangeSeg({ value, onChange, note }: Props) {
  return (
    <div className="range-bar">
      <div className="seg subtle" role="group" aria-label="Date range">
        {OPTIONS.map((o) => (
          <button
            key={o.key}
            className={value === o.key ? "seg-opt on" : "seg-opt"}
            aria-pressed={value === o.key}
            onClick={() => onChange(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {note && <span className="range-note">{note}</span>}
    </div>
  );
}
