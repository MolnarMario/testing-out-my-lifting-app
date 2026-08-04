import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEscape } from "../../hooks/useEscape";
import { EXERCISE_GROUPS } from "../../data/exercises";
import {
  dateKey,
  durationBetween,
  formatDateLong,
  formatDuration,
  formatWeight,
  fromKg,
  keyToDate,
  todayKey,
} from "../../lib/format";
import { READINESS_KEYS, READINESS_MAX } from "../../lib/types";
import type { DayLog, Exercise, Unit } from "../../lib/types";
import type { DayMap } from "../../hooks/useDays";
import { useFood } from "../../hooks/useFood";
import { totalsFor, num } from "../../lib/food";
import { Droplet, Scale } from "lucide-react";

interface Props {
  days: DayMap;
  library: Exercise[];
  unit: Unit;
  onOpenDay: (date: string) => void;
}

type View = "training" | "combined";

const GROUP_COLOR: Record<string, string> = {
  "Deadlift / Pull": "#e7402e",
  "Squat / Legs": "#f0b330",
  "Bench / Press": "#6aa0ff",
  "Abs / Core": "#46c78d",
  Other: "#8b9099",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function readinessAverage(day: DayLog): number | null {
  if (!day.readinessOn) return null;
  const scores = READINESS_KEYS.map((k) => day.readiness[k]).filter((v) => v > 0);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function readinessColor(avg: number): string {
  const pct = avg / READINESS_MAX;
  if (pct >= 0.7) return "#46c78d";
  if (pct >= 0.4) return "#f0b330";
  return "#ff5f6e";
}

function sessionMinutes(day: DayLog): number | null {
  return day.manualDurationMin ?? durationBetween(day.sessionStart, day.sessionEnd);
}

export function MonthCalendar({ days, library, unit, onOpenDay }: Props) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [view, setView] = useState<View>("training");

  const { state: foodState } = useFood();
  const foodGoalKcal = foodState.goal.kcal ?? 0;

  const groupOf = useMemo(() => {
    const map = new Map<string, string>();
    library.forEach((e) => map.set(e.id, e.group));
    return map;
  }, [library]);

  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    library.forEach((e) => map.set(e.id, e.name));
    return map;
  }, [library]);

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const total = new Date(cursor.year, cursor.month + 1, 0).getDate();
    // Grid starts on Monday; JS weeks start on Sunday.
    const lead = (first.getDay() + 6) % 7;

    const out: { key: string | null; dayNumber: number }[] = [];
    for (let i = 0; i < lead; i++) out.push({ key: null, dayNumber: 0 });
    for (let d = 1; d <= total; d++) {
      out.push({ key: dateKey(new Date(cursor.year, cursor.month, d)), dayNumber: d });
    }
    return out;
  }, [cursor]);

  const monthStats = useMemo(() => {
    let sessions = 0;
    let sets = 0;
    let volumeKg = 0;
    let minutes = 0;

    cells.forEach(({ key }) => {
      if (!key) return;
      const day = days[key];
      if (!day || day.sets.length === 0) return;
      sessions++;
      sets += day.sets.length;
      volumeKg += day.sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
      minutes += sessionMinutes(day) ?? 0;
    });

    return { sessions, sets, volumeKg, minutes };
  }, [cells, days]);

  const open = openDate ? (days[openDate] ?? null) : null;

  return (
    <>
      <div className="ov-day-head" style={{ marginBottom: 14 }}>
        <button
          className="round"
          aria-label="Previous month"
          onClick={() =>
            setCursor((c) =>
              c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 },
            )
          }
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <div className="mc-cal-month">
          {MONTHS[cursor.month]} {cursor.year}
        </div>
        <button
          className="round"
          aria-label="Next month"
          onClick={() =>
            setCursor((c) =>
              c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 },
            )
          }
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <div className="month-stats">
        <div className="stat">
          <span className="v">{monthStats.sessions}</span>
          <span className="k">Sessions</span>
        </div>
        <div className="stat">
          <span className="v">{monthStats.sets}</span>
          <span className="k">Sets</span>
        </div>
        <div className="stat">
          <span className="v">
            {Math.round(fromKg(monthStats.volumeKg, unit)).toLocaleString()}
            <span className="u">{unit}</span>
          </span>
          <span className="k">Volume</span>
        </div>
        <div className="stat">
          <span className="v">{monthStats.minutes > 0 ? formatDuration(monthStats.minutes) : "—"}</span>
          <span className="k">Time</span>
        </div>
      </div>

      <div className="ov-legend">
        {EXERCISE_GROUPS.map((g) => (
          <div className="ov-leg" key={g}>
            <span className="ov-leg-dot" style={{ background: GROUP_COLOR[g] }} />
            {g}
          </div>
        ))}
        <div className="seg subtle" style={{ marginLeft: "auto" }}>
          {(
            [
              ["training", "Training"],
              ["combined", "+ Food"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={view === key ? "seg-opt on" : "seg-opt"}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="month-scroll">
        <div className={view === "combined" ? "month-grid uni-grid" : "month-grid"}>
          {WEEKDAYS.map((w) => (
            <div className="ov-weekday" key={w}>
              {w}
            </div>
          ))}

          {cells.map(({ key, dayNumber }, i) => {
            if (!key) return <div className="ov-cell empty" key={`blank-${i}`} />;

            const day = days[key];
            const hasWork = !!day && day.sets.length > 0;
            const avg = day ? readinessAverage(day) : null;
            const minutes = day ? sessionMinutes(day) : null;

            // One row per exercise, in the order first logged.
            const perExercise: { id: string; count: number }[] = [];
            day?.sets.forEach((s) => {
              const found = perExercise.find((p) => p.id === s.exerciseId);
              if (found) found.count++;
              else perExercise.push({ id: s.exerciseId, count: 1 });
            });

            const shown = perExercise.slice(0, 3);
            const extra = perExercise.length - shown.length;

            const food = view === "combined" ? foodState.days[key] : undefined;
            const foodTotals = food ? totalsFor(food.entries) : null;
            const ateSomething = !!foodTotals && foodTotals.kcal > 0;

            const classes = [
              "ov-cell",
              view === "combined" ? "uni-cell" : "",
              hasWork || ateSomething ? "has" : "",
              key === todayKey() ? "today" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <button
                className={classes}
                key={key}
                onClick={() => hasWork && setOpenDate(key)}
                aria-label={`${formatDateLong(key)}${hasWork ? `, ${day.sets.length} sets` : ", nothing logged"}`}
              >
                <div className="ov-day-head">
                  <span className="ov-date">{dayNumber}</span>
                  {avg !== null && (
                    <span className="ov-rdot" style={{ background: readinessColor(avg) }} />
                  )}
                  {minutes !== null && <span className="ov-dur">{formatDuration(minutes)}</span>}
                </div>

                <div className="ov-body">
                  {shown.map(({ id, count }) => {
                    const color = GROUP_COLOR[groupOf.get(id) ?? "Other"] ?? GROUP_COLOR.Other;
                    return (
                      <div
                        className="ov-ex"
                        key={id}
                        style={{
                          borderColor: `${color}55`,
                          background: `${color}1a`,
                          color,
                        }}
                      >
                        <span className="ov-ex-name">{nameOf.get(id) ?? "Unknown"}</span>
                        <span className="ov-ex-sets">{count}</span>
                      </div>
                    );
                  })}
                  {extra > 0 && <div className="ov-ex ov-more">+{extra} more</div>}
                </div>

                {view === "combined" && (
                  <div className="uni-nutri">
                    {ateSomething ? (
                      <>
                        <span className="uni-divider" />
                        <span
                          className={
                            "uni-kcal" +
                            (foodGoalKcal > 0
                              ? foodTotals.kcal > foodGoalKcal
                                ? " over"
                                : " under"
                              : "")
                          }
                        >
                          {Math.round(foodTotals.kcal)} kcal
                        </span>
                        <span className="ov-nutri">
                          {num(foodTotals.protein)}P · {num(foodTotals.carbs)}C ·{" "}
                          {num(foodTotals.fat)}F
                        </span>
                      </>
                    ) : (
                      <span className="ov-nutri">—</span>
                    )}

                    {food && (food.water > 0 || food.bw !== null) && (
                      <div className="uni-extras">
                        {food.water > 0 && (
                          <span className="w">
                            <Droplet aria-hidden="true" />
                            {Math.round(food.water / 100) / 10}L
                          </span>
                        )}
                        {food.bw !== null && (
                          <span className="m">
                            <Scale aria-hidden="true" />
                            {num(fromKg(food.bw, unit))}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {openDate && open && (
        <DayModal
          date={openDate}
          day={open}
          nameOf={nameOf}
          unit={unit}
          onClose={() => setOpenDate(null)}
          onOpenDay={() => {
            onOpenDay(openDate);
            setOpenDate(null);
          }}
        />
      )}
    </>
  );
}

interface ModalProps {
  date: string;
  day: DayLog;
  nameOf: Map<string, string>;
  unit: Unit;
  onClose: () => void;
  onOpenDay: () => void;
}

function DayModal({ date, day, nameOf, unit, onClose, onOpenDay }: ModalProps) {
  useEscape(onClose);

  const avg = readinessAverage(day);
  const minutes = sessionMinutes(day);
  const d = keyToDate(date);

  return (
    <div
      className="day-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="day-modal" role="dialog" aria-modal="true" aria-label={formatDateLong(date)}>
        <div className="day-modal-head">
          <div className="day-modal-title">
            {WEEKDAYS[(d.getDay() + 6) % 7]}, {MONTHS[d.getMonth()].slice(0, 3)} {d.getDate()}
          </div>
          {minutes !== null && <span className="modal-head-btn">{formatDuration(minutes)}</span>}
          <button className="day-modal-x" onClick={onClose} aria-label="Close">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="day-modal-body">
          {avg !== null && (
            <div className="meter-solo">
              <div className="meter-head">
                <span className="meter-label">Readiness</span>
                <span className="meter-val">{avg.toFixed(1)}</span>
              </div>
              <div className="meter-cells">
                {Array.from({ length: READINESS_MAX }, (_, i) => i + 1).map((n) => (
                  <span key={n} className={n <= Math.round(avg) ? "cell on" : "cell"} />
                ))}
              </div>
            </div>
          )}

          {day.rating > 0 && (
            <div className="meter-solo">
              <div className="meter-head">
                <span className="meter-label">Session</span>
                <span className="meter-val">{day.rating}</span>
              </div>
              <div className="meter-cells">
                {Array.from({ length: READINESS_MAX }, (_, i) => i + 1).map((n) => (
                  <span key={n} className={n <= day.rating ? "cell on" : "cell"} />
                ))}
              </div>
            </div>
          )}

          <table className="log preview">
            <thead>
              <tr>
                <th>Exercise</th>
                <th className="ralign">Weight</th>
                <th className="ralign">Reps</th>
              </tr>
            </thead>
            <tbody>
              {day.sets.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="ex-cell">{nameOf.get(s.exerciseId) ?? "Unknown"}</div>
                  </td>
                  <td className="ralign">
                    <span className="wt">
                      {formatWeight(fromKg(s.weight, unit), unit)}
                      <span className="u">{unit}</span>
                    </span>
                  </td>
                  <td className="ralign">
                    <span className="reps">{s.reps}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {day.notesOn && day.notes.trim() !== "" && <p className="modal-note">{day.notes}</p>}
        </div>

        <div className="day-modal-foot">
          <button className="btn btn-primary" onClick={onOpenDay}>
            Open this day
          </button>
        </div>
      </div>
    </div>
  );
}
