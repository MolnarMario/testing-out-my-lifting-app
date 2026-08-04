import { useState } from "react";
import { Beef, Droplet, Flame, Scale, ScanLine, Zap } from "lucide-react";
import {
  CAN_KCAL,
  CAN_ML,
  FOOD_CATEGORIES,
  baseUnitFor,
  fromBaseQty,
  num,
  toBaseQty,
  toggleUnit,
  totalsFor,
  unitLabel,
} from "../../lib/food";
import type { Food, FoodDay, FoodGoals, QtyUnit } from "../../lib/food";
import { addDays, formatDateLong, fromKg, roundKg, toKg, uid } from "../../lib/format";
import type { Unit } from "../../lib/types";

interface Props {
  date: string;
  onDateChange: (next: string) => void;
  day: FoodDay;
  pantry: Food[];
  goals: FoodGoals;
  unit: Unit;
  onUpdateDay: (patch: (day: FoodDay) => FoodDay) => void;
  onOpenGoals: () => void;
  onOpenCalendar: () => void;
  onOpenScan: () => void;
}

const MACROS = [
  { key: "protein", label: "Protein", tone: "prot" },
  { key: "carbs", label: "Carbs", tone: "carb" },
  { key: "fat", label: "Fat", tone: "fat" },
  { key: "fiber", label: "Fiber", tone: "fiber" },
] as const;

