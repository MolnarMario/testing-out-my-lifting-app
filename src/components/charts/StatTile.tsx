import { Sparkline } from "./Sparkline";

interface Props {
  label: string;
  value: string;
  unit?: string;
  /** Optional shape-over-time under the number. Hidden below two data points. */
  spark?: (number | null)[];
  sparkColor?: string;
}

/** A headline number for the range, in the same tile the month view already uses. */
export function StatTile({ label, value, unit, spark, sparkColor }: Props) {
  const hasSpark = !!spark && spark.filter((v) => v !== null).length >= 2;

  return (
    <div className={hasSpark ? "stat sparked" : "stat"}>
      <span className="v">
        {value}
        {unit && <span className="u">{unit}</span>}
      </span>
      <span className="k">{label}</span>
      {hasSpark && <Sparkline data={spark} color={sparkColor} />}
    </div>
  );
}
