import { useEffect, useState } from "react";
import { ChevronDown, Pencil, Plus } from "lucide-react";
import { NumberField } from "../NumberField";
import { ExercisePicker } from "./ExercisePicker";
import { fromKg, toKg, roundKg, uid, formatWeight } from "../../lib/format";
import type { Exercise, IntensityType, SetEntry, Stance, Unit } from "../../lib/types";
import type { Maxes } from "../../hooks/useMaxes";

interface Props {
  unit: Unit;
  library: Exercise[];
  maxes: Maxes;
  editing: SetEntry | null;
  onAdd: (sets: SetEntry[]) => void;
  onUpdate: (set: SetEntry) => void;
  onCancelEdit: () => void;
}

const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

/** Which stored 1RM, if any, a given exercise is measured against. */
function maxForExercise(exerciseId: string, maxes: Maxes): number | null {
  if (exerciseId === "back-squat") return maxes.squat;
  if (exerciseId === "bench-press") return maxes.bench;
  if (exerciseId === "deadlift") return maxes.deadlift;
  return null;
}

function displayWeight(kg: number, unit: Unit): string {
  return String(Math.round(fromKg(kg, unit) * 100) / 100);
}

export function SetLogger({
  unit,
  library,
  maxes,
  editing,
  onAdd,
  onUpdate,
  onCancelEdit,
}: Props) {
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [setCount, setSetCount] = useState("1");
  const [stance, setStance] = useState<Stance>("conventional");
  const [intensityType, setIntensityType] = useState<IntensityType>("none");
  const [intensityValue, setIntensityValue] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const isEditing = editing !== null;

  useEffect(() => {
    if (!editing) return;
    setExerciseId(editing.exerciseId);
    setWeight(displayWeight(editing.weight, unit));
    setReps(String(editing.reps));
    setStance(editing.stance ?? "conventional");
    setIntensityType(editing.intensityType);
    setIntensityValue(editing.intensityValue === null ? "" : String(editing.intensityValue));
    // `unit` is intentionally excluded: re-running on a unit switch would
    // overwrite what the user has typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const exercise = library.find((e) => e.id === exerciseId) ?? null;

  const weightNum = Number(weight);
  const repsNum = Number(reps);
  const countNum = Number(setCount);
  const intensityNum = Number(intensityValue);

  const weightOk = weight.trim() !== "" && !Number.isNaN(weightNum) && weightNum > 0;
  const repsOk = reps.trim() !== "" && Number.isInteger(repsNum) && repsNum >= 1;
  const countOk = isEditing || (Number.isInteger(countNum) && countNum >= 1 && countNum <= 20);
  const intensityOk =
    intensityType === "none" ||
    (intensityValue.trim() !== "" &&
      !Number.isNaN(intensityNum) &&
      intensityNum > 0 &&
      (intensityType === "rpe" ? intensityNum <= 10 : intensityNum <= 200));

  const canSubmit = exercise !== null && weightOk && repsOk && countOk && intensityOk;

  const relevantMax = exercise ? maxForExercise(exercise.id, maxes) : null;
  const impliedWeight =
    intensityType === "pct" && relevantMax !== null && intensityOk
      ? fromKg(relevantMax, unit) * (intensityNum / 100)
      : null;

  function reset() {
    setWeight("");
    setReps("");
    setSetCount("1");
    setIntensityValue("");
  }

  function buildBase() {
    return {
      exerciseId: exercise!.id,
      weight: roundKg(toKg(weightNum, unit)),
      reps: repsNum,
      intensityType,
      intensityValue: intensityType === "none" ? null : intensityNum,
      ...(exercise!.hasStance ? { stance } : {}),
    };
  }

  function submit() {
    if (!canSubmit) return;

    if (editing) {
      onUpdate({ ...editing, ...buildBase() });
      return;
    }

    const groupId = uid();
    const base = buildBase();
    onAdd(Array.from({ length: countNum }, () => ({ id: uid(), groupId, ...base })));
    reset();
  }

  const body = (
    <>
      <div className="select">
        <button
          className={pickerOpen ? "select-btn open" : "select-btn"}
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
        >
          {exercise ? exercise.name : <span className="ph">Choose an exercise</span>}
          <ChevronDown aria-hidden="true" />
        </button>
      </div>

      <div className="fields-row">
        <div className="field">
          <span className="field-label">Weight</span>
          <NumberField
            label="Weight"
            value={weight}
            onChange={setWeight}
            step={unit === "kg" ? 2.5 : 5}
            steps={unit === "kg" ? [5, 10] : [10, 25]}
            suffix={unit}
            placeholder="0"
          />
        </div>

        <div className="field">
          <span className="field-label">Reps</span>
          <NumberField label="Reps" value={reps} onChange={setReps} step={1} placeholder="0" />
        </div>

        {!isEditing && (
          <div className="field">
            <span className="field-label">Sets</span>
            <NumberField label="Number of sets" value={setCount} onChange={setSetCount} step={1} />
          </div>
        )}
      </div>

      {exercise?.hasStance && (
        <div className="intensity">
          <div className="intensity-label">Stance</div>
          <div className="seg subtle">
            {(["conventional", "sumo"] as const).map((s) => (
              <button
                key={s}
                className={stance === s ? "seg-opt on" : "seg-opt"}
                onClick={() => setStance(s)}
              >
                {s === "conventional" ? "Conv" : "Sumo"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="intensity">
        <div className="intensity-label">Intensity</div>
        <div className="intensity-row">
          <div className="seg subtle">
            {(
              [
                ["none", "—"],
                ["rpe", "RPE"],
                ["pct", "%"],
              ] as const
            ).map(([type, label]) => (
              <button
                key={type}
                className={intensityType === type ? "seg-opt on" : "seg-opt"}
                onClick={() => {
                  setIntensityType(type);
                  setIntensityValue("");
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {intensityType === "rpe" && (
            <div className="chips">
              {RPE_VALUES.map((v) => (
                <button
                  key={v}
                  className={intensityNum === v ? "chip on" : "chip"}
                  onClick={() => setIntensityValue(String(v))}
                >
                  {v}
                </button>
              ))}
            </div>
          )}

          {intensityType === "pct" && (
            <div className="inline-num">
              <input
                type="text"
                inputMode="decimal"
                value={intensityValue}
                aria-label="Percentage of one-rep max"
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === "" || /^\d*\.?\d*$/.test(next)) setIntensityValue(next);
                }}
              />
              <span className="sfx">%</span>
            </div>
          )}
        </div>

        {impliedWeight !== null && (
          <p className="hint">
            {intensityNum}% of your {exercise?.name.toLowerCase()} max is{" "}
            {formatWeight(impliedWeight, unit)} {unit}.
          </p>
        )}
      </div>
    </>
  );

  if (isEditing) {
    return (
      <div className="set-editor">
        <div className="set-editor-head">
          <div className="set-editor-title">
            <Pencil aria-hidden="true" />
            Edit set
          </div>
        </div>

        {body}

        <div className="add-bar">
          <button className="btn btn-primary" disabled={!canSubmit} onClick={submit}>
            Save
          </button>
          <button className="btn btn-ghost" onClick={onCancelEdit}>
            Cancel
          </button>
        </div>

        {pickerOpen && (
          <ExercisePicker
            library={library}
            selectedId={exerciseId}
            onPick={(ex) => {
              setExerciseId(ex.id);
              setPickerOpen(false);
            }}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">
          <span className="dot" />
          Log sets
        </div>
      </div>

      {body}

      <div className="add-bar">
        <button className="btn btn-primary" disabled={!canSubmit} onClick={submit}>
          <Plus aria-hidden="true" />
          {countNum > 1 ? `Add ${countNum} sets` : "Add set"}
        </button>
      </div>

      {pickerOpen && (
        <ExercisePicker
          library={library}
          selectedId={exerciseId}
          onPick={(ex) => {
            setExerciseId(ex.id);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
