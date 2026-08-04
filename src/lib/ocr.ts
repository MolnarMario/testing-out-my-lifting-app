/**
 * On-device OCR for nutrition labels. Tesseract is pulled in through a dynamic
 * import so its ~6 MB of engine and language data never touch the main bundle —
 * only someone who actually opens the scanner pays for it.
 *
 * The DOM work is confined to the exported entry points; the arithmetic below
 * them is pure, so it can be tested without a browser.
 */

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

/** Photos come off a phone far larger than tesseract can use. */
const MAX_EDGE = 1600;

/** Ignore the brightest and darkest 2% when stretching, so glare cannot flatten the rest. */
const CLIP_FRACTION = 0.02;

export interface OcrProgress {
  /** Tesseract's own stage name, e.g. "loading language traineddata". */
  status: string;
  /** 0..1 within the current stage. */
  progress: number;
}

export interface OcrResult {
  text: string;
  /** Tesseract's page confidence, 0..100. Low values mean the photo was poor. */
  confidence: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// --- pure helpers ------------------------------------------------------------

/** Scales an image down to fit inside `maxEdge`, never up. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = MAX_EDGE,
): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
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

  const clip = Math.floor(count * CLIP_FRACTION);
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

  // A blank or single-tone image has nothing to stretch; rescaling it would turn
  // the whole frame black for no gain.
  const flat = high <= low;
  const span = high - low;

  for (let i = 0, p = 0; p < count; i += 4, p++) {
    const level = flat ? luma[p] : ((luma[p] - low) * 255) / span;
    pixels[i] = level;
    pixels[i + 1] = level;
    pixels[i + 2] = level;
    pixels[i + 3] = 255;
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
export async function preprocess(image: Blob, crop?: CropRect | null): Promise<Blob> {
  // Phone cameras record orientation in EXIF rather than rotating the pixels;
  // without this a portrait photo reaches tesseract lying on its side.
  const bitmap = await createImageBitmap(image, { imageOrientation: "from-image" });

  try {
    const source = clampCrop(crop, bitmap.width, bitmap.height);
    const target = fitWithin(source.width, source.height);

    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("This browser cannot process the image.");

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
    context.putImageData(frame, 0, 0);

    return await canvasToBlob(canvas);
  } finally {
    bitmap.close();
  }
}

// --- worker ------------------------------------------------------------------

let workerPromise: Promise<TesseractWorker> | null = null;
/** The logger is fixed when the worker is built, so the active listener lives here. */
let listener: ((progress: OcrProgress) => void) | null = null;
/** One worker, one job at a time — concurrent recognitions would interleave. */
let queue: Promise<unknown> = Promise.resolve();

function assetPath(folder: string): string {
  return new URL(folder, document.baseURI).href;
}

async function startWorker(): Promise<TesseractWorker> {
  const { createWorker, PSM } = await import("tesseract.js");

  const worker = await createWorker(LANGUAGES, undefined, {
    ...(LOCAL_ASSETS
      ? {
          workerPath: assetPath("tesseract/worker.min.js"),
          corePath: assetPath("tesseract/"),
          langPath: assetPath("tessdata/"),
        }
      : {}),
    logger: (message) => {
      listener?.({ status: message.status, progress: message.progress });
    },
  });

  await worker.setParameters({
    // A nutrition table is one uniform block; the default page segmentation
    // hunts for a page layout that is not there and splits the columns badly.
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
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
  listener = onProgress ?? null;
  return getWorker().then(
    () => {
      listener = null;
    },
    () => {
      // Warming up is best-effort; a failure here resurfaces on the real scan.
      listener = null;
    },
  );
}

/** Reads the text off a captured label photo. */
export function recognizeLabel(
  image: Blob,
  options?: { crop?: CropRect | null; onProgress?: (progress: OcrProgress) => void },
): Promise<OcrResult> {
  const run = queue.then(async (): Promise<OcrResult> => {
    listener = options?.onProgress ?? null;
    try {
      const prepared = await preprocess(image, options?.crop);
      const worker = await getWorker();
      const { data } = await worker.recognize(prepared);
      return { text: data.text, confidence: data.confidence };
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
