import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Barbell } from "./Barbell";
import {
  IWF_BAR_DIMS,
  PLATE_CONFIG,
  RIG_DIMS,
  clamp,
  defaultsFor,
  fmt,
  legendChipClass,
  plateInk,
  round2,
  snapRequest,
  solveLoad,
} from "../../lib/plates";
import type { BarDimsKey, PlateDefaults } from "../../lib/plates";
import type { Unit } from "../../lib/types";

export interface PlatePreset {
  /** Weight in the currently displayed unit. */
  value: number;
  /** Bumped on every request so repeat loads of the same weight still apply. */
  nonce: number;
}

interface Props {
  unit: Unit;
  preset?: PlatePreset | null;
}

export function PlatesTab({ unit, preset }: Props) {
  const config = PLATE_CONFIG[unit];

  const [state, setState] = useState<PlateDefaults>(() => defaultsFor(unit));
  const [input, setInput] = useState(() => {
    const d = defaultsFor(unit);
    return d.requested === null ? "" : fmt(d.requested);
  });
  const weightRef = useRef<HTMLInputElement>(null);

  // Switching units swaps the whole plate set, so start from that unit's defaults.
  const lastUnit = useRef(unit);
  useEffect(() => {
    if (lastUnit.current === unit) return;
    lastUnit.current = unit;
    const next = defaultsFor(unit);
    setState(next);
    setInput(next.requested === null ? "" : fmt(next.requested));
  }, [unit]);

  const presetNonce = preset?.nonce;
  useEffect(() => {
    if (!preset) return;
    const value = clamp(round2(preset.value), 0, config.maxWeight);
    setState((prev) => ({ ...prev, requested: value <= 0 ? null : value, recordMode: false }));
    setInput(value <= 0 ? "" : fmt(value));
    // Keyed on the nonce so the same weight can be sent twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetNonce]);

  const activePlates =
    state.recordMode && unit === "kg" ? config.platesRecord : config.plates;

  const snap = snapRequest(
    state.requested,
    unit,
    state.barWeight,
    state.collarsWeight,
    state.recordMode,
    config.maxWeight,
  );

  const result = useMemo(
    () => solveLoad(snap.value, state.barWeight, state.collarsWeight, activePlates),
    [snap.value, state.barWeight, state.collarsWeight, activePlates],
  );

  const dims = RIG_DIMS[state.barDimsKey] ?? RIG_DIMS[20];
  const isBlank = result.status === "empty" || result.status === "below-min";

  const sliderMin = state.barWeight + state.collarsWeight;
  const sliderValue = clamp(state.requested ?? sliderMin, sliderMin, state.sliderMax);
  const sliderPct =
    state.sliderMax > sliderMin
      ? ((sliderValue - sliderMin) / (state.sliderMax - sliderMin)) * 100
      : 0;

  function setRequested(value: number | null, syncInput: boolean) {
    setState((prev) => ({ ...prev, requested: value }));
    if (syncInput) setInput(value === null ? "" : fmt(value));
  }

  function bump(delta: number) {
    const base = state.requested ?? state.barWeight + state.collarsWeight;
    const next = clamp(round2(base + delta), 0, config.maxWeight);
    setRequested(next <= 0 ? null : next, true);
  }

  function handleInput(raw: string) {
    let text = raw.replace(/,/g, ".").replace(/[^0-9.]/g, "");

    if (unit === "lb") {
      text = text.replace(/\./g, "");
    } else {
      const parts = text.split(".");
      if (parts.length > 2) text = `${parts[0]}.${parts.slice(1).join("")}`;
      const dot = text.indexOf(".");
      // kg plates go down to 0.25, so allow two decimals.
      if (dot >= 0 && text.length - dot > 3) text = text.slice(0, dot + 3);
    }

    setInput(text);

    if (text === "" || text === ".") {
      setState((prev) => ({ ...prev, requested: null }));
      return;
    }
    const parsed = parseFloat(text);
    setState((prev) => ({ ...prev, requested: Number.isFinite(parsed) ? parsed : null }));
  }

  // The prompt line has a strict precedence: the two easter eggs outrank
  // everything, then the kg record-mode offer, then the plain rounding and
  // minimum notices.
  const isIwf =
    state.barDimsKey === IWF_BAR_DIMS &&
    state.requested !== null &&
    state.requested > config.iwfLimit;

  const isEgg = !isIwf && state.requested !== null && state.requested > config.eggLimit;

  const offerRecordMode = !isIwf && !isEgg && snap.snapped && unit === "kg" && !state.recordMode;
  const roundedNote = !isIwf && !isEgg && snap.snapped && unit === "lb";
  const belowMin = !isIwf && !isEgg && !snap.snapped && result.status === "below-min";

  const note = belowMin
    ? `Minimum ${fmt(result.minWeight)} ${unit}`
    : roundedNote
      ? `Rounded to ${fmt(result.totalWeight)} ${unit}`
      : "";

  const showPrompt = isIwf || isEgg || offerRecordMode || roundedNote || belowMin;

  // Loading past the end of the sleeve is physically impossible — and the cue
  // for the original's Ronnie Coleman flash.
  const loadedWidth = result.plates.reduce((sum, p) => sum + p.plate.w * p.count, 0);
  const overflowing = loadedWidth > dims.sleeveLen;

  return (
    <div className="pl">
      <section className="pl-readout" aria-live="polite">
        <div className="pl-total">
          <span
            className={
              "pl-value" +
              (isBlank ? " is-empty" : result.status === "rounded" ? " is-rounded" : "")
            }
          >
            {isBlank ? "—" : fmt(result.totalWeight)}
          </span>
          <span className="pl-unit">{unit}</span>
          {!isBlank && (
            <span className="pl-lbs">
              / {config.toSecondary(result.totalWeight)} {config.secondary}
            </span>
          )}
        </div>

        <div className="pl-perside">
          <span className="pl-label">Per side</span>
          <span className="pl-pval">
            {isBlank ? "—" : `${fmt(result.perSideWeight)} ${unit}`}
          </span>
        </div>
      </section>

      <Barbell
        dims={dims}
        plates={result.plates}
        hasCollar={state.collarsWeight > 0}
        snapCollar={unit === "lb"}
        overflowing={overflowing}
      />

      <section className="pl-controls">
        <div>
          <label className="pl-flabel" htmlFor="pl-weight">
            Target weight
          </label>
          <div className="pl-stepper">
            <button
              className="pl-stepbtn"
              type="button"
              onClick={() => bump(-config.step)}
              aria-label="Decrease"
            >
              −
            </button>
            <div className="pl-stepin">
              <input
                id="pl-weight"
                ref={weightRef}
                className="pl-weight"
                type="text"
                inputMode="decimal"
                placeholder="0"
                autoComplete="off"
                value={input}
                onChange={(e) => handleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                  e.preventDefault();
                  const delta = e.shiftKey ? config.step : config.step * 2;
                  bump(e.key === "ArrowUp" ? delta : -delta);
                }}
              />
              <span className="pl-stepunit">{unit}</span>
            </div>
            <button
              className="pl-stepbtn"
              type="button"
              onClick={() => bump(config.step)}
              aria-label="Increase"
            >
              +
            </button>
          </div>

          {showPrompt && (
            <div className={isIwf ? "pl-prompt is-iwf" : "pl-prompt"}>
              {offerRecordMode && (
                <span className="pl-prompt-record">
                  <span className="pl-prompt-text">Use micro plates?</span>
                  <button
                    className="pl-prompt-btn"
                    type="button"
                    aria-label="Enable micro plates"
                    onClick={() => setState((prev) => ({ ...prev, recordMode: true }))}
                  >
                    ✓
                  </button>
                  <button
                    className="pl-prompt-btn"
                    type="button"
                    aria-label="Keep standard plates"
                    onClick={() => setRequested(snap.value, true)}
                  >
                    ✗
                  </button>
                </span>
              )}
              {note !== "" && <span className="pl-prompt-text">{note}</span>}

              {isEgg && (
                <span className="pl-prompt-text pl-prompt-egg">
                  Relax, buddy. You&apos;re not Jimmy Kolb.
                </span>
              )}

              {isIwf && (
                <span className="pl-prompt-iwf">NEW ALL TIME FEMALE IWF WORLD RECORD</span>
              )}
            </div>
          )}
        </div>

        <div className="pl-sliderwrap">
          <input
            type="range"
            className="pl-slider"
            min={sliderMin}
            max={state.sliderMax}
            step={config.step}
            value={sliderValue}
            style={{ "--pct": `${sliderPct}%` } as CSSProperties}
            onChange={(e) => setRequested(Number(e.target.value), true)}
            aria-label="Load from the bar up"
          />
          <div className="pl-ticks">
            <span>
              {fmt(sliderMin)} {unit}
            </span>
            <select
              className="pl-slidermax"
              value={state.sliderMax}
              aria-label="Slider maximum"
              onChange={(e) =>
                setState((prev) => ({ ...prev, sliderMax: Number(e.target.value) }))
              }
            >
              {config.maxOptions.map((option) => (
                <option key={option} value={option}>
                  {fmt(option)} {unit}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="pl-chips-label">
          Add or remove plate pairs (from <em>both</em> sleeves)
        </p>

        <div className="pl-quick" role="group" aria-label="Add a pair of plates">
          {config.addChips.map((chip) => (
            <button key={chip} className="pl-chip" type="button" onClick={() => bump(chip * 2)}>
              +{chip}
            </button>
          ))}
        </div>

        <div className="pl-quick" role="group" aria-label="Remove a pair of plates">
          {config.addChips.map((chip) => (
            <button
              key={chip}
              className="pl-chip pl-chip--sub"
              type="button"
              onClick={() => bump(-chip * 2)}
            >
              −{chip}
            </button>
          ))}
        </div>

        <div className="pl-clear-row">
          <button
            className="pl-chip pl-chip--clear"
            type="button"
            onClick={() => {
              setState((prev) => ({ ...prev, recordMode: false, requested: null }));
              setInput("");
              weightRef.current?.focus();
            }}
          >
            Clear
          </button>
        </div>

        <div className="pl-options">
          <div className="pl-seg" role="group" aria-label="Bar weight">
            {config.bars.map((bar) => (
              <button
                key={bar.dimsKey}
                type="button"
                className={"pl-segbtn" + (bar.dimsKey === state.barDimsKey ? " is-active" : "")}
                aria-pressed={bar.dimsKey === state.barDimsKey}
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    barWeight: bar.weight,
                    barDimsKey: bar.dimsKey as BarDimsKey,
                  }))
                }
              >
                {bar.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={"pl-toggle" + (state.collarsWeight > 0 ? " is-active" : "")}
            aria-pressed={state.collarsWeight > 0}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                collarsWeight: prev.collarsWeight === 0 ? config.collars : 0,
              }))
            }
          >
            <span className="pl-toggle-dot" aria-hidden="true" />
            Collars{" "}
            <span className="pl-toggle-val">
              {state.collarsWeight > 0 ? config.collarsLabel : `0 ${unit}`}
            </span>
          </button>
        </div>
      </section>

      <section className="pl-legend" aria-label="Plates required per side">
        {result.plates.length === 0 ? (
          <span className="pl-legend-empty">
            {result.status === "below-min"
              ? "Below minimum — nothing to load"
              : result.status === "empty"
                ? "Bar not loaded"
                : "Empty bar — no plates needed"}
          </span>
        ) : (
          result.plates.map(({ plate, count }, i) => {
            const { ink, bd } = plateInk(plate);
            return (
              <div
                key={plate.label}
                className={"pl-lchip" + legendChipClass(plate)}
                style={
                  {
                    animationDelay: `${i * 0.04}s`,
                    "--c": plate.color,
                    "--ink": ink,
                    "--bd": bd,
                  } as CSSProperties
                }
              >
                <span className="pl-lcount">{count}×</span>
                <span className="pl-lname">{plate.label}</span>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
