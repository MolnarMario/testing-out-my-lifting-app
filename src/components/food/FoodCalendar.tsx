import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Droplet, Scale, X } from "lucide-react";
import { useEscape } from "../../hooks/useEscape";
import { totalsFor, num } from "../../lib/food";
import type { FoodDay, FoodGoals } from "../../lib/food";
import { dateKey, fromKg, keyToDate, todayKey } from "../../lib/format";
import type { Unit } from "../../lib/types";

interface Props {
  days: Record<string, FoodDay>;
  goals: FoodGoals;
  unit: Unit;
  initialDate: string;
  onPick: (date: string) => void;
  onClose: () => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function FoodCalendar({ days, goals, unit, initialDate, onPick, onClose }: Props) {
  const start = keyToDate(initialDate);
  const [cursor, setCursor] = useState({ year: start.getFullYear(), month: start.getMonth() });

  useEscape(onClose);

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const total = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;

    const out: { key: string | null; dayNumber: number }[] = [];
    for (let i = 0; i < lead; i++) out.push({ key: null, dayNumber: 0 });
    for (let d = 1; d <= total; d++) {
      out.push({ key: dateKey(new Date(cursor.year, cursor.month, d)), dayNumber: d });
    }
    return out;
  }, [cursor]);

  const kcalGoal = goals.kcal ?? 0;

  return (
    <div
      className="day-modal-backdrop ov-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ov-modal" role="dialog" aria-modal="true" aria-label="Food calendar">
        <div className="ov-modal-body">
          <div className="mc-cal-head">
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
            <button className="day-modal-x" onClick={onClose} aria-label="Close">
              <X aria-hidden="true" />
            </button>
          </div>

          <div className="month-scroll">
            <div className="cal-inner">
            <div className="mc-cal-dows">
              {WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>

            <div className="mc-cal-grid">
              {cells.map(({ key, dayNumber }, i) => {
                if (!key) return <div className="mc-cal-cell" key={`blank-${i}`} style={{ opacity: 0 }} />;

                const day = days[key];
                const totals = day ? totalsFor(day.entries) : null;
                const logged = !!totals && totals.kcal > 0;
                const over = kcalGoal > 0 && logged && totals.kcal > kcalGoal;
                const under = kcalGoal > 0 && logged && totals.kcal <= kcalGoal;

                const macroSum = logged ? totals.protein + totals.carbs + totals.fat : 0;
                const pct = (v: number) => (macroSum > 0 ? (v / macroSum) * 100 : 0);

                const classes = [
                  "mc-cal-cell",
                  logged ? "has" : "",
                  key === todayKey() ? "today" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button
                    className={classes}
                    key={key}
                    disabled={!day}
                    onClick={() => onPick(key)}
                    aria-label={`${key}${logged ? `, ${Math.round(totals.kcal)} kcal` : ", nothing logged"}`}
                  >
                    <div className="mc-cal-day">{dayNumber}</div>

                    {logged ? (
                      <>
                        <div
                          className={
                            "mc-cal-kcal" + (over ? " over" : under ? " under" : "")
                          }
                        >
                          {Math.round(totals.kcal)}
                        </div>

                        <div className="mc-cal-bar">
                          <span className="p" style={{ width: `${pct(totals.protein)}%` }} />
                          <span className="c" style={{ width: `${pct(totals.carbs)}%` }} />
                          <span className="f" style={{ width: `${pct(totals.fat)}%` }} />
                        </div>

                        <div className="mc-cal-macros">
                          <span className="p">
                            {num(totals.protein)}
                            <em>P</em>
                          </span>
                          <span className="c">
                            {num(totals.carbs)}
                            <em>C</em>
                          </span>
                          <span className="f">
                            {num(totals.fat)}
                            <em>F</em>
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="mc-cal-kcal" style={{ color: "var(--muted-2)" }}>
                        —
                      </div>
                    )}

                    <div className="mc-cal-extra">
                      {day && day.water > 0 && (
                        <span className="w">
                          <Droplet aria-hidden="true" />
                          {Math.round(day.water / 100) / 10}L
                        </span>
                      )}
                      {day && day.bw !== null && (
                        <span className="m">
                          <Scale aria-hidden="true" />
                          {num(fromKg(day.bw, unit))}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            </div>
          </div>

          <div className="mc-cal-legend">
            <span>
              <span className="mc-dot prot" /> Protein
            </span>
            <span>
              <span className="mc-dot carb" /> Carbs
            </span>
            <span>
              <span className="mc-dot fat" /> Fat
            </span>
            <span>
              <Droplet aria-hidden="true" /> Water
            </span>
            <span>
              <Scale aria-hidden="true" /> Bodyweight
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
