import type { FoodCategory, FoodType } from "./food.ts";
import { KJ_PER_KCAL, MACRO_KEYS, emptyMacros } from "./label.ts";
import type { MacroKey, MacroValues } from "./label.ts";

/**
 * The fast path into the pantry: read the barcode instead of the label. A hit is
 * exact, needs no OCR, and supplies the product name too.
 *
 * Strictly a shortcut. Missing detector, no barcode in frame, product not in the
 * database, offline, slow — every one of those returns null so the caller falls
 * through to reading the label, which always works.
 */

export interface BarcodeProduct {
  code: string;
  /** Empty when the database has the product but no name for this locale. */
  name: string;
  fields: MacroValues;
  found: Record<MacroKey, boolean>;
  type: FoodType;
  cat: FoodCategory;
}

/** Open Food Facts is free, key-less, CORS-open, and well stocked with Romanian products. */
const API = "https://world.openfoodfacts.org/api/v2/product";
const FIELDS = "product_name,product_name_ro,generic_name,brands,nutriments,quantity,categories_tags";

/** Long enough for a slow phone connection, short enough not to stall the scan. */
const TIMEOUT_MS = 6000;

// --- barcode validation ------------------------------------------------------

/**
 * EAN-13/8 and UPC-A carry a check digit. Verifying it locally is what stops a
 * single misread bar from silently fetching a different product's macros — the
 * one failure here that would look completely plausible.
 */
export function isValidBarcode(code: string): boolean {
  if (!/^\d+$/.test(code)) return false;
  if (![8, 12, 13, 14].includes(code.length)) return false;

  const digits = [...code].map(Number);
  const check = digits.pop() as number;

  // Weights run 3,1,3,1... leftward from the check digit, whatever the length.
  let sum = 0;
  for (let i = digits.length - 1, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    sum += digits[i] * weight;
  }

  return (10 - (sum % 10)) % 10 === check;
}

// --- mapping -----------------------------------------------------------------

/** Open Food Facts is crowd-sourced: numbers arrive as numbers, strings, or junk. */
function toNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string") {
    const value = Number(raw.replace(",", "."));
    return raw.trim() !== "" && Number.isFinite(value) ? value : null;
  }
  return null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

type Nutriments = Record<string, unknown>;

/**
 * Pulls per-100 g macros out of a product record. Energy is tried as kcal first,
 * then either kJ form — plenty of European entries carry only kJ.
 */
export function mapNutriments(nutriments: Nutriments): {
  fields: MacroValues;
  found: Record<MacroKey, boolean>;
} {
  const fields = emptyMacros();
  const found: Record<MacroKey, boolean> = {
    kcal: false,
    protein: false,
    carbs: false,
    fat: false,
    fiber: false,
  };

  const sources: Record<Exclude<MacroKey, "kcal">, string[]> = {
    protein: ["proteins_100g", "proteins"],
    carbs: ["carbohydrates_100g", "carbohydrates"],
    fat: ["fat_100g", "fat"],
    fiber: ["fiber_100g", "fiber"],
  };

  for (const [key, keys] of Object.entries(sources) as [Exclude<MacroKey, "kcal">, string[]][]) {
    for (const source of keys) {
      const value = toNumber(nutriments[source]);
      if (value !== null && value >= 0) {
        fields[key] = round2(value);
        found[key] = true;
        break;
      }
    }
  }

  const kcal = toNumber(nutriments["energy-kcal_100g"]) ?? toNumber(nutriments["energy-kcal"]);
  if (kcal !== null && kcal >= 0) {
    fields.kcal = round2(kcal);
    found.kcal = true;
  } else {
    // energy_100g is in kJ unless the entry says otherwise, which is the usual
    // case for products declared to the EU format.
    const kj = toNumber(nutriments["energy-kj_100g"]) ?? toNumber(nutriments["energy_100g"]);
    if (kj !== null && kj >= 0) {
      fields.kcal = round2(kj / KJ_PER_KCAL);
      found.kcal = true;
    }
  }

  return { fields, found };
}

/**
 * Roots of the tag tree that describe "edible thing" rather than what something
 * is. "plant-based-foods-and-beverages" sits above almonds and oat flakes alike,
 * so reading it as a drink turns half the pantry into liquid.
 */
const VAGUE_TAG = /foods?-and-beverages|^\w+:(groceries|a)$/;

const LIQUID_TAG = /\b(beverages?|drinks?|waters?|juices?|sodas?|colas?|milks?|bauturi?)\b/;

/** Tags carry capitals and locale prefixes; everything is matched folded. */
function usableTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.toLowerCase())
    .filter((tag) => !VAGUE_TAG.test(tag));
}

