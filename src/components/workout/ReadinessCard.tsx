import { Beef, Coffee, Droplet, Flame, Moon, Zap } from "lucide-react";
import { SwitchRow } from "../SwitchRow";
import { Meter } from "../Meter";
import { READINESS_KEYS } from "../../lib/types";
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
            return (
              <Meter
                key={key}
                label={label}
                icon={<Icon aria-hidden="true" />}
                value={readiness[key]}
                onChange={(v) => onChange(key, v)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
