import { useState } from "react";
import { X } from "lucide-react";
import { useMaxes } from "../hooks/useMaxes";
import { useEscape } from "../hooks/useEscape";
import { NumberField } from "./NumberField";
import { fromKg, toKg, roundKg } from "../lib/format";
import type { Unit } from "../lib/types";
import type { Maxes } from "../hooks/useMaxes";

interface Props {
  unit: Unit;
  onClose: () => void;
}

const LIFTS: { key: keyof Maxes; label: string }[] = [
  { key: "squat", label: "Squat" },
  { key: "bench", label: "Bench" },
  { key: "deadlift", label: "Deadlift" },
];

type Draft = Record<keyof Maxes, string>;

function toDraft(maxes: Maxes, unit: Unit): Draft {
  const one = (kg: number | null) =>
    kg === null ? "" : String(Math.round(fromKg(kg, unit) * 10) / 10);
  return { squat: one(maxes.squat), bench: one(maxes.bench), deadlift: one(maxes.deadlift) };
}

export function MaxesModal({ unit, onClose }: Props) {
  const [maxes, setMaxes] = useMaxes();
  const [draft, setDraft] = useState<Draft>(() => toDraft(maxes, unit));

  useEscape(onClose);

  function edit(key: keyof Maxes, raw: string) {
    setDraft((prev) => ({ ...prev, [key]: raw }));

    const trimmed = raw.trim();
    if (trimmed === "") {
      setMaxes((prev) => ({ ...prev, [key]: null }));
      return;
    }
    const n = Number(trimmed);
    if (!Number.isNaN(n) && n > 0) {
      setMaxes((prev) => ({ ...prev, [key]: roundKg(toKg(n, unit)) }));
    }
  }

  function clearAll() {
    setDraft({ squat: "", bench: "", deadlift: "" });
    setMaxes({ squat: null, bench: null, deadlift: null });
  }

  return (
    <div
      className="day-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="day-modal" role="dialog" aria-modal="true" aria-label="One-rep maxes">
        <div className="day-modal-head">
          <div className="day-modal-title">One-Rep Maxes</div>
          <button className="day-modal-x" onClick={onClose} aria-label="Close">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="day-modal-body">
          <p className="modal-note">
            Used to show percentage-of-max intensity when logging sets. Stored in {unit}.
          </p>

          <div className="maxes-fields">
            {LIFTS.map(({ key, label }) => (
              <div className="field field-inline" key={key}>
                <span className="field-label">{label}</span>
                <NumberField
                  label={`${label} one-rep max`}
                  value={draft[key]}
                  onChange={(next) => edit(key, next)}
                  step={unit === "kg" ? 2.5 : 5}
                  suffix={unit}
                  placeholder="—"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="day-modal-foot">
          <button className="btn btn-danger" onClick={clearAll}>
            Clear
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
