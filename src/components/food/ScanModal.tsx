import { useEffect, useRef, useState } from "react";
import { Barcode, Camera, ScanLine, X } from "lucide-react";
import { useEscape } from "../../hooks/useEscape";
import {
  FOOD_CATEGORIES,
  baseUnitFor,
  buildFood,
  toBaseQty,
  toggleUnit,
  unitLabel,
} from "../../lib/food";
import type { Food, FoodCategory, FoodType, QtyUnit } from "../../lib/food";
import { MACRO_KEYS, parseLabel } from "../../lib/label";
import type { MacroKey } from "../../lib/label";
import { displayToSource, recognizeLabel, warmUpOcr } from "../../lib/ocr";
import type { CropRect, OcrProgress } from "../../lib/ocr";
import { canDetectBarcodes, macroDrafts, scanBarcode } from "../../lib/barcode";

interface Props {
  pantry: Food[];
  onSave: (food: Food, log: { qty: number; unit: QtyUnit } | null) => void;
  onClose: () => void;
}

type Stage = "capture" | "barcode" | "framing" | "working" | "review";

/** Where the numbers in the review form came from, so the user can judge them. */
type Source = "barcode" | "label";

const MACRO_FIELDS: { key: MacroKey; label: string; unit: string }[] = [
  { key: "kcal", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "fiber", label: "Fiber", unit: "g" },
];

type Draft = Record<MacroKey, string>;

const EMPTY_DRAFT: Draft = { kcal: "", protein: "", carbs: "", fat: "", fiber: "" };

/** Below this, tesseract is telling us the photo was not really legible. */
const LOW_CONFIDENCE = 60;

/** Tesseract's stage names are internal; these are what the user is actually waiting on. */
function describe(status: string): string {
  if (status.includes("core") || status.includes("initializ")) return "Starting the engine";
  if (status.includes("lang") || status.includes("traineddata")) return "Loading Romanian + English";
  if (status.includes("recogniz")) return "Reading the label";
  return "Preparing";
}

interface Selection {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function ScanModal({ pantry, onSave, onClose }: Props) {
  const [stage, setStage] = useState<Stage>("capture");
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [progress, setProgress] = useState<OcrProgress>({ status: "", progress: 0 });
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [cat, setCat] = useState<FoodCategory>("Other");
  const [type, setType] = useState<FoodType>("solid");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [notes, setNotes] = useState<string[]>([]);
  const [source, setSource] = useState<Source>("label");

  const [qty, setQty] = useState("");
  const [qtyUnit, setQtyUnit] = useState<QtyUnit>("g");
  const [logToday, setLogToday] = useState(true);

  const imageRef = useRef<HTMLImageElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  /**
   * A barcode lookup waits on the network and a scan waits on the engine, so
   * either can finish after the user has closed the modal or moved to another
   * photo. Results are only applied while their token is still the current one.
   */
  const runRef = useRef(0);

  useEscape(onClose);

  useEffect(() => {
    return () => {
      // -1 never matches an issued token, so anything still in flight is dropped.
      runRef.current = -1;
    };
  }, []);

  // The engine is ~6 MB on the first scan. Fetching it while the user is still
  // taking the photo hides most of that wait.
  useEffect(() => {
    void warmUpOcr();
  }, []);

