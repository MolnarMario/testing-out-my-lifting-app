import { useState } from "react";
import { Check, RotateCcw, Trash2 } from "lucide-react";
import { EXERCISE_GROUPS } from "../../data/exercises";
import type { Exercise } from "../../lib/types";

interface Props {
  library: Exercise[];
  hiddenCount: number;
  onAdd: (exercise: Omit<Exercise, "id" | "isCustom">) => void;
  onRemove: (id: string) => void;
  onRestoreHidden: () => void;
}

const FLAGS = [
  { key: "hasStance", label: "Conventional / sumo" },
  { key: "belt", label: "Belt" },
  { key: "straps", label: "Straps" },
  { key: "kneeGear", label: "Knee gear" },
  { key: "timed", label: "Held for time" },
] as const;

type FlagKey = (typeof FLAGS)[number]["key"];

export function ExercisesPane({
  library,
  hiddenCount,
  onAdd,
  onRemove,
  onRestoreHidden,
}: Props) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState<string>("Other");
  const [flags, setFlags] = useState<Record<FlagKey, boolean>>({
    hasStance: false,
    belt: false,
    straps: false,
    kneeGear: false,
    timed: false,
  });
  const [error, setError] = useState("");

  function submit() {
    const trimmed = name.trim();
    if (trimmed === "") {
      setError("Give the exercise a name.");
      return;
    }
    if (library.some((e) => e.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("That exercise is already in the library.");
      return;
    }

    onAdd({ name: trimmed, group, ...flags });
    setName("");
    setFlags({ hasStance: false, belt: false, straps: false, kneeGear: false, timed: false });
    setError("");
  }

  return (
    <>
      <div className="card">
        <div className="card-head" style={{ marginBottom: 4 }}>
          <span className="card-title">Add exercise</span>
        </div>
        <p className="modal-note">
          Tick whatever applies — the toggles you pick here are the ones offered when logging a set.
        </p>

        <div className="add-ex-form">
          <div className="field grow">
            <span className="field-label">Name</span>
            <input
              className="text-input"
              value={name}
              placeholder="Anderson Squat"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>

          <div className="field shrink">
            <span className="field-label">Group</span>
            <select
              className="lib-select"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              {EXERCISE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="intensity">
          <div className="intensity-label">Applies to this lift</div>
          <div className="intensity-row">
            {FLAGS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className="check-row"
                aria-pressed={flags[key]}
                onClick={() => setFlags((prev) => ({ ...prev, [key]: !prev[key] }))}
              >
                <span className={flags[key] ? "checkbox on" : "checkbox"}>
                  {flags[key] && <Check aria-hidden="true" />}
                </span>
                <span className="ct">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {error !== "" && <p className="hint">{error}</p>}

        <div className="add-bar">
          <button className="btn btn-primary" onClick={submit}>
            Add to library
          </button>
        </div>
      </div>

      {hiddenCount > 0 && (
        <div className="card tight">
          <div className="switch-row">
            <div className="lbl">
              <span className="t">
                {hiddenCount} hidden {hiddenCount === 1 ? "exercise" : "exercises"}
              </span>
              <span className="d">Built-in lifts you removed are kept, not deleted.</span>
            </div>
            <button className="btn btn-ghost" onClick={onRestoreHidden}>
              <RotateCcw aria-hidden="true" />
              Restore
            </button>
          </div>
        </div>
      )}

      {EXERCISE_GROUPS.map((g) => {
        const items = library.filter((e) => e.group === g);
        if (items.length === 0) return null;
        return (
          <div className="ex-group" key={g}>
            <div className="ex-group-title">{g}</div>
            <div className="ex-grid">
              {items.map((ex) => (
                <div className="ex-chip" key={ex.id}>
                  <span className="nm">{ex.name}</span>
                  {ex.isCustom && <span className="custom-tag">custom</span>}
                  <button
                    className="del"
                    aria-label={`Remove ${ex.name}`}
                    onClick={() => onRemove(ex.id)}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
