interface Props {
  value: string;
  onChange: (next: string) => void;
  /** Increment applied by the −/+ buttons. */
  step?: number;
  /** Optional quick-add buttons rendered on the trailing edge. */
  steps?: number[];
  suffix?: string;
  placeholder?: string;
  label: string;
  min?: number;
}

function round(n: number): number {
  // Keeps 2.5 + 0.5 from becoming 2.9999999999999996.
  return Math.round(n * 1000) / 1000;
}

export function NumberField({
  value,
  onChange,
  step = 1,
  steps,
  suffix,
  placeholder,
  label,
  min = 0,
}: Props) {
  function bump(delta: number) {
    const current = Number(value);
    const base = value === "" || Number.isNaN(current) ? 0 : current;
    onChange(String(round(Math.max(min, base + delta))));
  }

  return (
    <div className="num">
      <button className="num-btn" onClick={() => bump(-step)} aria-label={`Decrease ${label}`}>
        −
      </button>

      <div className="num-val">
        <input
          className="num-input"
          type="text"
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          aria-label={label}
          onChange={(e) => {
            const next = e.target.value;
            if (next === "" || /^\d*\.?\d*$/.test(next)) onChange(next);
          }}
        />
        {suffix && <span className="num-suffix">{suffix}</span>}
      </div>

      <button className="num-btn" onClick={() => bump(step)} aria-label={`Increase ${label}`}>
        +
      </button>

      {steps && steps.length > 0 && (
        <div className="num-steps">
          {steps.map((s) => (
            <button
              key={s}
              className="num-step"
              onClick={() => bump(s)}
              aria-label={`Add ${s} to ${label}`}
            >
              +{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
