import type { FoodGoals } from "../../lib/food";

interface Props {
  goals: FoodGoals;
  onChange: (patch: Partial<FoodGoals>) => void;
}

const TARGETS = [
  { key: "kcal", label: "Calories", unit: "kcal", placeholder: "2400" },
  { key: "protein", label: "Protein", unit: "g", placeholder: "180" },
  { key: "carbs", label: "Carbs", unit: "g", placeholder: "260" },
  { key: "fat", label: "Fat", unit: "g", placeholder: "80" },
  { key: "fiber", label: "Fiber", unit: "g", placeholder: "35" },
  { key: "water", label: "Water", unit: "ml", placeholder: "3000" },
] as const;

export function GoalsPane({ goals, onChange }: Props) {
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
        </p>

        <div className="mc-grid2">
          {TARGETS.map(({ key, label, unit, placeholder }) => (
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
                <span className="unit">{unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
