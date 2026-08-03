import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { useEscape } from "../../hooks/useEscape";
import { EXERCISE_GROUPS } from "../../data/exercises";
import type { Exercise } from "../../lib/types";

interface Props {
  library: Exercise[];
  selectedId: string | null;
  onPick: (ex: Exercise) => void;
  onClose: () => void;
}

export function ExercisePicker({ library, selectedId, onPick, onClose }: Props) {
  const [query, setQuery] = useState("");
  useEscape(onClose);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q === "" ? library : library.filter((e) => e.name.toLowerCase().includes(q));

    // Known groups first, in their declared order; anything else falls to the end.
    const names = [
      ...EXERCISE_GROUPS,
      ...new Set(matches.map((e) => e.group).filter((g) => !EXERCISE_GROUPS.includes(g as never))),
    ];

    return names
      .map((group) => ({ group, items: matches.filter((e) => e.group === group) }))
      .filter((g) => g.items.length > 0);
  }, [library, query]);

  return (
    <div
      className="ex-picker-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ex-picker" role="dialog" aria-modal="true" aria-label="Choose an exercise">
        <div className="ex-picker-head">
          <div className="search">
            <Search aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exercises"
              aria-label="Search exercises"
            />
          </div>
          <button className="ex-picker-x" onClick={onClose} aria-label="Close">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="opt-list">
          {groups.length === 0 && <div className="opt-empty">No exercises match “{query}”.</div>}

          {groups.map(({ group, items }) => (
            <div className="opt-group" key={group}>
              <div className="opt-group-h">{group}</div>
              {items.map((ex) => (
                <button
                  key={ex.id}
                  className={ex.id === selectedId ? "opt sel" : "opt"}
                  onClick={() => onPick(ex)}
                >
                  <span>{ex.name}</span>
                  {ex.isCustom && <span className="mini-pill">Custom</span>}
                  {ex.id === selectedId && <Check aria-hidden="true" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
