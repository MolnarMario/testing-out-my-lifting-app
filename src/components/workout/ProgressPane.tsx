import { useMemo, useState } from "react";
import { ExercisePicker } from "./ExercisePicker";
import { ChartFrame } from "../charts/ChartFrame";
import { LineChart } from "../charts/LineChart";
import { BarChart } from "../charts/BarChart";
import { Heatmap } from "../charts/Heatmap";
import { StatTile } from "../charts/StatTile";
import { RangeSeg, isRangeKey, resolveRange } from "../charts/RangeSeg";
import type { RangeKey } from "../charts/RangeSeg";
import { GROUP_COLOR, GROUP_STACK, VIZ } from "../charts/palette";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useFood } from "../../hooks/useFood";
import type { DayMap } from "../../hooks/useDays";
import type { Maxes } from "../../hooks/useMaxes";
import {
  bodyweightSeries,
  dataBounds,
  e1rmSeries,
  sessionHeatmap,
  trainingKpis,
  weeklySetsByGroup,
  weeklyVolume,
} from "../../lib/stats";
import { alphaForHalfLife, daysBetween, ema, weekStart } from "../../lib/chart";
import {
  formatDateLong,
  formatDateShort,
  formatDuration,
  formatWeight,
  fromKg,
} from "../../lib/format";
import type { Exercise, Unit } from "../../lib/types";

interface Props {
  days: DayMap;
  library: Exercise[];
  maxes: Maxes;
  unit: Unit;
  onOpenDay: (date: string) => void;
}

/** Which lift the manually-entered 1RM belongs to, for the reference line. */
const MAX_FOR: Record<string, keyof Maxes> = {
  "def-squat": "squat",
  "def-bench-press": "bench",
  "def-deadlift": "deadlift",
};

/** Tonnage runs into six figures; the axis says 12k, the tooltip says the rest. */
function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 10000) return `${Math.round(value / 1000)}k`;
  if (abs >= 1000) return `${Number((value / 1000).toFixed(1))}k`;
  return String(Math.round(value));
}

