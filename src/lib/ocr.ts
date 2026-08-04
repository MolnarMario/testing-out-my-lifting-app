/**
 * On-device OCR for nutrition labels. Tesseract is pulled in through a dynamic
 * import so its ~6 MB of engine and language data never touch the main bundle —
 * only someone who actually opens the scanner pays for it.
 *
 * The DOM work is confined to the exported entry points; the arithmetic below
 * them is pure, so it can be tested without a browser.
 */

import { findPanel, scalePanel } from "./panel.ts";
import type { WordBox } from "./panel.ts";

type TesseractModule = typeof import("tesseract.js");
type TesseractWorker = Awaited<ReturnType<TesseractModule["createWorker"]>>;

/** Romanian first, English alongside it for labels read while travelling. */
const LANGUAGES = "ron+eng";

/**
 * Engine and language data come from jsDelivr by default. Only the first scan
 * pays for them: tesseract keeps the language data in IndexedDB and the browser
 * caches the wasm, so later scans work with no connection.
 *
 * `npm run fetch-ocr-assets` writes the same files into public/ — about 13 MB,
 * since covering every device means shipping three builds of the core. Flip this
 * to true afterwards to make even the first scan network-free.
 */
const LOCAL_ASSETS: boolean = false;

/**
 * Recognition wants glyphs of a workable size — tesseract is happiest around
 * 30 px of capital height, which is why its own guidance asks for 300 DPI.
 *
 * That makes the target a band rather than a ceiling. A phone photo is far
 * larger than needed and only costs time, but a tight crop around a small
 * nutrition table can be far *smaller*, and shrinking that further is precisely
 * what makes a decimal comma disappear — turning 6,9 g of fat into 69.
 */
export interface SizeBand {
  maxEdge: number;
  minEdge: number;
}

/**
 * The whole frame, read only to find out where the nutrition table is. Its text
 * is thrown away, so it needs only enough detail to make row keywords
 * recognisable rather than to read numbers accurately.
 *
 * "Only enough" is still not much less than the reading pass, though: at 1500 px
 * a 12 MP frame put the keywords themselves at ~14 px and recall collapsed — a
 * measured run found three rows of an eight-row table and cropped confidently to
 * those, losing energy, fat and carbs. Recognising a word is not free just
 * because its text is discarded.
 */
export const LOCATE_BAND: SizeBand = { maxEdge: 2400, minEdge: 1200 };

/**
 * The pass whose numbers are actually kept, run on a crop of the panel.
 *
 * A panel is a fraction of the frame, so it can afford real resolution: this is
 * the band that puts a nutrition row above the ~30 px tesseract needs. Reading
 * the whole photo at this size instead would be a 10-megapixel job on a phone.
 */
export const READ_BAND: SizeBand = { maxEdge: 3800, minEdge: 1800 };

/**
 * No panel could be located, so the entire frame has to be read. Capped well
 * below READ_BAND because here the pixel count is the whole photo — and a frame
 * this busy is one the crop box exists to rescue.
 */
export const WHOLE_BAND: SizeBand = { maxEdge: 2600, minEdge: 1400 };

const MAX_EDGE = WHOLE_BAND.maxEdge;
const MIN_EDGE = WHOLE_BAND.minEdge;

/** Upscaling invents no detail; past this it only blurs and slows the scan. */
const MAX_UPSCALE = 3;

/**
 * Ignore the brightest and darkest 0.1% when stretching, so a glare highlight or
 * a dark speck cannot flatten the rest.
 *
 * This was 2%, and it was the reason scanning barely worked at all. Ink is a
 * small minority of a label photo — a few per cent of the pixels — so clipping
 * "the darkest 2%" clipped away most of the text itself, and the low end of the
 * stretch landed in the antialiasing ramp above it. Measured on a 12 MP frame
 * that produced a window of roughly [180, 236]: paper noise and JPEG ringing were
 * amplified across the full range and read as ink, taking a page tesseract read
 * perfectly at 110 words down to 22 words of nonsense.
 *
 * The clip is meant to discard outliers, which are a fraction of a per cent —
 * never a share of the histogram comparable to the ink. A large glare region is
 * beyond what any global rescale can fix anyway; that is adaptiveThreshold's job,
 * since it judges each pixel against its own neighbourhood.
 */
const CLIP_FRACTION = 0.001;