/**
 * Solid or liquid — which decides whether the pantry counts this in grams or
 * millilitres.
 *
 * The pack's declared quantity is the strongest signal available, because it is
 * the same unit the label's per-100 figures are declared in: yoghurt sold as
 * "140 g" is measured in grams however drinkable it looks. Tags are only a
 * fallback for entries with no quantity at all.
 */
export function guessType(product: { quantity?: unknown; categories_tags?: unknown }): FoodType {
  const quantity = typeof product.quantity === "string" ? product.quantity.toLowerCase() : "";

  if (/\d\s*(k?g|grame?)\b/.test(quantity)) return "solid";
  if (/\d\s*(ml|cl|l|litr[iu]|litre)\b/.test(quantity)) return "liquid";

  // Most specific first, so "mineral-waters" is reached before anything broad.
  const tags = usableTags(product.categories_tags);
  for (let i = tags.length - 1; i >= 0; i--) {
    if (LIQUID_TAG.test(tags[i])) return "liquid";
  }

  return "solid";
}

/**
 * Maps the database's tag vocabulary onto the app's ten categories.
 *
 * Short words are anchored on word boundaries because these patterns are tested
 * against whole tags: unanchored, the Romanian "ou" matches p-ou-ltry and
 * "seed" matches seedless. Hyphens and colons count as boundaries, so
 * "en:low-fat-milk" still matches a bounded "fat".
 */
const CATEGORY_RULES: { pattern: RegExp; cat: FoodCategory }[] = [
  { pattern: /\bnuts?\b|\bseeds?\b|almond|peanut|walnut|alun|seminte/, cat: "Nuts & Seeds" },
  { pattern: /legume|\bbeans?\b|lentil|chickpea|fasole|linte|\bnaut\b/, cat: "Legumes" },
  {
    pattern: /dairy|cheese|yogurt|yoghurt|milk|\beggs?\b|lactat|branz|iaurt|lapte|\bou\b/,
    cat: "Dairy & Eggs",
  },
  { pattern: /meat|fish|poultry|seafood|sausage|carne|peste|\bpui\b|mezel/, cat: "Meat & Fish" },
  { pattern: /beverage|drink|water|juice|soda|bautur|\bsuc\b/, cat: "Beverages" },
  { pattern: /fruit|berry|fruct/, cat: "Fruits" },
  { pattern: /vegetable|potato|\broots?\b|legum|cartof|radacin/, cat: "Vegetables & Roots" },
  {
    pattern: /cereal|bread|pasta|\brice\b|grain|flour|paine|\bpaste\b|orez|faina/,
    cat: "Grains & Bread",
  },
  { pattern: /\bfats?\b|\boils?\b|sauce|condiment|spread|butter|ulei|\bsos\b|\bunt\b/, cat: "Fats & Condiments" },
];

export function guessCategory(raw: unknown): FoodCategory {
  const tags = usableTags(raw);

  // Tags run general to specific, so the last one that matches anything is the
  // most precise description of what the product actually is. Testing them one
  // at a time is what makes that true — joined together, the broad tag's words
  // would win whenever its rule happened to be listed first.
  for (let i = tags.length - 1; i >= 0; i--) {
    const rule = CATEGORY_RULES.find((candidate) => candidate.pattern.test(tags[i]));
    if (rule !== undefined) return rule.cat;
  }

  return "Other";
}

/** Prefers the Romanian name, then the generic one, and prefixes the brand. */
export function productName(product: Record<string, unknown>): string {
  const pick = (key: string) => (typeof product[key] === "string" ? (product[key] as string).trim() : "");
  const name = pick("product_name_ro") || pick("product_name") || pick("generic_name");
  if (name === "") return "";

  const brand = pick("brands").split(",")[0]?.trim() ?? "";
  // "Napolact Iaurt grecesc" reads better than either half alone, but not when
  // the name already carries the brand.
  if (brand !== "" && !name.toLowerCase().includes(brand.toLowerCase())) {
    return `${brand} ${name}`;
  }
  return name;
}

/** Turns an API payload into a pantry-ready product, or null if it is unusable. */
export function toProduct(code: string, payload: unknown): BarcodeProduct | null {
  const body = (payload ?? {}) as Record<string, unknown>;
  if (body.status === 0 || typeof body.product !== "object" || body.product === null) return null;

  const product = body.product as Record<string, unknown>;
  const nutriments = (product.nutriments ?? {}) as Nutriments;
  const { fields, found } = mapNutriments(nutriments);

  // An entry with no calories is not worth interrupting the scan for; reading
  // the label will do better.
  if (!found.kcal) return null;

  return {
    code,
    name: productName(product),
    fields,
    found,
    type: guessType(product),
    cat: guessCategory(product.categories_tags),
  };
}

