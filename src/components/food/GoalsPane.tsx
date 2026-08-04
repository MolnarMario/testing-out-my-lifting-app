import { useState } from "react";
import { num } from "../../lib/food";
import type { FoodGoals } from "../../lib/food";
import { fromKg } from "../../lib/format";
import type { Unit } from "../../lib/types";

interface Props {
  goals: FoodGoals;
  onChange: (patch: Partial<FoodGoals>) => void;
  unit: Unit;
  /** Most recent logged bodyweight in kg, for per-kg targets. */
  bodyweight: number | null;
}

const PRESETS = [
  { key: "cut", label: "Cut", kcal: 1800, protein: 170 },
  { key: "maintain", label: "Maintain", kcal: 2400, protein: 160 },
  { key: "bulk", label: "Bulk", kcal: 3000, protein: 200 },
] as const;

const TARGETS = [
  { key: "kcal", label: "Calories", unit: "kcal", placeholder: "2400" },
  { key: "protein", label: "Protein", unit: "g", placeholder: "180" },
  { key: "carbs", label: "Carbs", unit: "g", placeholder: "260" },
  { key: "fat", label: "Fat", unit: "g", placeholder: "80" },
  { key: "fiber", label: "Fiber", unit: "g", placeholder: "35" },
  { key: "water", label: "Water", unit: "ml", placeholder: "3000" },
] as const;

export function GoalsPane({ goals, onChange, unit, bodyweight }: Props) {
  const [perKg, setPerKg] = useState(false);

  const bw = bodyweight === null ? null : fromKg(bodyweight, unit);
  const canPerKg = bw !== null && bw > 0;
  const showPerKg = perKg && canPerKg;

  return (
    <div className="mc-pane">
      <div className="mc-goalnow">
        <div className="card tight mc-gn">
          <div className="l">Calories</div>
          <div className={goals.kcal ? "v" : "v unset"}>
            {goals.kcal ? (
              <>
                {Math.round(goals.kcal)}
                <span className="u"> kcal</span>
              </>
            ) : (
              "Not set"
            )}
          </div>
        </div>

        <div className="card tight mc-gn">
          <div className="l">Protein</div>
          <div className={goals.protein ? "v" : "v unset"}>
            {goals.protein ? (
              <>
                {Math.round(goals.protein)}
                <span className="u"> g</span>
              </>
            ) : (
              "Not set"
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head" style={{ marginBottom: 4 }}>
          <span className="card-title">Daily targets</span>
        </div>
        <p className="modal-note">
          Set the numbers you care about. Leave any blank to hide it from Today.
          {canPerKg && (
            <>
              {" "}
              Showing targets{" "}
              <button className="mc-ub" onClick={() => setPerKg((v) => !v)}>
                {showPerKg ? `per ${unit} of bodyweight` : "per day"}
              </button>
              .
            </>
          )}
        </p>

        {PRESETS.map((p) => (
          <button
            key={p.key}
            className="btn btn-ghost mc-presetbtn"
            onClick={() => onChange({ kcal: p.kcal, protein: p.protein })}
          >
            {p.label} · {p.kcal} / {p.protein} P
          </button>
        ))}

        <div className="mc-grid2">
          {TARGETS.map(({ key, label, unit: suffix, placeholder }) => (
            <div className="field" key={key}>
              <span className="field-label">{label}</span>
              <div className="mc-numwrap">
                <input
                  className="text-input"
                  inputMode="decimal"
                  placeholder={placeholder}
                  aria-label={`${label} target`}
                  value={goals[key] === null ? "" : String(goals[key])}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
                    if (raw.trim() === "") {
                      onChange({ [key]: null });
                      return;
                    }
                    const n = Number(raw);
                    if (Number.isFinite(n) && n >= 0) onChange({ [key]: n });
                  }}
                />
                <span className="unit">{suffix}</span>
              </div>
              {showPerKg && goals[key] !== null && (
                <span className="mc-goalnote">
                  {num(goals[key]! / bw!)} {suffix} per {unit}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