  // Object URLs outlive the component unless they are handed back. This cleanup
  // runs on every replacement as well as on unmount, so it is the only owner.
  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.url);
    };
  }, [photo]);

  function pick(file: File) {
    setPhoto({ file, url: URL.createObjectURL(file) });
    setDrag(null);
    setError("");

    // A barcode is exact and names the product too, so it is always worth the
    // second it costs. Everything about it is best-effort: no detector, no
    // barcode in frame, not in the database, offline — all fall through to
    // reading the label, which needs no network at all.
    if (canDetectBarcodes()) {
      setStage("barcode");
      void tryBarcode(file, ++runRef.current);
    } else {
      setStage("framing");
    }
  }

  async function tryBarcode(file: File, token: number) {
    const product = await scanBarcode(file).catch(() => null);
    if (runRef.current !== token) return;

    if (product === null) {
      setStage("framing");
      return;
    }

    setDraft(macroDrafts(product));
    setType(product.type);
    setCat(product.cat);
    setName(product.name);
    setQtyUnit(baseUnitFor(product.type));
    setSource("barcode");

    const missing = MACRO_KEYS.filter((key) => !product.found[key]);
    setNotes(
      missing.length > 0
        ? [`Open Food Facts had no ${missing.join(", ")} for this product. Add it from the label.`]
        : [],
    );

    setStage("review");
  }

  const selection: Selection | null =
    drag === null
      ? null
      : {
          left: Math.min(drag.x0, drag.x1),
          top: Math.min(drag.y0, drag.y1),
          width: Math.abs(drag.x1 - drag.x0),
          height: Math.abs(drag.y1 - drag.y0),
        };

  function pointIn(event: React.PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(event.clientX - box.left, box.width)),
      y: Math.max(0, Math.min(event.clientY - box.top, box.height)),
    };
  }

  /** The rectangle is drawn in displayed pixels; tesseract needs source pixels. */
  function sourceCrop(): CropRect | null {
    const image = imageRef.current;
    if (image === null || selection === null) return null;

    const box = image.getBoundingClientRect();
    return displayToSource(
      selection,
      { width: image.naturalWidth, height: image.naturalHeight },
      { width: box.width, height: box.height },
    );
  }

  async function scan(crop: CropRect | null) {
    if (photo === null) return;

    const token = ++runRef.current;
    setStage("working");
    setProgress({ status: "", progress: 0 });
    setError("");

    try {
      const result = await recognizeLabel(photo.file, {
        crop,
        onProgress: (next) => {
          if (runRef.current === token) setProgress(next);
        },
      });
      if (runRef.current !== token) return;

      const parse = parseLabel(result.text);

      const next: Draft = { ...EMPTY_DRAFT };
      for (const key of MACRO_KEYS) {
        // A value that was never read stays blank rather than claiming zero.
        next[key] = parse.found[key] ? String(parse.fields[key]) : "";
      }
      setDraft(next);
      setType(parse.type);

      const missing = MACRO_KEYS.filter((key) => !parse.found[key]);
      setNotes([
        ...parse.warnings,
        ...(missing.length > 0
          ? [`Not found on the label: ${missing.join(", ")}. Fill these in yourself.`]
          : []),
        ...(result.confidence < LOW_CONFIDENCE
          ? ["The photo was hard to read — check every number against the label."]
          : []),
      ]);

      setQtyUnit(baseUnitFor(parse.type));
      setSource("label");
      setStage("review");
    } catch (cause) {
      if (runRef.current !== token) return;
      setError(
        cause instanceof Error && cause.message !== ""
          ? cause.message
          : "The label could not be read. Try again with more light.",
      );
      setStage("framing");
    }
  }

  function save() {
    const result = buildFood({ name, cat, type, ...draft }, pantry);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    const amount = Number(qty);
    const valid = qty.trim() !== "" && Number.isFinite(amount) && amount > 0;
    if (logToday && !valid) {
      setError("Enter how much you had, or turn off adding it to today.");
      return;
    }

    onSave(result.food, logToday ? { qty: toBaseQty(amount, qtyUnit), unit: qtyUnit } : null);
  }

  return (
    <div
      className="day-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="day-modal scan-modal" role="dialog" aria-modal="true" aria-label="Scan a label">
        <div className="day-modal-head">
          <div className="day-modal-title">Scan a label</div>
          <button className="day-modal-x" onClick={onClose} aria-label="Close">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="day-modal-body">
          {stage === "capture" && (
            <>
              <p className="modal-note">
                Photograph the nutrition table — the panel with kcal, grăsimi, glucide and
                proteine. Romanian and English labels both work.
                {canDetectBarcodes() && " Or photograph the barcode, which is quicker still."}
              </p>
              <label className="scan-drop">
                <Camera aria-hidden="true" />
                <span className="t">Take a photo</span>
                <span className="d">or choose one from your device</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) pick(file);
                  }}
                />
              </label>
            </>
          )}

          {stage === "barcode" && (
            <div className="scan-working">
              <div className="scan-stage">Looking for a barcode</div>
              <div className="scan-bar">
                <div className="scan-fill indeterminate" />
              </div>
              <p className="modal-note">
                If the product is in Open Food Facts this fills everything in at once.
                Otherwise the label gets read instead.
              </p>
            </div>
          )}

          {stage === "framing" && photo !== null && (
            <>
              <p className="modal-note">
                Drag a box around just the nutrition table. That one step does more for
                accuracy than anything else — or scan the whole photo.
              </p>

              <div
                className="scan-frame"
                onPointerDown={(event) => {
                  const point = pointIn(event);
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDrag({ x0: point.x, y0: point.y, x1: point.x, y1: point.y });
                }}
                onPointerMove={(event) => {
                  if (drag === null) return;
                  const point = pointIn(event);
                  setDrag((prev) => (prev === null ? prev : { ...prev, x1: point.x, y1: point.y }));
                }}
                onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
              >
                <img ref={imageRef} src={photo.url} alt="The label you photographed" />
                {selection !== null && selection.width > 4 && (
                  <div
                    className="scan-sel"
                    style={{
                      left: selection.left,
                      top: selection.top,
                      width: selection.width,
                      height: selection.height,
                    }}
                  />
                )}
              </div>

              {error !== "" && <p className="hint">{error}</p>}

              <div className="scan-actions">
                <button className="mc-mini" onClick={() => setStage("capture")}>
                  Retake
                </button>
                {selection !== null && selection.width >= 16 && (
                  <button className="mc-mini" onClick={() => setDrag(null)}>
                    Clear box
                  </button>
                )}
                <button className="btn btn-primary" onClick={() => void scan(sourceCrop())}>
                  <ScanLine aria-hidden="true" />
                  {sourceCrop() === null ? "Scan whole photo" : "Scan selection"}
                </button>
              </div>
            </>
          )}

          {stage === "working" && (
            <div className="scan-working">
              <div className="scan-stage">{describe(progress.status)}</div>
              <div className="scan-bar">
                <div
                  className="scan-fill"
                  style={{ width: `${Math.round(Math.min(1, progress.progress) * 100)}%` }}
                />
              </div>
              <p className="modal-note">
                The first scan downloads the engine and both languages. After that it works
                with no connection.
              </p>
            </div>
          )}

          {stage === "review" && (
            <>
              <p className="modal-note">
                {source === "barcode"
                  ? `From Open Food Facts, per 100 ${type === "liquid" ? "ml" : "g"}. Worth a glance against the pack — the database is crowd-sourced.`
                  : `Read off the label, per 100 ${type === "liquid" ? "ml" : "g"}. Check them, then name it.`}
              </p>

              <div className="scan-src">
                {source === "barcode" ? (
                  <>
                    <Barcode aria-hidden="true" />
                    Barcode
                  </>
                ) : (
                  <>
                    <ScanLine aria-hidden="true" />
                    Label photo
                  </>
                )}
              </div>

              {notes.length > 0 && (
                <ul className="scan-notes">
                  {notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}

              <div className="add-ex-form">
                <div className="field grow">
                  <span className="field-label">Name</span>
                  <input
                    className="text-input"
                    value={name}
                    autoFocus
                    placeholder="What is it?"
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>

                <div className="field shrink">
                  <span className="field-label">Category</span>
                  <select
                    className="lib-select"
                    value={cat}
                    onChange={(event) => setCat(event.target.value as FoodCategory)}
                  >
                    {FOOD_CATEGORIES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field shrink">
                  <span className="field-label">Measured by</span>
                  <div className="seg subtle">
                    {(["solid", "liquid"] as const).map((option) => (
                      <button
                        key={option}
                        className={type === option ? "seg-opt on" : "seg-opt"}
                        onClick={() => {
                          setType(option);
                          // Otherwise a correction to "liquid" leaves the
                          // quantity still being entered in grams.
                          setQtyUnit(baseUnitFor(option));
                        }}
                      >
                        {option === "solid" ? "g" : "ml"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mc-grid2" style={{ marginTop: 12 }}>
                {MACRO_FIELDS.map(({ key, label, unit }) => (
                  <div className={draft[key] === "" ? "field scan-unread" : "field"} key={key}>
                    <span className="field-label">{label}</span>
                    <div className="mc-numwrap">
                      <input
                        className="text-input"
                        inputMode="decimal"
                        placeholder="0"
                        value={draft[key]}
                        aria-label={`${label} per 100`}
                        onChange={(event) => {
                          const next = event.target.value;
                          if (next === "" || /^\d*\.?\d*$/.test(next)) {
                            setDraft((prev) => ({ ...prev, [key]: next }));
                          }
                        }}
                      />
                      <span className="unit">{unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="scan-log">
                <button
                  type="button"
                  role="switch"
                  aria-checked={logToday}
                  aria-label="Also add this to today"
                  className={logToday ? "switch on" : "switch"}
                  onClick={() => setLogToday((on) => !on)}
                >
                  <span className="knob" />
                </button>

                <span className="scan-log-label">Also add to today</span>

                <div className="mc-qty">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    aria-label="How much you had"
                    value={qty}
                    disabled={!logToday}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (next === "" || /^\d*\.?\d*$/.test(next)) setQty(next);
                    }}
                  />
                  <button
                    type="button"
                    className="mc-uu"
                    title="Switch unit"
                    aria-label={`Unit: ${unitLabel(qtyUnit)}. Switch.`}
                    disabled={!logToday}
                    onClick={() => setQtyUnit((current) => toggleUnit(current, type))}
                  >
                    {unitLabel(qtyUnit)}
                  </button>
                </div>
              </div>

              {error !== "" && <p className="hint">{error}</p>}
            </>
          )}
        </div>

        {stage === "review" && (
          <div className="day-modal-foot">
            <button className="btn" onClick={() => setStage("framing")}>
              Back
            </button>
            <button className="btn btn-primary" onClick={save}>
              Add to pantry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