/**
 * Narrower than this and the "contrast" being stretched is noise rather than
 * signal, so the image is left alone. Guarding only against high <= low, as this
 * did, still let a nearly-collapsed window through — which is exactly the case
 * that does the damage.
 */
const MIN_SPAN = 32;

/** Local spread below this means uniform paper rather than an edge, on a 0..255 scale. */
const FLAT_DEVIATION = 10;

export interface OcrProgress {
  /** Tesseract's own stage name, e.g. "loading language traineddata". */
  status: string;
  /** 0..1 within the current stage. */
  progress: number;
  /** Which of the two passes this is, so the bar can explain itself restarting. */
  phase: OcrPhase;
}

export type OcrPhase = "locating" | "reading";

export interface OcrResult {
  text: string;
  /** Tesseract's page confidence, 0..100. Low values mean the photo was poor. */
  confidence: number;
  /** Whether the table was located and read from a crop, or the whole frame was read. */
  cropped: boolean;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// --- pure helpers ------------------------------------------------------------

/**
 * Sizes an image into the band recognition works best in: oversized photos are
 * scaled down, undersized crops are scaled up. Only shrinking, as this did
 * before, leaves a tight crop as small as it was captured — small enough that
 * the punctuation goes missing.
 */
export function fitForOcr(
  width: number,
  height: number,
  maxEdge: number = MAX_EDGE,
  minEdge: number = MIN_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= 0) return { width: 1, height: 1 };

  const scale =
    longest > maxEdge
      ? maxEdge / longest
      : longest < minEdge
        ? Math.min(minEdge / longest, MAX_UPSCALE)
        : 1;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Clamps a crop to the image, and treats a degenerate rectangle as no crop at all. */
export function clampCrop(
  crop: CropRect | null | undefined,
  width: number,
  height: number,
): CropRect {
  const whole = { x: 0, y: 0, width, height };
  if (!crop) return whole;

  // Intersect with the image rather than sliding the origin inside it: a
  // rectangle starting past the left edge covers less of the photo, not the
  // same width shifted right. Rounding the edges rather than the origin and
  // size separately keeps the result within a pixel of what was asked for.
  const left = Math.max(0, Math.round(crop.x));
  const top = Math.max(0, Math.round(crop.y));
  const right = Math.min(width, Math.round(crop.x + crop.width));
  const bottom = Math.min(height, Math.round(crop.y + crop.height));

  const w = right - left;
  const h = bottom - top;

  // A stray tap produces a rectangle a few pixels wide; recognising that is
  // worse than ignoring it.
  if (w < 16 || h < 16) return whole;
  return { x: left, y: top, width: w, height: h };
}

/**
 * Where an image is actually painted inside its element under `object-fit:
 * contain`, and by how much it was scaled to get there.
 *
 * The preview is capped in height, so a portrait photo — the usual shape for a
 * phone picture of a label — is letterboxed left and right rather than filling
 * its box. Treating the element's rectangle as the image would then put a
 * dragged crop somewhere else entirely.
 */
export function containRect(
  naturalWidth: number,
  naturalHeight: number,
  boxWidth: number,
  boxHeight: number,
): { x: number; y: number; width: number; height: number; scale: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0, scale: 0 };
  }

  const scale = Math.min(boxWidth / naturalWidth, boxHeight / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;

  return { x: (boxWidth - width) / 2, y: (boxHeight - height) / 2, width, height, scale };
}

/**
 * Maps a rectangle drawn on the preview back onto the photo's own pixels, which
 * is what recognition needs. Returns null when the drag was too small to be
 * anything but a stray tap.
 */
export function displayToSource(
  selection: { left: number; top: number; width: number; height: number },
  natural: { width: number; height: number },
  box: { width: number; height: number },
): CropRect | null {
  const painted = containRect(natural.width, natural.height, box.width, box.height);
  if (painted.scale <= 0) return null;

  const crop = clampCrop(
    {
      x: (selection.left - painted.x) / painted.scale,
      y: (selection.top - painted.y) / painted.scale,
      width: selection.width / painted.scale,
      height: selection.height / painted.scale,
    },
    natural.width,
    natural.height,
  );

  // clampCrop widens a tap-sized rectangle to the whole image; that is the same
  // as not cropping, and saying so lets the caller label the button honestly.
  const whole =
    crop.x === 0 && crop.y === 0 && crop.width === natural.width && crop.height === natural.height;
  return whole ? null : crop;
}

