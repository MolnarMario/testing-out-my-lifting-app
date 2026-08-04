import { Gauge, RotateCcw, Timer } from "lucide-react";
import { NumberField } from "../NumberField";
import { Meter } from "../Meter";
import { durationBetween, formatDuration } from "../../lib/format";

interface Props {
  start: string;
  end: string;
  manualMin: number | null;
  rating: number;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onManualChange: (v: number | null) => void;
  onRatingChange: (v: number) => void;
}

export function SessionCard({
  start,
  end,
  manualMin,
  rating,
  onStartChange,
  onEndChange,
  onManualChange,
  onRatingChange,
}: Props) {
  const auto = durationBetween(start, end);
  const effective = manualMin ?? auto;

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">
          <Timer aria-hidden="true" />
          Session
        </div>
      </div>

      <div className="time-grid">
        <div className="field">
          <span className="field-label">Start</span>
          <input
            type="time"
            value={start}
            aria-label="Session start time"
            onChange={(e) => onStartChange(e.target.value)}
          />
        </div>

        <div className="field">
          <span className="field-label">End</span>
          <input
            type="time"
            value={end}
            aria-label="Session end time"
            onChange={(e) => onEndChange(e.target.value)}
          />
        </div>

        <div className="dur-box">
          <span className="field-label">Duration</span>
          <div className="dur-display">
            <span className={effective === null ? "big empty-v" : "big"}>
              {effective === null ? "—" : formatDuration(effective)}
            </span>
            {effective !== null && (
              <span className="tag">{manualMin !== null ? "Manual" : "Auto"}</span>
            )}
            {manualMin !== null && (
              <button
                className="dur-reset"
                onClick={() => onManualChange(null)}
                aria-label="Clear manual duration"
              >
                <RotateCcw aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="meter-solo">
        <Meter
          label="Session"
          icon={<Gauge aria-hidden="true" />}
          value={rating}
          onChange={onRatingChange}
        />
      </div>

      <div className="manual-line">
        <span className="lbl">Or set manually</span>
        <NumberField
          label="Manual duration in minutes"
          value={manualMin === null ? "" : String(manualMin)}
          onChange={(next) => {
            const trimmed = next.trim();
            if (trimmed === "") {
              onManualChange(null);
              return;
            }
            const n = Number(trimmed);
            if (!Number.isNaN(n)) onManualChange(n);
          }}
          step={5}
          suffix="min"
          placeholder="—"
        />
      </div>
    </div>
  );
}
