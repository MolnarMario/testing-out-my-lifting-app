import { useMemo } from "react";
import { ChartFrame } from "../charts/ChartFrame";
import { LineChart } from "../charts/LineChart";
import { BarChart } from "../charts/BarChart";
import { StatTile } from "../charts/StatTile";
import { RangeSeg, isRangeKey, resolveRange } from "../charts/RangeSeg";
import type { RangeKey } from "../charts/RangeSeg";
import { MACRO_COLOR, MACRO_LABEL, MACRO_STACK, VIZ } from "../charts/palette";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import {
  bodyweightSeries,
  kcalSeries,
  macroAverages,
  macroSeries,
  macroShareSeries,
  nutritionKpis,
  proteinPerKgSeries,
  waterSeries,
} from "../../lib/stats";
import { alphaForHalfLife, daysBetween, ema, rollingMean } from "../../lib/chart";
import { num } from "../../lib/food";
import type { FoodDay, FoodGoals } from "../../lib/food";
import { formatDateLong, formatDateShort, fromKg, toKg } from "../../lib/format";
import type { Unit } from "../../lib/types";

interface Props {
  days: Record<string, FoodDay>;
  goals: FoodGoals;
  unit: Unit;
  onOpenDay: (date: string) => void;
  onOpenGoals: () => void;
}

/**
 * Evidence-based protein intake for a lifter, in grams per kilogram. Drawn as a
 * band rather than a single line because it is a range, not a number to land on.
 * Converted alongside the data when the app is showing pounds.
 */
const PROTEIN_BAND_PER_KG = { from: 1.6, to: 2.2 };

/** Earliest day with anything in it, so "All" starts where the log does. */
function earliestDay(days: Record<string, FoodDay>): string | null {
  const keys = Object.entries(days)
    .filter(([, d]) => d.entries.length > 0 || d.bw !== null || d.water > 0 || d.cans > 0)
    .map(([k]) => k)
    .sort();
  return keys[0] ?? null;
}

