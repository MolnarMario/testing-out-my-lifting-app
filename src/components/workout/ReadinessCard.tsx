import { Beef, Coffee, Droplet, Flame, Moon, Zap } from "lucide-react";
import { SwitchRow } from "../SwitchRow";
import { READINESS_KEYS, READINESS_MAX } from "../../lib/types";
import type { Readiness, ReadinessKey } from "../../lib/types";

interface Props {
  on: boolean;
  readiness: Readiness;
  onToggle: (next: boolean) => void;
  onChange: (key: ReadinessKey, value: number) => void;
}

const META: Record<ReadinessKey, { label: string; Icon: typeof Flame }> = {
  motivation: { label: "Motivation", Icon: Flame },
  sleep: { label: "Sleep", Icon: Moon },
  calories: { label: "Calories", Icon: Zap },
  protein: { label: "Protein", Icon: Beef },
  hydration: { label: "Hydration", Icon: Droplet },
  stimulants: { label: "Stimulants", Icon: Coffee },
};

export function ReadinessCard({ on, readiness, onToggle, onChange }: Props) {
  return (
    <div className="card">
      <SwitchRow
        title="Readiness"
        description="How the body felt going in"
        checked={on}
        onChange={onToggle}
      />

      {on && (
        <div className="meters">
          {READINESS_KEYS.map((key) => {
            const { label, Icon } = META[key];
            const value = readiness[key];
            return (
              <div key={key}>
                <div className="meter-head">
                  <span className="meter-ico">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="meter-label" id={`meter-${key}`}>
                    {label}
                  </span>
                  <span className={value === 0 ? "meter-val zero" : "meter-val"}>{value}</span>
                </div>
                <div className="meter-cells" role="group" aria-labelledby={`meter-${key}`}>
                  {Array.from({ length: READINESS_MAX }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      className={n <= value ? "cell on" : "cell"}
                      aria-label={`${label}: ${n} of ${READINESS_MAX}`}
                      aria-pressed={n <= value}
                      // Clicking the active top cell clears back to zero.
                      onClick={() => onChange(key, value === n ? 0 : n)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
