import type { FoodType } from "./food";

/**
 * Reads a nutrition table out of OCR'd text. Romanian first, but English labels
 * parse too — the app travels, and outside the EU the panel is declared per
 * serving rather than per 100 g, which has to be rescaled before it is usable.
 *
 * Everything here is pure text -> data so it can be tested without an image.
 */

export const MACRO_KEYS = ["kcal", "protein", "carbs", "fat", "fiber"] as const;

export type MacroKey = (typeof MACRO_KEYS)[number];

export type MacroValues = Record<MacroKey, number>;

/** EU labels declare per 100 g/ml; the US "Nutrition Facts" panel declares per serving. */
export type LabelBasis = "per100" | "serving";

export interface LabelParse {
  /** Always per 100 g / 100 ml, rescaled from the serving when the label used one. */
  fields: MacroValues;
  /** False where nothing was read and the value fell back to 0, so the review UI can say so. */
  found: Record<MacroKey, boolean>;
  type: FoodType;
  basis: LabelBasis;
  /** Grams or millilitres in one serving, when the label declared a serving-based panel. */
  servingSize: number | null;
  warnings: string[];
  rawText: string;
}

export function emptyMacros(): MacroValues {
  return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
}

export const KJ_PER_KCAL = 4.184;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// --- text normalisation ------------------------------------------------------

/**
 * Folds the text down to plain lowercase ASCII so keyword matching never has to
 * care about diacritics. NFD splits ă â î ș ț into a base letter plus a combining
 * mark; dropping the marks also catches the legacy cedilla forms (ş ţ) that OCR
 * emits interchangeably with the correct comma-below ones.
 */
export function normalizeText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // '@' never appears on a nutrition table, but tesseract loves it for 'a'.
    .replace(/@/g, "a")
    // Table borders, otherwise they glue onto the numbers beside them.
    .replace(/\|/g, " ")
    .replace(/[‐-―]/g, "-")
    .replace(/[ \t ]+/g, " ");
}

// --- numbers -----------------------------------------------------------------

/** Digits tesseract reliably confuses. Only ever applied to already-numeric tokens. */
function repairDigits(token: string): string {
  return token.replace(/o/g, "0").replace(/[li]/g, "1");
}

/**
 * Nutrition tables are read in two conventions at once: Romanian writes 12,5 and
 * 1.234, English writes 12.5 and 1,234 — the same two glyphs, opposite meanings.
 * Rather than guess the language, infer from shape:
 *
 *   12,5     -> 12.5     separator with 1-2 trailing digits is a decimal point
 *   12.5     -> 12.5
 *   1.234    -> 1234     a lone separator with exactly 3 after it is a thousands mark
 *   1,234    -> 1234
 *   1.234,5  -> 1234.5   both present: the last one is the decimal point
 *   0,003    -> 0.003    nobody writes zero thousands
 *   <0,5     -> 0.5      the trace-amount prefix EU labels use
 *
 * Returns null for anything that is not a number, so callers can skip it.
 */
