import type { ReactNode } from "react";
import { READINESS_MAX } from "../lib/types";

interface Props {
  label: string;
  icon?: ReactNode;
  value: number;
  onChange: (next: number) => void;
  max?: number;
}

/**
 * A 0..max cell meter. Clicking the cell that is already the top of the range
 * clears back to zero, so a mis-tap is one tap to undo.
 */
export function Meter({ label, icon, value, onChange, max = READINESS_MAX }: Props) {
  const id = `meter-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div>
      <div className="meter-head">
        {icon && <span className="meter-ico">{icon}</span>}
        <span className="meter-label" id={id}>
          {label}
        </span>
        <span className={value === 0 ? "meter-val zero" : "meter-val"}>{value}</span>
      </div>
      <div className="meter-cells" role="group" aria-labelledby={id}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            className={n <= value ? "cell on" : "cell"}
            aria-label={`${label}: ${n} of ${max}`}
            aria-pressed={n <= value}
            onClick={() => onChange(value === n ? 0 : n)}
          />
        ))}
      </div>
    </div>
  );
}