// --- detection and lookup ----------------------------------------------------

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

/** Chrome and Android expose this; Safari and Firefox do not. */
function detector(): BarcodeDetectorConstructor | null {
  const candidate = (globalThis as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  return typeof candidate === "function" ? candidate : null;
}

/** ZXing is happiest well under camera resolution, and far quicker there. */
const ZXING_MAX_EDGE = 1600;

/**
 * Greyscale pixels at a workable size, plus a quarter turn of them.
 *
 * A barcode on a box or a can is as often photographed sideways as upright, and
 * ZXing's 1-D readers only sweep horizontal lines — the platform detector handles
 * orientation itself, but the fallback has to be handed both ways round.
 */
function luminances(bitmap: ImageBitmap, quarterTurn: boolean): {
  data: Uint8ClampedArray;
  width: number;
  height: number;
} | null {
  const scale = Math.min(1, ZXING_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const width = quarterTurn ? h : w;
  const height = quarterTurn ? w : h;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) return null;

  if (quarterTurn) {
    context.translate(width, 0);
    context.rotate(Math.PI / 2);
  }
  context.drawImage(bitmap, 0, 0, w, h);

  const { data } = context.getImageData(0, 0, width, height);

  // A Uint8ClampedArray is read as one luminance byte per pixel; an RGBA frame
  // handed over whole would be decoded as noise.
  const grey = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; p < grey.length; i += 4, p++) {
    grey[p] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }

  return { data: grey, width, height };
}

/** The fallback for browsers with no BarcodeDetector. Loaded only when one is needed. */
async function zxingDetect(bitmap: ImageBitmap): Promise<string | null> {
  const { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } =
    await import("@zxing/library");

  const hints = new Map<number, unknown>([
    [
      DecodeHintType.POSSIBLE_FORMATS,
      [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E],
    ],
    // A label photo is one still frame, not a live viewfinder, so the extra
    // passes cost a moment once rather than every frame.
    [DecodeHintType.TRY_HARDER, true],
  ]);

  const reader = new MultiFormatReader();

  for (const quarterTurn of [false, true]) {
    const frame = luminances(bitmap, quarterTurn);
    if (frame === null) return null;

    try {
      const source = new RGBLuminanceSource(frame.data, frame.width, frame.height);
      const result = reader.decode(
        new BinaryBitmap(new HybridBinarizer(source)),
        hints as Map<never, never>,
      );
      const code = result.getText();
      if (isValidBarcode(code)) return code;
    } catch {
      // NotFoundException is the ordinary "no barcode this way round"; try the other.
    }
  }

  return null;
}

/** Reads the first plausible product barcode out of an image, if there is one. */
export async function detectBarcode(image: Blob): Promise<string | null> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(image, { imageOrientation: "from-image" });

    // The platform detector is faster and handles orientation itself, so it goes
    // first wherever it exists; ZXing covers everywhere else.
    const Detector = detector();
    if (Detector !== null) {
      const codes = await new Detector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
      }).detect(bitmap);

      // A misread check digit means someone else's macros, so only a valid code
      // is worth acting on.
      const native = codes.map((code) => code.rawValue).find(isValidBarcode);
      if (native !== undefined) return native;
    }

    return await zxingDetect(bitmap);
  } catch {
    // An unsupported format or a decode failure is just a miss.
    return null;
  } finally {
    bitmap?.close();
  }
}

/** Looks a barcode up. Returns null for anything short of a usable answer. */
export async function lookupBarcode(code: string): Promise<BarcodeProduct | null> {
  if (!isValidBarcode(code)) return null;

  try {
    const response = await fetch(`${API}/${encodeURIComponent(code)}.json?fields=${FIELDS}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return toProduct(code, await response.json());
  } catch {
    // Offline, blocked, timed out, or malformed — the label is still readable.
    return null;
  }
}

/** Barcode first, since it is exact; null means the caller should read the label. */
export async function scanBarcode(image: Blob): Promise<BarcodeProduct | null> {
  const code = await detectBarcode(image);
  return code === null ? null : lookupBarcode(code);
}

/** Fills any macro the database was missing, so the review form is never blank. */
export function macroDrafts(product: BarcodeProduct): Record<MacroKey, string> {
  const drafts = {} as Record<MacroKey, string>;
  for (const key of MACRO_KEYS) {
    drafts[key] = product.found[key] ? String(product.fields[key]) : "";
  }
  return drafts;
}
