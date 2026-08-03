import { useState } from "react";
import { DateBar } from "./DateBar";
import { SetLogger } from "./SetLogger";
import { LogTable } from "./LogTable";
import { ReadinessCard } from "./ReadinessCard";
import { SessionCard } from "./SessionCard";
import { NotesCard } from "./NotesCard";
import { ExercisesPane } from "./ExercisesPane";
import { MonthCalendar } from "./MonthCalendar";
import { useDays } from "../../hooks/useDays";
import { useLibrary } from "../../hooks/useLibrary";
import { useMaxes } from "../../hooks/useMaxes";
import { todayKey } from "../../lib/format";
import type { ReadinessKey, SetEntry, Unit } from "../../lib/types";

interface Props {
  unit: Unit;
  onLoadOnBar: (weight: number) => void;
}

type Pane = "today" | "calendar" | "exercises";

const PANES: { key: Pane; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "calendar", label: "Calendar" },
  { key: "exercises", label: "Exercises" },
];

export function WorkoutTab({ unit, onLoadOnBar }: Props) {
  const [pane, setPane] = useState<Pane>("today");
  const [date, setDate] = useState(todayKey());
  const [editingId, setEditingId] = useState<string | null>(null);

  const { days, getDay, updateDay } = useDays();
  const { library, removed, addExercise, removeExercise, restoreHidden } = useLibrary();
  const [maxes] = useMaxes();

  const day = getDay(date);
  const editing = day.sets.find((s) => s.id === editingId) ?? null;

  function addSets(newSets: SetEntry[]) {
    updateDay(date, (d) => ({ ...d, sets: [...d.sets, ...newSets] }));
  }

  function updateSet(next: SetEntry) {
    updateDay(date, (d) => ({
      ...d,
      sets: d.sets.map((s) => (s.id === next.id ? next : s)),
    }));
    setEditingId(null);
  }

  function deleteSet(id: string) {
    updateDay(date, (d) => ({ ...d, sets: d.sets.filter((s) => s.id !== id) }));
    if (editingId === id) setEditingId(null);
  }

  function setReadiness(key: ReadinessKey, value: number) {
    updateDay(date, (d) => ({ ...d, readiness: { ...d.readiness, [key]: value } }));
  }

  return (
    <>
      <div className="mc-tabs" role="tablist" aria-label="Workout sections">
        {PANES.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={pane === key}
            className={pane === key ? "mc-tab on" : "mc-tab"}
            onClick={() => setPane(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {pane === "calendar" && (
        <MonthCalendar
          days={days}
          library={library}
          unit={unit}
          onOpenDay={(next) => {
            setDate(next);
            setEditingId(null);
            setPane("today");
          }}
        />
      )}

      {pane === "exercises" && (
        <ExercisesPane
          library={library}
          hiddenCount={removed.length}
          onAdd={addExercise}
          onRemove={removeExercise}
          onRestoreHidden={restoreHidden}
        />
      )}

      {pane !== "today" ? null : (
      <>
      <DateBar
        date={date}
        onDateChange={(next) => {
          setDate(next);
          setEditingId(null);
        }}
      />

      {!editing && (
        <SetLogger
          unit={unit}
          library={library}
          maxes={maxes}
          editing={null}
          onAdd={addSets}
          onUpdate={updateSet}
          onCancelEdit={() => setEditingId(null)}
        />
      )}

      <div className="card">
        <div className="card-head">
          <div className="card-title">Log</div>
          {day.sets.length > 0 && (
            <span className="card-note">
              {day.sets.length} {day.sets.length === 1 ? "set" : "sets"}
            </span>
          )}
        </div>

        <LogTable
          sets={day.sets}
          library={library}
          unit={unit}
          editingId={editingId}
          onEdit={(s) => setEditingId(s.id)}
          onDelete={deleteSet}
          onLoadOnBar={onLoadOnBar}
        />

        {editing && (
          <SetLogger
            unit={unit}
            library={library}
            maxes={maxes}
            editing={editing}
            onAdd={addSets}
            onUpdate={updateSet}
            onCancelEdit={() => setEditingId(null)}
          />
        )}
      </div>

      <ReadinessCard
        on={day.readinessOn}
        readiness={day.readiness}
        onToggle={(next) => updateDay(date, (d) => ({ ...d, readinessOn: next }))}
        onChange={setReadiness}
      />

      <SessionCard
        start={day.sessionStart}
        end={day.sessionEnd}
        manualMin={day.manualDurationMin}
        onStartChange={(v) => updateDay(date, (d) => ({ ...d, sessionStart: v }))}
        onEndChange={(v) => updateDay(date, (d) => ({ ...d, sessionEnd: v }))}
        onManualChange={(v) => updateDay(date, (d) => ({ ...d, manualDurationMin: v }))}
      />

      <NotesCard
        on={day.notesOn}
        notes={day.notes}
        onToggle={(next) => updateDay(date, (d) => ({ ...d, notesOn: next }))}
        onChange={(v) => updateDay(date, (d) => ({ ...d, notes: v }))}
      />
      </>
      )}
    </>
  );
}