export function TodayPane({
  date,
  onDateChange,
  day,
  pantry,
  goals,
  unit,
  onUpdateDay,
  onOpenGoals,
  onOpenCalendar,
  onOpenScan,
}: Props) {
  const [foodId, setFoodId] = useState("");
  const [qty, setQty] = useState("");
  const [qtyUnit, setQtyUnit] = useState<QtyUnit>("g");
  const [shake, setShake] = useState(0);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const logged = totalsFor(day.entries);
  // Cans are tracked as a tap-count, but their calories are still calories.
  const canKcal = day.cans * CAN_KCAL;
  const totals = { ...logged, kcal: logged.kcal + canKcal };
  const selected = pantry.find((f) => f.id === foodId) ?? null;

  const kcalGoal = goals.kcal ?? 0;
  const overKcal = kcalGoal > 0 && totals.kcal > kcalGoal;
  const waterGoal = goals.water ?? 0;

  const qtyNum = Number(qty);
  const qtyValid = qty.trim() !== "" && Number.isFinite(qtyNum) && qtyNum > 0;
  const invalidFood = shake > 0 && !selected;
  const invalidQty = shake > 0 && !qtyValid;

  function pickFood(id: string) {
    setFoodId(id);
    const food = pantry.find((f) => f.id === id);
    if (food) setQtyUnit(baseUnitFor(food.type));
  }

  function addEntry() {
    if (!selected || !qtyValid) {
      // Bumping the key remounts the field so the shake animation replays.
      setShake((n) => n + 1);
      return;
    }

    const id = uid();
    onUpdateDay((d) => ({
      ...d,
      entries: [
        ...d.entries,
        {
          id,
          foodId: selected.id,
          name: selected.name,
          type: selected.type,
          qty: toBaseQty(qtyNum, qtyUnit),
          unit: qtyUnit,
          kcal: selected.kcal,
          fat: selected.fat,
          carbs: selected.carbs,
          fiber: selected.fiber,
          protein: selected.protein,
        },
      ],
    }));

    setLastAdded(id);
    setQty("");
    setShake(0);
  }

  return (
    <div className="mc-pane">
      <div className="datebar">
        <button className="round" onClick={() => onDateChange(addDays(date, -1))} aria-label="Previous day">
          ‹
        </button>
        <button
          type="button"
          className="mc-datefield"
          onClick={onOpenCalendar}
          title="Open food calendar"
        >
          <span className="mc-datelabel">{formatDateLong(date)}</span>
        </button>
        <button className="round" onClick={() => onDateChange(addDays(date, 1))} aria-label="Next day">
          ›
        </button>
      </div>

      <div className="card">
        <div className="mc-cap">
          <span>Calories</span>
          {kcalGoal > 0 && (
            <span className="mc-goalnote">
              {Math.round(totals.kcal)} / {Math.round(kcalGoal)}
            </span>
          )}
        </div>

        <div className="mc-figure">
          <span className="mc-kcal">{Math.round(totals.kcal)}</span>
          {kcalGoal > 0 ? (
            <span className={overKcal ? "mc-of over" : "mc-of"}>/ {Math.round(kcalGoal)} kcal</span>
          ) : (
            <span className="mc-of">kcal</span>
          )}
        </div>

        {kcalGoal > 0 ? (
          <>
            <div className="mc-line">
              <div
                className={overKcal ? "mc-linefill over" : "mc-linefill"}
                style={{ width: `${Math.min(100, (totals.kcal / kcalGoal) * 100)}%` }}
              />
            </div>
            <div className={overKcal ? "mc-remain over" : "mc-remain"}>
              {overKcal ? (
                <>
                  <b>{num(totals.kcal - kcalGoal)}</b> kcal over target
                </>
              ) : (
                <>
                  <b>{num(kcalGoal - totals.kcal)}</b> kcal left today
                </>
              )}
            </div>
          </>
        ) : (
          <button className="mc-setgoal" onClick={onOpenGoals}>
            Set a daily target ›
          </button>
        )}
      </div>

      <div className="card">
        {MACROS.map(({ key, label, tone }) => {
          const value = totals[key];
          const goal = goals[key] ?? 0;
          return (
            <div className="mc-mrow" key={key}>
              <div className="mc-mtop">
                <span className="mc-mname">
                  <span className={`mc-dot ${tone}`} />
                  {label}
                </span>
                <span className="mc-mval">
                  {goal > 0 ? (
                    <>
                      <b>{num(value)}</b> / {Math.round(goal)} g
                    </>
                  ) : (
                    <>
                      <b>{num(value)}</b> g
                    </>
                  )}
                </span>
              </div>
              {goal > 0 && (
                <div className="mc-track">
                  <div
                    className={`mc-fill ${tone}`}
                    style={{ width: `${Math.min(100, (value / goal) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mc-trackgrid mc-bio">
        <div className="card tight mc-tcard">
          <div className="mc-th">
            <span className="mc-tl">
              <Droplet className="mc-gi" aria-hidden="true" />
              Water
            </span>
            {waterGoal > 0 && (
              <span className="mc-goalnote">
                {Math.round(day.water)} / {Math.round(waterGoal)}
              </span>
            )}
          </div>

          <div className="mc-tval">
            {Math.round(day.water)}
            <span className="mc-tu">ml</span>
          </div>

          <div className={waterGoal > 0 && day.water > waterGoal ? "mc-tsub over" : "mc-tsub"}>
            {waterGoal > 0 ? (
              day.water > waterGoal ? (
                <>
                  <b>{num(day.water - waterGoal)} ml</b> over goal
                </>
              ) : (
                <>
                  <b>{num(waterGoal - day.water)} ml</b> to goal
                </>
              )
            ) : (
              "no goal set"
            )}
          </div>

          {waterGoal > 0 && (
            <div className="mc-wline">
              <div
                className="mc-wfill"
                style={{ width: `${Math.min(100, (day.water / waterGoal) * 100)}%` }}
              />
            </div>
          )}

          <div className="mc-tbtns">
            <button
              className="mc-stepb minus"
              aria-label="Remove 250 ml"
              disabled={day.water <= 0}
              onClick={() => onUpdateDay((d) => ({ ...d, water: Math.max(0, d.water - 250) }))}
            >
              −
            </button>
            <button
              className="mc-stepb"
              onClick={() => onUpdateDay((d) => ({ ...d, water: d.water + 250 }))}
            >
              +250
            </button>
            <button
              className="mc-stepb"
              onClick={() => onUpdateDay((d) => ({ ...d, water: d.water + 500 }))}
            >
              +500
            </button>
          </div>
        </div>

        <div className="card tight mc-tcard">
          <div className="mc-th">
            <span className="mc-tl">
              <Zap className="mc-gi" aria-hidden="true" />
              White Monster
            </span>
            {day.cans > 0 && <span className="mc-goalnote">{canKcal} kcal</span>}
          </div>

          <div className="mc-tval">
            {day.cans}
            <span className="mc-tu">{day.cans === 1 ? "can" : "cans"}</span>
          </div>

          <div className="mc-tsub">
            {day.cans > 0 ? (
              <>
                <b>{day.cans * CAN_ML} ml</b> counted toward water
              </>
            ) : (
              `${CAN_ML} ml a can`
            )}
          </div>

          <div className="mc-tbtns">
            <button
              className="mc-stepb minus"
              aria-label="One fewer can"
              disabled={day.cans <= 0}
              onClick={() => onUpdateDay((d) => ({ ...d, cans: Math.max(0, d.cans - 1) }))}
            >
              −
            </button>
            <button
              className="mc-stepb lg"
              aria-label="One more can"
              onClick={() => onUpdateDay((d) => ({ ...d, cans: d.cans + 1 }))}
            >
              +1
            </button>
          </div>
        </div>

        <div className="card tight mc-tcard bio">
          <div className="mc-th">
            <span className="mc-tl">
              <Scale className="mc-gi" aria-hidden="true" />
              Bodyweight
            </span>
          </div>

          <div className="mc-bw-in">
            <input
              key={date}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="—"
              aria-label={`Bodyweight in ${unit}`}
              defaultValue={day.bw === null ? "" : num(fromKg(day.bw, unit))}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              onBlur={(e) => {
                const parsed = parseFloat(e.target.value.replace(",", "."));
                const next =
                  Number.isFinite(parsed) && parsed > 0 ? roundKg(toKg(parsed, unit)) : null;
                onUpdateDay((d) => ({ ...d, bw: next }));
              }}
            />
            <span className="mc-tu">{unit}</span>
          </div>

          <div className="mc-tsub">logged for this day</div>
        </div>
      </div>

      {day.bw !== null && day.bw > 0 && totals.kcal > 0 && (
        <div className="card tight mc-bd">
          <div className="mc-bd-row">
            <span className="l">
              <Beef aria-hidden="true" />
              Protein per {unit}
            </span>
            <span className="v">
              {num(totals.protein / fromKg(day.bw, unit))}
              <span className="g"> g</span>
            </span>
          </div>
          <div className="mc-bd-row">
            <span className="l">
              <Flame aria-hidden="true" />
              Calories per {unit}
            </span>
            <span className="v">
              {num(totals.kcal / fromKg(day.bw, unit))}
              <span className="g"> kcal</span>
            </span>
          </div>
          <div className="mc-bd-row">
            <span className="l">
              <Droplet aria-hidden="true" />
              Water per {unit}
            </span>
            <span className="v">
              {num(day.water / fromKg(day.bw, unit))}
              <span className="g"> ml</span>
            </span>
          </div>
        </div>
      )}

      <div className="mc-seclab">
        Logged
        {day.entries.length > 0 && <span className="mc-ct">{day.entries.length}</span>}
      </div>

      <div className="mc-entries">
        {day.entries.length === 0 ? (
          <div className="mc-empty">
            <span className="mc-pin">Nothing logged yet</span>
            Use the bar below to add what you ate.
          </div>
        ) : (
          day.entries.map((entry) => {
            const factor = entry.qty / 100;
            const shown = num(fromBaseQty(entry.qty, entry.unit));
            return (
              <div
                className={entry.id === lastAdded ? "mc-entry enter" : "mc-entry"}
                key={entry.id}
              >
                <div className="mc-entry-body">
                  <div className="mc-entry-name">
                    {entry.name}
                    {entry.type === "liquid" && <span className="mc-tag liquid">liquid</span>}
                  </div>
                  <div className="mc-entry-sub">
                    {shown}
                    {unitLabel(entry.unit)}
                    <span className="mc-sep">·</span>
                    {num(entry.protein * factor)}P<span className="mc-sep">·</span>
                    {num(entry.carbs * factor)}C<span className="mc-sep">·</span>
                    {num(entry.fat * factor)}F
                  </div>
                </div>

                <div className="mc-entry-kc">
                  {Math.round(entry.kcal * factor)}
                  <span className="u">kcal</span>
                </div>

                <button
                  className="mc-entry-del"
                  aria-label={`Remove ${entry.name}`}
                  onClick={() =>
                    onUpdateDay((d) => ({
                      ...d,
                      entries: d.entries.filter((e) => e.id !== entry.id),
                    }))
                  }
                >
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="mc-addbar">
        {/* Eating something that is not in the pantry yet is exactly when the
            scanner is wanted, so it lives where that is noticed. */}
        <button
          type="button"
          className="mc-scan"
          onClick={onOpenScan}
          title="Scan a food label"
          aria-label="Scan a food label"
        >
          <ScanLine aria-hidden="true" />
        </button>

        <div className={invalidFood ? "mc-sel invalid" : "mc-sel"} key={`s${shake}`}>
          <select
            value={foodId}
            aria-label="Pick a food"
            disabled={pantry.length === 0}
            onChange={(e) => pickFood(e.target.value)}
          >
            <option value="">
              {pantry.length === 0 ? "No foods yet — add in Pantry" : "Pick a food…"}
            </option>
            {FOOD_CATEGORIES.map((cat) => {
              const items = pantry.filter((f) => f.cat === cat);
              if (items.length === 0) return null;
              return (
                <optgroup label={cat} key={cat}>
                  {items.map((f) => (
                    <option value={f.id} key={f.id}>
                      {f.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>

        <div className={invalidQty ? "mc-qty invalid" : "mc-qty"} key={`q${shake}`}>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            aria-label="Quantity"
            value={qty}
            disabled={pantry.length === 0}
            onChange={(e) => {
              const next = e.target.value;
              if (next === "" || /^\d*\.?\d*$/.test(next)) setQty(next);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addEntry();
              }
            }}
          />
          <button
            type="button"
            className="mc-uu"
            title="Switch unit"
            aria-label={`Unit: ${unitLabel(qtyUnit)}. Switch.`}
            onClick={() => setQtyUnit((u) => toggleUnit(u, selected?.type ?? "solid"))}
          >
            {unitLabel(qtyUnit)}
          </button>
        </div>

        <button
          className="mc-go"
          onClick={addEntry}
          disabled={pantry.length === 0}
          aria-label="Add to day"
        >
          +
        </button>
      </div>
    </div>
  );
}