/**
 * Converts RGBA pixels to grey in place and stretches the contrast.
 *
 * Printed labels photograph badly: the paper is rarely white and glossy film
 * throws highlights that pin the histogram to both ends. Clipping a couple of
 * percent off each end before rescaling recovers the mid-tones the glyphs
 * actually live in. Tesseract does its own thresholding afterwards, so this
 * stops short of binarising — that would only throw away information.
 */
export function grayscaleStretch(pixels: Uint8ClampedArray): void {
  const count = pixels.length / 4;
  const luma = new Uint8Array(count);
  const histogram = new Uint32Array(256);

  for (let i = 0, p = 0; p < count; i += 4, p++) {
    const value = (pixels[i] * 299 + pixels[i + 1] * 587 + pixels[i + 2] * 114) / 1000;
    const level = value < 0 ? 0 : value > 255 ? 255 : Math.round(value);
    luma[p] = level;
    histogram[level]++;
  }

  // At least one pixel at each end, so a lone blown highlight is still discarded
  // however small the frame; on a real photo the fraction is what governs.
  const clip = Math.max(1, Math.floor(count * CLIP_FRACTION));
  let low = 0;
  let high = 255;

  for (let level = 0, seen = 0; level < 256; level++) {
    seen += histogram[level];
    if (seen > clip) {
      low = level;
      break;
    }
  }
  for (let level = 255, seen = 0; level >= 0; level--) {
    seen += histogram[level];
    if (seen > clip) {
      high = level;
      break;
    }
  }

  // A blank, single-tone or near-single-tone image has nothing worth stretching;
  // rescaling it only amplifies whatever noise it does have into false ink.
  const span = high - low;
  const flat = span < MIN_SPAN;

  for (let i = 0, p = 0; p < count; i += 4, p++) {
    const level = flat ? luma[p] : ((luma[p] - low) * 255) / span;
    pixels[i] = level;
    pixels[i + 1] = level;
    pixels[i + 2] = level;
    pixels[i + 3] = 255;
  }
}

/**
 * Local adaptive threshold (Sauvola), in place.
 *
 * A single cut-off across the whole frame — which is what tesseract applies on
 * its own — assumes the page is lit evenly. A photograph of a package never is:
 * one shadow, or the sheen off a curved wrapper, drags a whole region to one
 * side of the cut and the thin strokes there dissolve. That is what turns a
 * trailing "g" into a 9 and makes decimal commas disappear.
 *
 * Sauvola derives a threshold per pixel from the mean and spread of its own
 * neighbourhood, so each part of the image is judged against its surroundings
 * rather than against the brightest corner. Integral images keep it O(n).
 */
export function adaptiveThreshold(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  windowSize?: number,
  k = 0.2,
): void {
  const count = width * height;
  if (count === 0 || pixels.length < count * 4) return;

  // grayscaleStretch has already run, so the three channels are equal.
  const grey = new Uint8Array(count);
  for (let p = 0; p < count; p++) grey[p] = pixels[p * 4];

  // Roughly two to three character heights; too small eats the inside of thick
  // strokes, too large is just a global threshold again.
  const window = windowSize ?? Math.max(15, Math.round(Math.min(width, height) / 24));
  const radius = Math.max(1, window >> 1);

  const stride = width + 1;
  // Totals fit in 32 bits; the squares do not, and need the wider type.
  const sum = new Uint32Array(stride * (height + 1));
  const sumSq = new Float64Array(stride * (height + 1));

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    let rowSumSq = 0;
    for (let x = 0; x < width; x++) {
      const value = grey[y * width + x];
      rowSum += value;
      rowSumSq += value * value;
      sum[(y + 1) * stride + (x + 1)] = sum[y * stride + (x + 1)] + rowSum;
      sumSq[(y + 1) * stride + (x + 1)] = sumSq[y * stride + (x + 1)] + rowSumSq;
    }
  }

  const dynamicRange = 128;

  for (let y = 0; y < height; y++) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(height - 1, y + radius);

    for (let x = 0; x < width; x++) {
      const left = Math.max(0, x - radius);
      const right = Math.min(width - 1, x + radius);
      const area = (right - left + 1) * (bottom - top + 1);

      const a = top * stride + left;
      const b = top * stride + right + 1;
      const c = (bottom + 1) * stride + left;
      const d = (bottom + 1) * stride + right + 1;

      const mean = (sum[d] - sum[b] - sum[c] + sum[a]) / area;
      const meanSq = (sumSq[d] - sumSq[b] - sumSq[c] + sumSq[a]) / area;
      const deviation = Math.sqrt(Math.max(0, meanSq - mean * mean));

      const p = y * width + x;

      // With no spread there is no edge here, just paper — and on a smooth
      // lighting gradient the ramp alone would otherwise be read as strokes,
      // speckling every blank area with noise for tesseract to trip over. The
      // window is far wider than any stroke, so a flat one is never inside ink.
      const threshold = mean * (1 + k * (deviation / dynamicRange - 1));
      const ink = deviation >= FLAT_DEVIATION && grey[p] <= threshold ? 0 : 255;

      pixels[p * 4] = ink;
      pixels[p * 4 + 1] = ink;
      pixels[p * 4 + 2] = ink;
      pixels[p * 4 + 3] = 255;
    }
  }
}

