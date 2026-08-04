import { useMemo, useState } from "react";
import { TodayPane } from "./TodayPane";
import { PantryPane } from "./PantryPane";
import { GoalsPane } from "./GoalsPane";
import { FoodCalendar } from "./FoodCalendar";
import { TrendsPane } from "./TrendsPane";
import { ScanModal } from "./ScanModal";
import { useFood } from "../../hooks/useFood";
import { todayKey, uid } from "../../lib/format";
import type { Unit } from "../../lib/types";

interface Props {
  unit: Unit;
}

type Pane = "today" | "trends" | "pantry" | "goals";

const PANES: { key: Pane; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "trends", label: "Trends" },
  { key: "pantry", label: "Pantry" },
  { key: "goals", label: "Goals" },
];

export function FoodTab({ unit }: Props) {
  const [pane, setPane] = useState<Pane>("today");
  const [date, setDate] = useState(todayKey());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const { state, pantry, getDay, updateDay, setGoals, addFood, removeFood } = useFood();

  // Per-kg targets need a weight; the most recent one on or before today is the
  // best guess, since bodyweight is not logged every day.
  const latestBodyweight = useMemo(() => {
    const dated = Object.entries(state.days)
      .filter(([, d]) => d.bw !== null)
      .sort(([a], [b]) => b.localeCompare(a));
    return dated.length > 0 ? dated[0][1].bw : null;
  }, [state.days]);

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
          onOpenScan={() => setScanOpen(true)}
        />
      )}

      {scanOpen && (
        <ScanModal
          pantry={pantry}
          onClose={() => setScanOpen(false)}
          onSave={(food, log) => {
            addFood(food);
            // A scanned food is worth keeping either way; logging it to the day
            // is what makes the scan a one-step action rather than two.
            if (log !== null) {
              updateDay(date, (day) => ({
                ...day,
                entries: [
                  ...day.entries,
                  {
                    id: uid(),
                    foodId: food.id,
                    name: food.name,
                    type: food.type,
                    qty: log.qty,
                    unit: log.unit,
                    kcal: food.kcal,
                    fat: food.fat,
                    carbs: food.carbs,
                    fiber: food.fiber,
                    protein: food.protein,
                  },
                ],
              }));
            }
            setScanOpen(false);
          }}
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

      {pane === "trends" && (
        <TrendsPane
          days={state.days}
          goals={state.goal}
          unit={unit}
          onOpenDay={(next) => {
            setDate(next);
            setPane("today");
          }}
          onOpenGoals={() => setPane("goals")}
        />
      )}

      {pane === "pantry" && (
        <PantryPane
          pantry={pantry}
          onAdd={addFood}
          onRemove={removeFood}
          onOpenScan={() => setScanOpen(true)}
        />
      )}

      {pane === "goals" && (
        <GoalsPane
          goals={state.goal}
          onChange={setGoals}
          unit={unit}
          bodyweight={latestBodyweight}
        />
      )}
    </div>
  );
}