export function TrendsPane({ days, goals, unit, onOpenDay, onOpenGoals }: Props) {
  const [rangeKey, setRangeKey] = useLocalStorage<RangeKey>("ironlog.trends.range", "12w");

  const range = useMemo(
    () => resolveRange(isRangeKey(rangeKey) ? rangeKey : "12w", earliestDay(days)),
    [rangeKey, days],
  );

  const kcal = useMemo(() => kcalSeries(days, range), [days, range]);
  const kcalAvg = useMemo(() => rollingMean(kcal, 7), [kcal]);
  const protein = useMemo(() => macroSeries(days, range, "protein"), [days, range]);
  const water = useMemo(() => waterSeries(days, range), [days, range]);
  const bodyweight = useMemo(() => bodyweightSeries(days, range), [days, range]);
  // A 10-day half-life follows a real trend without chasing a salty Sunday.
  const bwTrend = useMemo(() => ema(bodyweight, alphaForHalfLife(10)), [bodyweight]);
  const shares = useMemo(() => macroShareSeries(days, range), [days, range]);
  const averages = useMemo(() => macroAverages(days, goals, range), [days, goals, range]);
  const perKg = useMemo(() => proteinPerKgSeries(days, range), [days, range]);
  const kpis = useMemo(() => nutritionKpis(days, range, bwTrend), [days, range, bwTrend]);

  const kcalGoal = goals.kcal ?? 0;
  const hasFood = kpis.daysLogged > 0;
  const hasBodyweight = bodyweight.filter((d) => d.value !== null).length >= 2;
  const hasPerKg = perKg.some((d) => d.value !== null);

  const bw = (kg: number) => num(fromKg(kg, unit));

  // "Per kg" becomes "per lb" by scaling with the kilograms in one display unit:
  // 180 g / 80 kg is the same intake as 180 g / 176 lb, one number just reads
  // 2.25 and the other 1.02. The reference band converts with it.
  const perUnit = toKg(1, unit);
  const band = {
    from: PROTEIN_BAND_PER_KG.from * perUnit,
    to: PROTEIN_BAND_PER_KG.to * perUnit,
  };

  return (
    <div className="stagger">
      <RangeSeg
        value={isRangeKey(rangeKey) ? rangeKey : "12w"}
        onChange={setRangeKey}
        note={`${kpis.daysLogged} of ${daysBetween(range.from, range.to) + 1} days logged`}
      />

      <div className="month-stats">
        <StatTile
          label="Avg calories"
          value={kpis.avgKcal === null ? "—" : String(Math.round(kpis.avgKcal))}
          spark={kcalAvg}
          sparkColor={VIZ[0]}
        />
        <StatTile
          label="Avg protein"
          value={kpis.avgProtein === null ? "—" : String(Math.round(kpis.avgProtein))}
          unit="g"
          spark={protein.map((d) => d.value)}
          sparkColor={MACRO_COLOR.protein}
        />
        <StatTile
          label="Avg water"
          value={kpis.avgWater === null ? "—" : String(Math.round(kpis.avgWater))}
          unit="ml"
          spark={water.map((d) => d.value)}
          sparkColor={VIZ[1]}
        />
        <StatTile
          label="Bodyweight"
          value={kpis.latestBw === null ? "—" : bw(kpis.latestBw)}
          unit={kpis.latestBw === null ? undefined : unit}
          spark={bwTrend}
          sparkColor={VIZ[1]}
        />
        <StatTile
          label="Trend / week"
          value={
            kpis.bwPerWeek === null
              ? "—"
              : `${kpis.bwPerWeek >= 0 ? "+" : "−"}${num(Math.abs(fromKg(kpis.bwPerWeek, unit)))}`
          }
          unit={kpis.bwPerWeek === null ? undefined : unit}
        />
      </div>

      <ChartFrame
        title="Calories"
        note={kcalGoal > 0 ? `Target ${Math.round(kcalGoal)}` : undefined}
        legend={[
          { label: "Daily", color: VIZ[4] },
          { label: "7-day average", color: VIZ[0], line: true },
        ]}
        summary={`Daily calories against a ${kcalGoal > 0 ? Math.round(kcalGoal) : "n unset"} target, with a seven-day rolling average.`}
        table={{
          head: ["Date", "Calories", "7-day average"],
          rows: kcal.map((d, i) => [
            formatDateShort(d.key),
            d.value === null ? "—" : Math.round(d.value),
            kcalAvg[i] === null ? "—" : Math.round(kcalAvg[i] as number),
          ]),
        }}
        empty={hasFood ? null : "Log a day of food to start the chart."}
      >
        <BarChart
          labels={kcal.map((d) => d.key)}
          series={[{ label: "Calories", color: VIZ[4], data: kcal.map((d) => d.value ?? 0) }]}
          overlay={{ label: "7-day average", color: VIZ[0], data: kcalAvg }}
          refLine={kcalGoal > 0 ? { value: kcalGoal, label: "Target" } : undefined}
          yFormat={(v) => String(Math.round(v))}
          xFormat={formatDateShort}
          tip={(i) => {
            const d = kcal[i];
            if (!d) return null;
            const avg = kcalAvg[i];
            return {
              head: formatDateLong(d.key),
              rows: [
                {
                  label: "Logged",
                  value: d.value === null ? "nothing" : `${Math.round(d.value)} kcal`,
                  color: VIZ[4],
                  tone:
                    d.value === null || kcalGoal <= 0
                      ? undefined
                      : d.value > kcalGoal
                        ? "over"
                        : "under",
                },
                ...(avg !== null
                  ? [{ label: "7-day avg", value: `${Math.round(avg)} kcal`, color: VIZ[0] }]
                  : []),
              ],
            };
          }}
          onPick={(i) => kcal[i] && onOpenDay(kcal[i].key)}
        />
        <p className="chart-hint">
          {kcalGoal > 0 ? (
            <>
              The rolling average is the line to steer by — a single day above target means nothing,
              a fortnight of them means something.
            </>
          ) : (
            <>
              No target set yet.{" "}
              <button className="mc-ub" onClick={onOpenGoals}>
                Set one in Goals
              </button>{" "}
              and it will appear here as a reference line.
            </>
          )}{" "}
          Days with nothing logged are gaps, not zeroes.
        </p>
      </ChartFrame>

      <ChartFrame
        title="Bodyweight"
        note={
          kpis.bwChange === null
            ? undefined
            : `${kpis.bwChange >= 0 ? "+" : "−"}${num(Math.abs(fromKg(kpis.bwChange, unit)))} ${unit}`
        }
        legend={[
          { label: "Weigh-ins", color: VIZ[1] },
          { label: "Trend", color: VIZ[1], line: true },
        ]}
        summary="Daily weigh-ins with a smoothed trend line."
        table={{
          head: ["Date", `Weighed (${unit})`, `Trend (${unit})`],
          rows: bodyweight
            .map((d, i) => ({ d, t: bwTrend[i] }))
            .filter(({ d }) => d.value !== null)
            .map(({ d, t }) => [
              formatDateShort(d.key),
              bw(d.value as number),
              t === null ? "—" : bw(t),
            ]),
        }}
        empty={
          hasBodyweight ? null : "Log your weight on two or more days — the Today pane has the field."
        }
      >
        <LineChart
          labels={bodyweight.map((d) => d.key)}
          series={[
            {
              label: "Weigh-ins",
              color: VIZ[1],
              data: bodyweight.map((d) => (d.value === null ? null : fromKg(d.value, unit))),
              dotsOnly: true,
              dots: true,
              opacity: 0.4,
            },
            {
              label: "Trend",
              color: VIZ[1],
              data: bwTrend.map((v) => (v === null ? null : fromKg(v, unit))),
            },
          ]}
          yFormat={(v) => num(v)}
          xFormat={formatDateShort}
          tip={(i) => {
            const d = bodyweight[i];
            const t = bwTrend[i];
            if (!d) return null;
            return {
              head: formatDateLong(d.key),
              rows: [
                {
                  label: "Weighed",
                  value: d.value === null ? "no weigh-in" : `${bw(d.value)} ${unit}`,
                },
                ...(t !== null ? [{ label: "Trend", value: `${bw(t)} ${unit}`, color: VIZ[1] }] : []),
              ],
            };
          }}
          onPick={(i) => bodyweight[i] && onOpenDay(bodyweight[i].key)}
        />
        {kpis.bwPerWeek !== null && (
          <p className="chart-hint">
            Trending{" "}
            <b className={kpis.bwPerWeek >= 0 ? "up" : "down"}>
              {kpis.bwPerWeek >= 0 ? "+" : "−"}
              {num(Math.abs(fromKg(kpis.bwPerWeek, unit)))} {unit}
            </b>{" "}
            per week. The line is an exponentially weighted average with a ten-day half-life, so it
            follows the drift and ignores the water weight.
          </p>
        )}
      </ChartFrame>

      <ChartFrame
        title="Macro averages"
        note={`${kpis.daysLogged} logged ${kpis.daysLogged === 1 ? "day" : "days"}`}
        summary="Average daily grams per macro against the configured goal."
        table={{
          head: ["Macro", "Average (g)", "Goal (g)"],
          rows: averages.map((m) => [MACRO_LABEL[m.macro], num(m.average), m.goal ?? "—"]),
        }}
        empty={hasFood ? null : "Log a day of food to see your averages."}
      >
        <div style={{ marginTop: 14 }}>
          {averages.map((m) => {
            const goal = m.goal ?? 0;
            // Bars scale to the goal, or to the value itself when no goal is set,
            // so an unset macro still shows something honest rather than nothing.
            const span = goal > 0 ? Math.max(goal, m.average) : Math.max(1, m.average);
            return (
              <div className="bullet" key={m.macro}>
                <div className="bullet-top">
                  <span className="bullet-name">
                    <span className="mc-dot" style={{ background: MACRO_COLOR[m.macro] }} />
                    {MACRO_LABEL[m.macro]}
                  </span>
                  <span className="bullet-val">
                    <b>{num(m.average)}</b> g
                    {goal > 0 && ` / ${Math.round(goal)} g · ${Math.round((m.average / goal) * 100)}%`}
                  </span>
                </div>
                <div className="bullet-track">
                  <div
                    className="bullet-fill"
                    style={{
                      width: `${Math.min(100, (m.average / span) * 100)}%`,
                      background: MACRO_COLOR[m.macro],
                    }}
                  />
                  {goal > 0 && (
                    <span
                      className="bullet-goal"
                      style={{ left: `${Math.min(100, (goal / span) * 100)}%` }}
                      title={`Goal ${Math.round(goal)} g`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="chart-hint">
          Averaged over logged days only — an unlogged day is missing data, not a zero-calorie one.
          The tick marks the goal.
        </p>
      </ChartFrame>

      <ChartFrame
        title="Macro composition"
        note="Share of macro grams"
        legend={MACRO_STACK.map((m) => ({ label: MACRO_LABEL[m], color: MACRO_COLOR[m] }))}
        summary="Each logged day's protein, fat, carbs and fibre as a share of that day's macro grams."
        table={{
          head: ["Date", ...MACRO_STACK.map((m) => `${MACRO_LABEL[m]} %`)],
          rows: shares.map((s) => [
            formatDateShort(s.key),
            ...MACRO_STACK.map((m) => `${Math.round(s[m] * 100)}%`),
          ]),
        }}
        empty={shares.length === 0 ? "Log a day of food to see the split." : null}
      >
        <BarChart
          labels={shares.map((s) => s.key)}
          series={MACRO_STACK.map((m) => ({
            label: MACRO_LABEL[m],
            color: MACRO_COLOR[m],
            data: shares.map((s) => s[m]),
          }))}
          percent
          yFormat={(v) => `${Math.round(v * 100)}%`}
          xFormat={formatDateShort}
          tip={(i) => {
            const s = shares[i];
            if (!s) return null;
            return {
              head: formatDateLong(s.key),
              rows: MACRO_STACK.map((m) => ({
                label: MACRO_LABEL[m],
                value: `${Math.round(s[m] * 100)}%`,
                color: MACRO_COLOR[m],
              })),
            };
          }}
          onPick={(i) => shares[i] && onOpenDay(shares[i].key)}
        />
        <p className="chart-hint">
          Share, not grams — this answers whether the balance is drifting, which the totals above
          cannot. Fibre is counted inside carbs on the label but split out here.
        </p>
      </ChartFrame>

      <ChartFrame
        title={`Protein per ${unit}`}
        note={`${num(band.from)}–${num(band.to)} g/${unit}`}
        summary={`Daily protein per ${unit} of bodyweight against the ${num(band.from)}–${num(band.to)} g/${unit} range.`}
        table={{
          head: ["Date", `g per ${unit}`],
          rows: perKg
            .filter((d) => d.value !== null)
            .map((d) => [formatDateShort(d.key), num((d.value as number) * perUnit)]),
        }}
        empty={
          hasPerKg ? null : "Needs both a bodyweight and a food log — add a weigh-in in the Today pane."
        }
      >
        <LineChart
          labels={perKg.map((d) => d.key)}
          series={[
            {
              label: `Protein per ${unit}`,
              color: MACRO_COLOR.protein,
              data: perKg.map((d) => (d.value === null ? null : d.value * perUnit)),
              dots: true,
            },
          ]}
          band={band}
          includeZero
          yFormat={(v) => num(v)}
          xFormat={formatDateShort}
          tip={(i) => {
            const d = perKg[i];
            if (!d || d.value === null) return null;
            return {
              head: formatDateLong(d.key),
              rows: [
                {
                  label: "Protein",
                  value: `${num(d.value * perUnit)} g/${unit}`,
                  color: MACRO_COLOR.protein,
                },
              ],
            };
          }}
          onPick={(i) => perKg[i] && onOpenDay(perKg[i].key)}
        />
        <p className="chart-hint">
          The shaded band is where the evidence puts a lifter's intake — a range to sit inside, not a
          number to land on. Bodyweight carries forward from the last weigh-in, since nobody steps on
          the scale daily.
        </p>
      </ChartFrame>
    </div>
  );
}
