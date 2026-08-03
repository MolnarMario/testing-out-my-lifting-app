import { useState } from "react";
import { TodayPane } from "./TodayPane";
import { PantryPane } from "./PantryPane";
import { GoalsPane } from "./GoalsPane";
import { FoodCalendar } from "./FoodCalendar";
import { useFood } from "../../hooks/useFood";
import { todayKey } from "../../lib/format";
import type { Unit } from "../../lib/types";

interface Props {
  unit: Unit;
}

type Pane = "today" | "pantry" | "goals";

const PANES: { key: Pane; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "pantry", label: "Pantry" },
  { key: "goals", label: "Goals" },
];

export function FoodTab({ unit }: Props) {
  const [pane, setPane] = useState<Pane>("today");
  const [date, setDate] = useState(todayKey());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { state, pantry, getDay, updateDay, setGoals, addFood, removeFood } = useFood();

  return (
    <div className="mc">
      <div className="mc-tabs" role="tablist" aria-label="Food sections">
        {PANES.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={pane === key}
            className={pane === key ? "mc-tab on" : "mc-tab"}
            onClick={() => setPane(key)}
          >
            {label}
            {key === "pantry" && pantry.length > 0 && (
              <span className="mc-badge">{pantry.length}</span>
            )}
          </button>
        ))}
      </div>

      {pane === "today" && (
        <TodayPane
          date={date}
          onDateChange={setDate}
          day={getDay(date)}
          pantry={pantry}
          goals={state.goal}
          unit={unit}
          onUpdateDay={(patch) => updateDay(date, patch)}
          onOpenGoals={() => setPane("goals")}
          onOpenCalendar={() => setCalendarOpen(true)}
        />
      )}

      {calendarOpen && (
        <FoodCalendar
          days={state.days}
          goals={state.goal}
          unit={unit}
          initialDate={date}
          onPick={(next) => {
            setDate(next);
            setCalendarOpen(false);
          }}
          onClose={() => setCalendarOpen(false)}
        />
      )}

      {pane === "pantry" && <PantryPane pantry={pantry} onAdd={addFood} onRemove={removeFood} />}

      {pane === "goals" && <GoalsPane goals={state.goal} onChange={setGoals} />}
    </div>
  );
}