export function ProgressPane({ days, library, maxes, unit, onOpenDay }: Props) {
  const [rangeKey, setRangeKey] = useLocalStorage<RangeKey>("ironlog.progress.range", "12w");
  const [liftId, setLiftId] = useLocalStorage<string>("ironlog.progress.lift", "");
  const [volumeScope, setVolumeScope] = useState<"all" | "lift">("all");
  const [picking, setPicking] = useState(false);

  const { state: food } = useFood();

  const range = useMemo(
    () => resolveRange(isRangeKey(rangeKey) ? rangeKey : "12w", dataBounds(days, food.days)?.from ?? null),
    [rangeKey, days, food.days],
  );

  /**
   * The lift the chart opens on: whichever has been logged most, so the first
   * thing shown is the one there is most to say about. Timed holds are skipped
   * — a plank has no meaningful one-rep max.
   */
  const defaultLift = useMemo(() => {
    const timed = new Set(library.filter((e) => e.timed).map((e) => e.id));
    const counts = new Map<string, number>();
    for (const day of Object.values(days)) {
      for (const s of day.sets) {
        if (timed.has(s.exerciseId)) continue;
        counts.set(s.exerciseId, (counts.get(s.exerciseId) ?? 0) + 1);
      }
    }
    let best = "";
    let bestCount = 0;
    for (const [id, count] of counts) {
      if (count > bestCount) {
        best = id;
        bestCount = count;
      }
    }
    return best || library.find((e) => !e.timed)?.id || "";
  }, [days, library]);

  const activeLift = library.some((e) => e.id === liftId) ? liftId : defaultLift;
  const lift = library.find((e) => e.id === activeLift) ?? null;

  const kpis = useMemo(() => trainingKpis(days, range), [days, range]);

  // Two series on purpose: the scoped one belongs to the volume card's own
  // toggle, while the tile and the shared-timeline panel always mean all lifts.
  // A control in one card must not quietly redraw another.
  const volume = useMemo(() => weeklyVolume(days, range), [days, range]);
  const scopedVolume = useMemo(
    () =>
      volumeScope === "all" || !activeLift
        ? volume
        : weeklyVolume(days, range, (s) => s.exerciseId === activeLift),
    [volume, days, range, volumeScope, activeLift],
  );
  const byGroup = useMemo(
    () => weeklySetsByGroup(days, library, range, GROUP_STACK),
    [days, library, range],
  );
  const heat = useMemo(() => sessionHeatmap(days, range), [days, range]);
  const e1rm = useMemo(
    () => (activeLift ? e1rmSeries(days, activeLift, range) : []),
    [days, activeLift, range],
  );

  // Weekly session counts, for the sparkline under the sessions tile.
  const sessionsPerWeek = useMemo(() => {
    const counts = new Map(volume.map((v) => [v.week, 0]));
    for (const [key, day] of Object.entries(days)) {
      if (day.sets.length === 0 || key < range.from || key > range.to) continue;
      const week = weekStart(key);
      if (counts.has(week)) counts.set(week, (counts.get(week) ?? 0) + 1);
    }
    return volume.map((v) => counts.get(v.week) ?? 0);
  }, [days, range, volume]);

  const bodyweight = useMemo(() => bodyweightSeries(food.days, range), [food.days, range]);
  const bwTrend = useMemo(() => ema(bodyweight, alphaForHalfLife(10)), [bodyweight]);
  const hasBodyweight = bodyweight.some((d) => d.value !== null);

  const w = (kg: number) => formatWeight(fromKg(kg, unit), unit);
  const maxKey = lift ? MAX_FOR[lift.id] : undefined;
  const manualMax = maxKey ? maxes[maxKey] : null;

  const trained = e1rm.length;
  const latest = e1rm[trained - 1] ?? null;
  const first = e1rm[0] ?? null;
  const gain = latest && first && trained > 1 ? latest.e1rm - first.e1rm : null;

  return (
    <div className="stagger">
      <RangeSeg
        value={isRangeKey(rangeKey) ? rangeKey : "12w"}
        onChange={setRangeKey}
        note={`${daysBetween(range.from, range.to) + 1} days · ${formatDateShort(range.from)} — ${formatDateShort(range.to)}`}
      />

      <div className="month-stats">
        <StatTile label="Sessions" value={String(kpis.sessions)} spark={sessionsPerWeek} />
        <StatTile label="Sets" value={String(kpis.sets)} />
        <StatTile
          label="Volume"
          value={Math.round(fromKg(kpis.volume, unit)).toLocaleString()}
          unit={unit}
          spark={volume.map((v) => v.value)}
          sparkColor={VIZ[0]}
        />
        <StatTile
          label="Avg session"
          value={kpis.avgMinutes === null ? "—" : formatDuration(kpis.avgMinutes)}
        />
        <StatTile
          label="Week streak"
          value={kpis.bestWeekStreak === 0 ? "—" : String(kpis.bestWeekStreak)}
        />
      </div>

      <ChartFrame
        title="Estimated 1RM"
        note={
          <button className="mc-ub" onClick={() => setPicking(true)}>
            {lift ? lift.name : "Pick a lift"}
          </button>
        }
        summary={
          latest
            ? `Estimated one-rep max for ${lift?.name}, ${trained} sessions, latest ${w(latest.e1rm)} ${unit}.`
            : "Estimated one-rep max over time."
        }
        table={{
          head: ["Date", "Top set", `Estimated 1RM (${unit})`],
          rows: e1rm.map((p) => [
            formatDateShort(p.key),
            `${w(p.weight)} × ${p.reps}`,
            w(p.e1rm) + (p.pr ? " (PR)" : ""),
          ]),
        }}
        empty={
          !lift
            ? "Add an exercise to the library first."
            : trained < 2
              ? `Log ${lift.name} on two or more days in this range to see a trend.`
              : null
        }
      >
        <LineChart
          labels={e1rm.map((p) => p.key)}
          series={[
            {
              label: lift?.name ?? "Lift",
              color: VIZ[0],
              data: e1rm.map((p) => p.e1rm),
              dots: true,
            },
          ]}
          highlight={e1rm.map((p, i) => (p.pr ? i : -1)).filter((i) => i >= 0)}
          refLines={
            manualMax !== null && manualMax > 0
              ? [{ value: manualMax, label: `Entered max ${w(manualMax)}` }]
              : []
          }
          yFormat={(v) => w(v)}
          xFormat={formatDateShort}
          tip={(i) => {
            const p = e1rm[i];
            if (!p) return null;
            return {
              head: formatDateLong(p.key),
              rows: [
                { label: "Top set", value: `${w(p.weight)} ${unit} × ${p.reps}` },
                { label: p.pr ? "Estimated 1RM · PR" : "Estimated 1RM", value: `${w(p.e1rm)} ${unit}` },
              ],
            };
          }}
          onPick={(i) => e1rm[i] && onOpenDay(e1rm[i].key)}
        />

        {gain !== null && (
          <p className="chart-hint">
            {gain >= 0 ? (
              <>
                Up <b className="up">{w(gain)} {unit}</b> across {trained} sessions.
              </>
            ) : (
              <>
                Down <b className="down">{w(Math.abs(gain))} {unit}</b> across {trained} sessions.
              </>
            )}{" "}
            Epley estimate from the best set of each session — a hard triple can out-rank a lighter
            single.
          </p>
        )}
      </ChartFrame>

      <ChartFrame
        title="Weekly volume"
        note={
          <span className="seg subtle" style={{ padding: 2 }}>
            {(
              [
                ["all", "All lifts"],
                ["lift", lift?.name ?? "Lift"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={volumeScope === key ? "seg-opt on" : "seg-opt"}
                style={{ fontSize: 10, padding: "3px 8px" }}
                onClick={() => setVolumeScope(key)}
              >
                {label}
              </button>
            ))}
          </span>
        }
        summary={`Weekly training volume in ${unit}, ${scopedVolume.length} weeks.`}
        table={{
          head: ["Week of", `Volume (${unit})`],
          rows: scopedVolume.map((v) => [formatDateShort(v.week), Math.round(fromKg(v.value, unit))]),
        }}
        empty={kpis.sessions === 0 ? "Nothing logged in this range yet." : null}
      >
        <BarChart
          labels={scopedVolume.map((v) => v.week)}
          series={[
            { label: "Volume", color: VIZ[0], data: scopedVolume.map((v) => fromKg(v.value, unit)) },
          ]}
          yFormat={compact}
          xFormat={formatDateShort}
          tip={(i) => {
            const week = scopedVolume[i];
            if (!week) return null;
            return {
              head: `Week of ${formatDateShort(week.week)}`,
              rows: [
                {
                  label: "Volume",
                  value: `${Math.round(fromKg(week.value, unit)).toLocaleString()} ${unit}`,
                },
              ],
            };
          }}
        />
        <p className="chart-hint">
          Weight × reps, summed over the week. Bodyweight movements logged at zero add nothing here.
        </p>
      </ChartFrame>

      <ChartFrame
        title="Weekly sets per group"
        note={`${GROUP_STACK.length} groups`}
        legend={GROUP_STACK.map((g) => ({ label: g, color: GROUP_COLOR[g] }))}
        summary="Hard sets per muscle group per week."
        table={{
          head: ["Week of", ...GROUP_STACK],
          rows: byGroup.map((w2) => [
            formatDateShort(w2.week),
            ...GROUP_STACK.map((g) => w2.value[g] ?? 0),
          ]),
        }}
        empty={kpis.sessions === 0 ? "Nothing logged in this range yet." : null}
      >
        <BarChart
          labels={byGroup.map((w2) => w2.week)}
          series={GROUP_STACK.map((g) => ({
            label: g,
            color: GROUP_COLOR[g],
            data: byGroup.map((w2) => w2.value[g] ?? 0),
          }))}
          yFormat={(v) => String(Math.round(v))}
          xFormat={formatDateShort}
          tip={(i) => {
            const week = byGroup[i];
            if (!week) return null;
            const rows = GROUP_STACK.filter((g) => (week.value[g] ?? 0) > 0).map((g) => ({
              label: g,
              value: String(week.value[g]),
              color: GROUP_COLOR[g],
            }));
            return {
              head: `Week of ${formatDateShort(week.week)}`,
              rows:
                rows.length > 0
                  ? rows
                  : [{ label: "Sets", value: "0" }],
            };
          }}
        />
        <p className="chart-hint">
          Weekly hard sets is the number most programmes are written around — easier to steer than
          tonnage, since it does not move when the weight does.
        </p>
      </ChartFrame>

      <ChartFrame
        title="Consistency"
        note={`${kpis.perWeek.toFixed(1)} / week`}
        summary={`Training days over ${heat.weeks.length} weeks; ${kpis.sessions} sessions.`}
        empty={kpis.sessions === 0 ? "Log a session to start the grid." : null}
      >
        <Heatmap cells={heat.cells} weeks={heat.weeks} onPick={onOpenDay} />
      </ChartFrame>

      {hasBodyweight && kpis.sessions > 0 && (
        <ChartFrame
          title="Bodyweight vs volume"
          note="Shared timeline"
          summary="Bodyweight trend above, weekly training volume below, on one shared timeline."
          empty={null}
        >
          <LineChart
            labels={bodyweight.map((d) => d.key)}
            series={[
              {
                label: "Bodyweight",
                color: VIZ[1],
                data: bodyweight.map((d) => (d.value === null ? null : fromKg(d.value, unit))),
                dotsOnly: true,
                dots: true,
                opacity: 0.45,
              },
              {
                label: "Trend",
                color: VIZ[1],
                data: bwTrend.map((v) => (v === null ? null : fromKg(v, unit))),
              },
            ]}
            height={120}
            yFormat={(v) => w(v)}
            xFormat={() => ""}
            tip={(i) => {
              const d = bodyweight[i];
              const t = bwTrend[i];
              if (!d || t === null) return null;
              return {
                head: formatDateLong(d.key),
                rows: [
                  ...(d.value !== null
                    ? [{ label: "Weighed", value: `${w(d.value)} ${unit}` }]
                    : []),
                  { label: "Trend", value: `${w(t)} ${unit}`, color: VIZ[1] },
                ],
              };
            }}
          />

          <BarChart
            labels={volume.map((v) => v.week)}
            series={[
              { label: "Volume", color: VIZ[0], data: volume.map((v) => fromKg(v.value, unit)) },
            ]}
            height={120}
            yFormat={compact}
            xFormat={formatDateShort}
            tip={(i) => {
              const week = volume[i];
              if (!week) return null;
              return {
                head: `Week of ${formatDateShort(week.week)}`,
                rows: [
                  {
                    label: "Volume",
                    value: `${Math.round(fromKg(week.value, unit)).toLocaleString()} ${unit}`,
                  },
                ],
              };
            }}
          />

          <p className="chart-hint">
            Two panels, one timeline — never two scales on one axis, which is the quickest way to
            invent a correlation that is not there.
          </p>
        </ChartFrame>
      )}

      {picking && (
        <ExercisePicker
          library={library.filter((e) => !e.timed)}
          selectedId={activeLift || null}
          onPick={(ex) => {
            setLiftId(ex.id);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
