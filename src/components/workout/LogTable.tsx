import { Dumbbell, Layers, Pencil, Trash2 } from "lucide-react";
import { formatWeight, fromKg } from "../../lib/format";
import type { Exercise, SetEntry, Unit } from "../../lib/types";

interface Props {
  sets: SetEntry[];
  library: Exercise[];
  unit: Unit;
  editingId: string | null;
  onEdit: (set: SetEntry) => void;
  onDelete: (id: string) => void;
  onLoadOnBar: (weight: number) => void;
}

function intensityLabel(set: SetEntry): { text: string; className: string } {
  if (set.intensityType === "rpe" && set.intensityValue !== null) {
    return { text: `RPE ${set.intensityValue}`, className: "intensity-tag rpe" };
  }
  if (set.intensityType === "pct" && set.intensityValue !== null) {
    return { text: `${set.intensityValue}%`, className: "intensity-tag pct" };
  }
  return { text: "—", className: "intensity-tag none" };
}

export function LogTable({
  sets,
  library,
  unit,
  editingId,
  onEdit,
  onDelete,
  onLoadOnBar,
}: Props) {
  if (sets.length === 0) {
    return (
      <div className="empty">
        <Dumbbell aria-hidden="true" />
        <div className="t">Nothing logged</div>
        <div className="d">Add your first set above.</div>
      </div>
    );
  }

  const nameOf = (id: string) => library.find((e) => e.id === id)?.name ?? "Unknown exercise";

  // Set numbers run per exercise across the whole day.
  const seen = new Map<string, number>();
  const numbered = sets.map((set) => {
    const n = (seen.get(set.exerciseId) ?? 0) + 1;
    seen.set(set.exerciseId, n);
    return { set, n };
  });

  const totalReps = sets.reduce((sum, s) => sum + s.reps, 0);
  const volumeKg = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
  const heaviestKg = sets.reduce((best, s) => Math.max(best, s.weight), 0);

  return (
    <>
      <div className="log-table-wrap">
        <table className="log">
          <thead>
            <tr>
              <th>Set</th>
              <th>Exercise</th>
              <th className="ralign">Weight</th>
              <th className="ralign">Reps</th>
              <th className="ctr">Intensity</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {numbered.map(({ set, n }, i) => {
              const prev = numbered[i - 1]?.set;
              const isGroupStart = !prev || prev.groupId !== set.groupId;
              const intensity = intensityLabel(set);
              const rowClass = [isGroupStart ? "grp-start" : "", set.id === editingId ? "editing" : ""]
                .filter(Boolean)
                .join(" ");

              return (
                <tr key={set.id} className={rowClass}>
                  <td className="set-no">{n}</td>
                  <td>
                    <div className="ex-cell">
                      {nameOf(set.exerciseId)}
                      {set.stance && (
                        <span className={set.stance === "sumo" ? "stance-pill sumo" : "stance-pill"}>
                          {set.stance === "sumo" ? "Sumo" : "Conv"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="ralign">
                    <span className="wt">
                      {formatWeight(fromKg(set.weight, unit), unit)}
                      <span className="u">{unit}</span>
                    </span>
                  </td>
                  <td className="ralign">
                    <span className="reps">{set.reps}</span>
                  </td>
                  <td className="ctr">
                    <span className={intensity.className}>{intensity.text}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="del plates"
                        onClick={() => onLoadOnBar(fromKg(set.weight, unit))}
                        aria-label={`Show plate loading for ${formatWeight(fromKg(set.weight, unit), unit)} ${unit}`}
                      >
                        <Layers aria-hidden="true" />
                      </button>
                      <button
                        className="del edit"
                        onClick={() => onEdit(set)}
                        aria-label={`Edit set ${n} of ${nameOf(set.exerciseId)}`}
                      >
                        <Pencil aria-hidden="true" />
                      </button>
                      <button
                        className="del"
                        onClick={() => onDelete(set.id)}
                        aria-label={`Delete set ${n} of ${nameOf(set.exerciseId)}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="summary">
        <div className="stat">
          <span className="v">{sets.length}</span>
          <span className="k">Sets</span>
        </div>
        <div className="stat">
          <span className="v">{totalReps}</span>
          <span className="k">Reps</span>
        </div>
        <div className="stat">
          <span className="v">
            {Math.round(fromKg(volumeKg, unit)).toLocaleString()}
            <span className="u">{unit}</span>
          </span>
          <span className="k">Volume</span>
        </div>
        <div className="stat">
          <span className="v">
            {formatWeight(fromKg(heaviestKg, unit), unit)}
            <span className="u">{unit}</span>
          </span>
          <span className="k">Top set</span>
        </div>
      </div>
    </>
  );
}