// --- image preparation -------------------------------------------------------

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // PNG, not JPEG: compression artifacts land exactly on the thin strokes that
    // separate a 3 from an 8.
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The captured image could not be read."));
    }, "image/png");
  });
}

/**
 * Crops, downscales and cleans up a captured photo. Worth more accuracy than any
 * amount of parser tuning, and cheap enough to run on every scan.
 */
/** A prepared image together with the geometry needed to map results back. */
export interface Prepared {
  blob: Blob;
  /** The region of the original photo this was taken from, in its pixels. */
  source: CropRect;
  /** The size it was rendered at, which is the space tesseract reports boxes in. */
  width: number;
  height: number;
  /** The whole photo's size once EXIF rotation has been applied. */
  naturalWidth: number;
  naturalHeight: number;
}

export async function prepare(
  image: Blob,
  crop?: CropRect | null,
  band: SizeBand = WHOLE_BAND,
): Promise<Prepared> {
  // Phone cameras record orientation in EXIF rather than rotating the pixels;
  // without this a portrait photo reaches tesseract lying on its side.
  const bitmap = await createImageBitmap(image, { imageOrientation: "from-image" });

  try {
    const source = clampCrop(crop, bitmap.width, bitmap.height);
    const target = fitForOcr(source.width, source.height, band.maxEdge, band.minEdge);

    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("This browser cannot process the image.");

    // Resampling quality matters in both directions here: it decides whether a
    // decimal comma survives the resize or smears into the baseline.
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    context.drawImage(
      bitmap,
      source.x,
      source.y,
      source.width,
      source.height,
      0,
      0,
      target.width,
      target.height,
    );

    const frame = context.getImageData(0, 0, target.width, target.height);
    grayscaleStretch(frame.data);
    // Hand tesseract an already-binarised image, so its own global threshold —
    // which is what loses shadowed text on a photograph — has nothing to do.
    adaptiveThreshold(frame.data, target.width, target.height);
    context.putImageData(frame, 0, 0);

    return {
      blob: await canvasToBlob(canvas),
      source,
      width: target.width,
      height: target.height,
      naturalWidth: bitmap.width,
      naturalHeight: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}

/** The image alone, for callers that do not need the geometry. */
export async function preprocess(
  image: Blob,
  crop?: CropRect | null,
  band: SizeBand = WHOLE_BAND,
): Promise<Blob> {
  return (await prepare(image, crop, band)).blob;
}

// --- worker ------------------------------------------------------------------

let workerPromise: Promise<TesseractWorker> | null = null;
/** The logger is fixed when the worker is built, so the active listener lives here. */
let listener: ((progress: OcrProgress) => void) | null = null;
/** Likewise the pass in flight, which the logger has no other way to know. */
let phase: OcrPhase = "reading";
/** One worker, one job at a time — concurrent recognitions would interleave. */
let queue: Promise<unknown> = Promise.resolve();

function assetPath(folder: string): string {
  return new URL(folder, document.baseURI).href;
}

async function startWorker(): Promise<TesseractWorker> {
  // Page segmentation is set per scan instead, since it depends on whether the
  // photo was cropped to the table.
  const { createWorker } = await import("tesseract.js");

  const worker = await createWorker(LANGUAGES, undefined, {
    ...(LOCAL_ASSETS
      ? {
          workerPath: assetPath("tesseract/worker.min.js"),
          corePath: assetPath("tesseract/"),
          langPath: assetPath("tessdata/"),
        }
      : {}),
    logger: (message) => {
      listener?.({ status: message.status, progress: message.progress, phase });
    },
  });

  await worker.setParameters({
    // Column gaps are what separate the 100 g values from the per-portion ones.
    preserve_interword_spaces: "1",
    // Photos carry no DPI. Declaring one keeps tesseract from guessing badly.
    user_defined_dpi: "300",
  });

  return worker;
}

function getWorker(): Promise<TesseractWorker> {
  if (workerPromise === null) {
    workerPromise = startWorker().catch((error: unknown) => {
      // A failed load must not poison every later attempt — a dropped connection
      // mid-download should be retryable by pressing the button again.
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

/**
 * Begins loading the engine without recognising anything, so the download can
 * overlap with the user framing their shot rather than following it.
 */
export function warmUpOcr(onProgress?: (progress: OcrProgress) => void): Promise<void> {
  const mine = onProgress ?? null;
  listener = mine;

  // The engine can still be downloading when the user starts a scan. Clearing
  // unconditionally would then drop *their* listener, leaving the progress bar
  // frozen for the rest of a run — so only stand down if nobody took over.
  // Warming up is best-effort either way; a failure resurfaces on the real scan.
  const release = () => {
    if (listener === mine) listener = null;
  };

  return getWorker().then(release, release);
}

/** Flattens tesseract's block/paragraph/line tree down to the words themselves. */
function wordsOf(page: { blocks: unknown }): WordBox[] {
  const blocks = (page.blocks ?? []) as {
    paragraphs?: { lines?: { words?: { text: string; confidence: number; bbox: WordBox["bbox"] }[] }[] }[];
  }[];

  const words: WordBox[] = [];
  for (const block of blocks) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          words.push({ text: word.text, bbox: word.bbox, confidence: word.confidence });
        }
      }
    }
  }
  return words;
}

/**
 * Reads the text off a captured label photo.
 *
 * When the user has not framed the table themselves the photo is read twice:
 * once small and fast purely to find where the table is, then again on a crop of
 * it at real resolution. That second pass is the whole point — a nutrition table
 * in a 12 MP back-of-pack shot arrives around 21 px tall if the frame is read
 * whole, under the ~30 px recognition needs, which is why scanning an uncropped
 * photo used to fail almost every time.
 */
export function recognizeLabel(
  image: Blob,
  options?: { crop?: CropRect | null; onProgress?: (progress: OcrProgress) => void },
): Promise<OcrResult> {
  const run = queue.then(async (): Promise<OcrResult> => {
    listener = options?.onProgress ?? null;
    phase = "reading";
    try {
      const worker = await getWorker();
      const { PSM } = await import("tesseract.js");

      // A crop the user drew needs no locating; they have already said where the
      // table is, and it deserves the full reading resolution straight away.
      let crop = options?.crop ?? null;

      if (crop === null) {
        phase = "locating";
        const scout = await prepare(image, null, LOCATE_BAND);
        await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });

        const located = await worker.recognize(scout.blob, {}, { text: false, blocks: true });
        const panel = findPanel(wordsOf(located.data), scout.width, scout.height);

        // Boxes come back in the scout's downscaled pixels; the crop has to be
        // taken from the original photo, which is where the detail still is.
        if (panel !== null) {
          crop = scalePanel(
            panel,
            { width: scout.width, height: scout.height },
            { width: scout.naturalWidth, height: scout.naturalHeight },
          );
        }
      }

      // A cropped table really is one uniform block. A whole back panel is not
      // — it is a table sitting among headings, a paragraph of small print and
      // an address, and forcing that into one block is what jumbles the rows
      // and strands a value on the line above its label.
      phase = "reading";
      const prepared = await prepare(image, crop, crop === null ? WHOLE_BAND : READ_BAND);
      await worker.setParameters({
        tessedit_pageseg_mode: crop === null ? PSM.AUTO : PSM.SINGLE_BLOCK,
      });

      const { data } = await worker.recognize(prepared.blob, {}, { text: true, blocks: false });
      return { text: data.text, confidence: data.confidence, cropped: crop !== null };
    } finally {
      listener = null;
    }
  });

  // The queue must survive a failed job, or one bad scan blocks every later one.
  queue = run.catch(() => undefined);
  return run;
}

/** Releases the worker and its memory. Safe to call when nothing is running. */
export async function disposeOcr(): Promise<void> {
  const pending = workerPromise;
  workerPromise = null;
  if (pending === null) return;

  const worker = await pending.catch(() => null);
  await worker?.terminate();
}