export function parseNumber(token: string): number | null {
  const trimmed = token.replace(/[\s<~≈]/g, "");
  if (!/^\d[\d.,]*$/.test(trimmed)) return null;

  const lastSeparator = Math.max(trimmed.lastIndexOf("."), trimmed.lastIndexOf(","));
  if (lastSeparator === -1) {
    const whole = Number(trimmed);
    return Number.isFinite(whole) ? whole : null;
  }

  const head = trimmed.slice(0, lastSeparator);
  const tail = trimmed.slice(lastSeparator + 1);

  const mixed = trimmed.includes(".") && trimmed.includes(",");
  const groupOfThree = /^\d{3}$/.test(tail);
  const zeroHead = /^0+$/.test(head.replace(/[.,]/g, ""));
  const isDecimal = mixed || !groupOfThree || zeroHead;

  const digits = isDecimal ? `${head.replace(/[.,]/g, "")}.${tail}` : trimmed.replace(/[.,]/g, "");
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

/** Number-ish runs, allowing the confusable letters but requiring one real digit. */
const NUMBER_TOKEN = /[<~≈]?[\dloi][\dloi.,]*/g;

/** "per 100 g" restates the basis on some rows; its 100 must not be read as a value. */
function stripBasisNoise(line: string): string {
  return line.replace(/(?:per|la|\/)?\s*\b100\s*(?:g|ml)\b/g, " ");
}

/** Any unit a nutrition row states its value in. */
const UNIT = /\b(?:g|mg|ml|kcal|kj)\b/;

/**
 * Undoes a trailing unit that was read as a digit.
 *
 * "6,5 g" comes back as "6,58" and "3,1 g" as "3,18" — a lowercase g against a
 * printed baseline is the single most common misread on these labels, and when
 * the space goes with it the unit lands inside the number.
 *
 * The tell is that the row then has no unit at all, which a real nutrition row
 * always does. That keeps a genuine two-decimal value safe: "Sare 0,45 g" keeps
 * its unit, so nothing is stripped.
 */
function repairTrailingUnit(token: string, line: string): string {
  if (UNIT.test(line)) return token;
  return /^\d+[.,]\d8$/.test(token) ? token.slice(0, -1) : token;
}

function numbersIn(line: string): number[] {
  const values: number[] = [];
  const cleaned = stripBasisNoise(line);
  for (const match of cleaned.matchAll(NUMBER_TOKEN)) {
    const token = match[0];
    if (!/\d/.test(token)) continue;
    const value = parseNumber(repairTrailingUnit(repairDigits(token), cleaned));
    if (value !== null) values.push(value);
  }
  return values;
}

function atColumn(values: number[], column: number): number | null {
  if (values.length === 0) return null;
  return values[Math.min(column, values.length - 1)];
}

// --- row classification ------------------------------------------------------

/**
 * Child rows restate part of the row above them — "din care acizi grași saturați"
 * under Grăsimi, "of which sugars" under Carbohydrate. Reading one as its parent
 * is the likeliest way to record a wrong number that still looks plausible, so
 * they are excluded two ways: by the "of which" marker, and by name for the US
 * panel, which indents its sub-rows instead of labelling them.
 */
const SUBROW_START = /^[\s\-–—•*.]*(din care|dincare|of which|ofwhich|amelybol|ebbol)/;
const SUBROW_INLINE = /(din care|dincare|of which|ofwhich|amelybol|ebbol)[\s\S]*$/;
const SKIP_ROW =
  /saturat|\btrans\b|zaharuri|\bsugars?\b|poliol|polyol|colesterol|cholesterol|amidon|\bstarch\b/;

const ENERGY = /energ|\bcalorii\b|\bcalories\b/;

/** Tolerant of the letter swaps OCR makes inside the keywords themselves. */
const ROWS: { key: Exclude<MacroKey, "kcal">; pattern: RegExp }[] = [
  { key: "fat", pattern: /gr[a4]s[i1]m|lipide|\bzsir\b|\bfat\b/ },
  { key: "carbs", pattern: /g[li1]ucide|carbohidrat|carbohydrate|szenhidrat/ },
  { key: "fiber", pattern: /f[i1l]br|f[i1l]ber|\brost\b/ },
  { key: "protein", pattern: /prote[i1l]n|feherje/ },
];

function isRowLine(line: string): boolean {
  return ENERGY.test(line) || ROWS.some((row) => row.pattern.test(line));
}

/**
 * Terms that mark a nutrition table without naming a row the parser stores:
 * the units energy is declared in, the sub-rows, and the heading above the lot.
 *
 * Sub-rows count here even though parseLabel deliberately skips them — they are
 * part of the table's shape, so finding them makes the located crop tighter and
 * the evidence for it stronger.
 */
const PANEL_EXTRA: { key: string; pattern: RegExp }[] = [
  { key: "unit", pattern: /\bkcal\b|\bkj\b/ },
  { key: "sugars", pattern: /zaharuri|\bsugars?\b/ },
  { key: "saturates", pattern: /saturat/ },
  { key: "salt", pattern: /\bsare\b|\bsalt\b|sodiu|sodium/ },
  { key: "heading", pattern: /nutrition/ },
];

/**
 * Which nutrition term a single word is, or null.
 *
 * The panel locator uses this to find the table in a photo before reading it.
 * The vocabulary lives here beside the row patterns rather than being copied
 * there, so a keyword the parser learns is one the locator can already find.
 */
export function panelTerm(word: string): string | null {
  const text = normalizeText(word).trim();
  if (text === "") return null;
  if (ENERGY.test(text)) return "energy";

  const row = ROWS.find((candidate) => candidate.pattern.test(text));
  if (row !== undefined) return row.key;

  const extra = PANEL_EXTRA.find((candidate) => candidate.pattern.test(text));
  return extra?.key ?? null;
}

/** Every row keyword at once, for finding the boundaries between collapsed rows. */
const ANY_ROW = new RegExp(
  [ENERGY.source, ...ROWS.map((row) => row.pattern.source)].join("|"),
  "g",
);

/**
 * Splits a line wherever a new row keyword begins. Tesseract does not reliably
 * preserve the line breaks of a table — a narrow or slightly rotated label can
 * come back with the whole declaration on one line, and without this only the
 * first row on it would ever be read.
 */
function segments(line: string): string[] {
  const starts: number[] = [];
  for (const match of line.matchAll(ANY_ROW)) {
    if (match.index !== undefined) starts.push(match.index);
  }
  // One keyword: keep the line whole, so a value printed ahead of its label is
  // still in range.
  if (starts.length <= 1) return [line];
  return starts.map((start, i) => line.slice(start, starts[i + 1] ?? line.length));
}

const KCAL_TOKEN = /([\dloi][\dloi.,]*)\s*k\s*c\s*a\s*[l1i]/g;
const KJ_TOKEN = /([\dloi][\dloi.,]*)\s*k\s*j\b/g;

function collect(line: string, pattern: RegExp): number[] {
  const values: number[] = [];
  for (const match of line.matchAll(pattern)) {
    const value = parseNumber(repairDigits(match[1]));
    if (value !== null) values.push(value);
  }
  return values;
}

/**
 * Finds an energy figure anywhere, ignoring keywords entirely.
 *
 * A number carrying kJ or kcal is self-labelling, and OCR routinely breaks the
 * energy row apart — leaving "186 kJ" on one line and "Valoarea energetică" on
 * the next, sometimes in that order. Looking only beside or after the keyword
 * throws the value away.
 */
function looseEnergy(lines: string[], column: number): { kcal: number | null; kj: number | null } {
  let kcal: number | null = null;
  let kj: number | null = null;

  for (const line of lines) {
    if (SUBROW_START.test(line)) continue;
    if (kcal === null) kcal = atColumn(collect(line, KCAL_TOKEN), column);
    if (kj === null) kj = atColumn(collect(line, KJ_TOKEN), column);
    if (kcal !== null && kj !== null) break;
  }

  return { kcal, kj };
}

/**
 * Which column carries the 100 g values. Labels that print a per-portion column
 * alongside declare both in a header row; without one, the 100 g figures come
 * first on every EU-compliant label.
 */
function detectColumn(lines: string[]): number {
  for (const line of lines) {
    const hundred = line.search(/\b100\s*(?:g|ml)\b/);
    const portion = line.search(/\b(?:portie|portii|portion|serving)/);
    if (hundred !== -1 && portion !== -1) return hundred < portion ? 0 : 1;
  }
  return 0;
}

// --- validation --------------------------------------------------------------

/**
 * Atwater: calories are roughly 4/4/9 per gram of protein/carb/fat, plus about 2
 * for fibre. EU labelling sometimes already counts fibre inside carbohydrate, so
 * both variants are tried and only a miss on both is worth reporting. This is the
 * check that catches a sub-row read as its parent.
 */
function atwaterOff(fields: MacroValues): number | null {
  if (fields.kcal <= 0) return null;
  const withFiber = 4 * fields.protein + 4 * fields.carbs + 9 * fields.fat + 2 * fields.fiber;
  const withoutFiber = 4 * fields.protein + 4 * fields.carbs + 9 * fields.fat;
  if (withFiber === 0) return null;
  const closest = Math.min(
    Math.abs(fields.kcal - withFiber),
    Math.abs(fields.kcal - withoutFiber),
  );
  return closest / fields.kcal;
}

function validate(fields: MacroValues, found: Record<MacroKey, boolean>, kj: number | null): string[] {
  const warnings: string[] = [];

  if (!found.kcal) warnings.push("No calorie value was found on the label.");

  const off = atwaterOff(fields);
  if (off !== null && off > 0.25) {
    warnings.push(
      `The macros do not add up to the calories (off by about ${Math.round(off * 100)}%). Check them against the label.`,
    );
  }

  if (kj !== null && fields.kcal > 0) {
    const ratio = kj / fields.kcal;
    if (ratio < 3.8 || ratio > 4.6) {
      warnings.push("The kJ and kcal values on the label disagree — one of them was misread.");
    }
  }

  if (fields.kcal > 900) warnings.push("That is more calories than any food has per 100 g.");

  const grams = fields.protein + fields.carbs + fields.fat;
  if (grams > 100) warnings.push("The macros add up to more than 100 g per 100 g.");

  for (const key of MACRO_KEYS) {
    if (key !== "kcal" && fields[key] > 100) {
      warnings.push(`${key} reads over 100 g per 100 g.`);
    }
  }

  return warnings;
}

// --- entry point -------------------------------------------------------------

export function parseLabel(raw: string): LabelParse {
  const text = normalizeText(raw);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");

  const column = detectColumn(lines);
  const fields = emptyMacros();
  const found: Record<MacroKey, boolean> = {
    kcal: false,
    protein: false,
    carbs: false,
    fat: false,
    fiber: false,
  };
  const warnings: string[] = [];
  let kj: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    if (SUBROW_START.test(lines[i])) continue;

    const parts = segments(lines[i]);

    for (let p = 0; p < parts.length; p++) {
      // Truncate before skipping: OCR often folds a child row onto the end of
      // its parent, and the parent's own value is still the first number on it.
      const body = parts[p].replace(SUBROW_INLINE, "");
      if (SKIP_ROW.test(body)) continue;

      // Tables whose label and value columns get split onto separate lines are
      // common enough to be worth following, as long as the next line is a
      // value. Only the last row on a line can own what follows it.
      const next = p === parts.length - 1 ? lines[i + 1] : undefined;
      const valuesFor = (line: string): number[] => {
        const own = numbersIn(line);
        if (own.length > 0 || next === undefined || isRowLine(next)) return own;
        return numbersIn(next);
      };

      if (ENERGY.test(body) && !/calories from fat/.test(body)) {
        const kjValue = atColumn(collect(body, KJ_TOKEN), column);
        if (kjValue !== null) kj = kjValue;

        const kcalValue = atColumn(collect(body, KCAL_TOKEN), column);
        if (kcalValue !== null && !found.kcal) {
          fields.kcal = kcalValue;
          found.kcal = true;
        } else if (kcalValue === null && kjValue === null && !found.kcal) {
          // The US panel writes a bare "Calories 240" with no unit at all.
          const bare = atColumn(valuesFor(body), column);
          if (bare !== null) {
            fields.kcal = bare;
            found.kcal = true;
          }
        }
        continue;
      }

      const row = ROWS.find((candidate) => candidate.pattern.test(body));
      if (row === undefined || found[row.key]) continue;

      const value = atColumn(valuesFor(body), column);
      if (value !== null) {
        fields[row.key] = value;
        found[row.key] = true;
      }
    }
  }

  // Nothing was found beside a keyword, so fall back to a figure that carries
  // its own unit wherever it landed.
  //
  // Holding a kJ figure is no reason to stop looking. OCR routinely breaks the
  // energy row in two — "Valoarea energetică 1966 kJ /" on one line and
  // "469 kcal" on the next — and gating this on kj being absent threw the
  // printed kcal away in exactly that case, quietly reporting a converted number
  // instead. A kcal printed on the label always beats one derived from kJ, since
  // deriving it doubles the damage when the kJ token itself was misread.
  if (!found.kcal) {
    const loose = looseEnergy(lines, column);
    if (loose.kcal !== null) {
      fields.kcal = loose.kcal;
      found.kcal = true;
    } else if (loose.kj !== null && kj === null) {
      kj = loose.kj;
    }
  }

  // Only the kJ figure was legible; the conversion is exact, so the value stands.
  if (!found.kcal && kj !== null) {
    fields.kcal = round2(kj / KJ_PER_KCAL);
    found.kcal = true;
    warnings.push("Calories were calculated from the kJ value on the label.");
  }

  const declaresHundred = /\b100\s*(?:g|ml)\b/.test(text);
  const servingPanel = /amount per serving|serving size|per serving|per portie|la o portie/.test(text);
  const basis: LabelBasis = !declaresHundred && servingPanel ? "serving" : "per100";

  const servingMatch = /serving size[^\n]*?(\d[\d.,]*)\s*(g|ml)\b/.exec(text);
  const servingSize = basis === "serving" && servingMatch ? parseNumber(servingMatch[1]) : null;

  if (basis === "serving") {
    if (servingSize !== null && servingSize > 0) {
      const factor = 100 / servingSize;
      for (const key of MACRO_KEYS) fields[key] = round2(fields[key] * factor);
      warnings.push(
        `The label is per ${servingSize} ${servingMatch?.[2] ?? "g"} serving; the values below were rescaled to 100.`,
      );
    } else {
      warnings.push(
        "The label is per serving but the serving size could not be read — these values are per serving, not per 100 g.",
      );
    }
  }

  const liquid = /\b100\s*ml\b/.test(text) || (basis === "serving" && servingMatch?.[2] === "ml");

  return {
    fields,
    found,
    type: liquid ? "liquid" : "solid",
    basis,
    servingSize,
    warnings: [...warnings, ...validate(fields, found, kj)],
    rawText: raw,
  };
}
