import { panelTerm } from "./label.ts";

/**
 * Finds the nutrition table inside a photographed package.
 *
 * This is what makes scanning a whole photo work. A back-of-pack shot from a
 * phone is ~4000 px wide, of which the nutrition table is a small corner; fitting
 * that frame into the size recognition wants leaves the table's text around 21 px
 * tall, well under the ~30 px tesseract needs, and buried among ingredients, an
 * address and a barcode. Reading it in one pass fails almost every time.
 *
 * So the frame is read once, cheaply, only to find out *where* the table is —
 * then cropped to it and read again at proper resolution. This module is the
 * middle step, and is pure so it can be tested without a browser or an engine.
 */

export interface WordBox {
  text: string;
  /** Pixel bounds in the image the words were recognised from. */
  bbox: { x0: number; y0: number; x1: number; y1: number };
  /** Tesseract's own certainty about this word, 0..100, when it reported one. */
  confidence?: number;
}

export interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * How many different nutrition terms must appear before a run of words is called
 * a nutrition table. Two is met by an ingredients list mentioning fat and salt in
 * passing; three effectively requires the real thing.
 */
const MIN_TERMS = 3;

/**
 * Vertical gap that ends a cluster, in multiples of the median keyword height.
 * A nutrition table is a tight vertical run of these words, so anything further
 * apart than a few text rows belongs to something else on the package.
 */
const ROW_GAP = 3;

/** Horizontal emptiness that means the next word belongs to another column of the package. */
const COLUMN_GAP_FRACTION = 0.15;

/**
 * Air around the crop. Vertical padding is much the more generous of the two:
 * keyword recall is never complete, so a table is routinely located from a subset
 * of its rows, and the rows that went unrecognised are directly above and below
 * the ones that did. Reaching past them costs a little resolution; clipping them
 * loses the values outright.
 */
const PAD_X_FRACTION = 0.06;
const PAD_Y_FRACTION = 0.3;

function centerY(word: WordBox): number {
  return (word.bbox.y0 + word.bbox.y1) / 2;
}

function heightOf(word: WordBox): number {
  return Math.abs(word.bbox.y1 - word.bbox.y0);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

interface Hit {
  word: WordBox;
  term: string;
}

/**
 * Splits keyword hits into vertical runs. Sorting by centre rather than top
 * keeps words of different sizes on the same row together — a table's heading is
 * often set larger than the rows beneath it.
 */
function cluster(hits: Hit[], gap: number): Hit[][] {
  const sorted = [...hits].sort((a, b) => centerY(a.word) - centerY(b.word));
  const clusters: Hit[][] = [];
  let current: Hit[] = [];

  for (const hit of sorted) {
    const previous = current[current.length - 1];
    if (previous !== undefined && centerY(hit.word) - centerY(previous.word) > gap) {
      clusters.push(current);
      current = [];
    }
    current.push(hit);
  }
  if (current.length > 0) clusters.push(current);

  return clusters;
}

function distinctTerms(hits: Hit[]): number {
  return new Set(hits.map((hit) => hit.term)).size;
}

function union(boxes: WordBox[]): PanelRect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;

  for (const box of boxes) {
    x0 = Math.min(x0, box.bbox.x0);
    y0 = Math.min(y0, box.bbox.y0);
    x1 = Math.max(x1, box.bbox.x1);
    y1 = Math.max(y1, box.bbox.y1);
  }

  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * Grows the box sideways to take in the value columns.
 *
 * The keywords are only the left column — "Grăsimi", "Glucide" — and the numbers
 * that matter sit to their right. Rather than guess how far right to reach, take
 * in any word already on these rows, stopping at a gap wide enough to mean a
 * different column of the package. Repeating until nothing more is added lets the
 * box cross the ordinary spacing between a label and its value.
 */
function widen(box: PanelRect, words: WordBox[], imageWidth: number): PanelRect {
  const maxGap = imageWidth * COLUMN_GAP_FRACTION;
  const top = box.y;
  const bottom = box.y + box.height;

  let left = box.x;
  let right = box.x + box.width;
  let grew = true;

  while (grew) {
    grew = false;
    for (const word of words) {
      // Only words sharing these rows; a word above or below is another part of
      // the package, however close horizontally.
      const middle = centerY(word);
      if (middle < top || middle > bottom) continue;
      if (word.bbox.x1 < left - maxGap || word.bbox.x0 > right + maxGap) continue;
      if (word.bbox.x0 >= left && word.bbox.x1 <= right) continue;

      left = Math.min(left, word.bbox.x0);
      right = Math.max(right, word.bbox.x1);
      grew = true;
    }
  }

  return { x: left, y: box.y, width: right - left, height: box.height };
}

function pad(box: PanelRect, imageWidth: number, imageHeight: number): PanelRect {
  const padX = box.width * PAD_X_FRACTION;
  const padY = box.height * PAD_Y_FRACTION;

  const x = Math.max(0, box.x - padX);
  const y = Math.max(0, box.y - padY);
  const right = Math.min(imageWidth, box.x + box.width + padX);
  const bottom = Math.min(imageHeight, box.y + box.height + padY);

  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Locates the nutrition table among recognised words, in the pixel space those
 * words were measured in. Returns null when the evidence is too thin to crop on
 * — the caller then reads the whole frame, as it did before.
 */
export function findPanel(
  words: WordBox[],
  imageWidth: number,
  imageHeight: number,
): PanelRect | null {
  if (imageWidth <= 0 || imageHeight <= 0) return null;

  const hits: Hit[] = [];
  for (const word of words) {
    const term = panelTerm(word.text);
    if (term !== null) hits.push({ word, term });
  }
  if (hits.length === 0) return null;

  // Scale the clustering gap to the text actually on this label, so it works the
  // same on a close-up as on a photo taken from arm's length.
  const rowHeight = median(hits.map((hit) => heightOf(hit.word)));
  const gap = rowHeight > 0 ? rowHeight * ROW_GAP : imageHeight;

  const clusters = cluster(hits, gap);

  let best: Hit[] | null = null;
  let bestTerms = 0;
  for (const candidate of clusters) {
    const terms = distinctTerms(candidate);
    // More different terms means more like a real table; a tie goes to the
    // denser run, which is the table rather than a passing mention of it.
    if (terms > bestTerms || (terms === bestTerms && best !== null && candidate.length > best.length)) {
      best = candidate;
      bestTerms = terms;
    }
  }

  if (best === null || bestTerms < MIN_TERMS) return null;

  const core = union(best.map((hit) => hit.word));
  const widened = widen(core, words, imageWidth);
  const padded = pad(widened, imageWidth, imageHeight);

  // Cropping to nearly the whole frame is not a crop; saying so lets the caller
  // skip the second pass rather than pay for an identical one.
  const covers = (padded.width * padded.height) / (imageWidth * imageHeight);
  if (covers > 0.9) return null;

  return padded;
}

/**
 * Maps a panel found in one image's pixels onto another's — the locating pass
 * runs on a downscaled frame, but the crop has to be taken from the original
 * photo, where the detail still is.
 */
export function scalePanel(
  panel: PanelRect,
  from: { width: number; height: number },
  to: { width: number; height: number },
): PanelRect {
  if (from.width <= 0 || from.height <= 0) return panel;

  const scaleX = to.width / from.width;
  const scaleY = to.height / from.height;

  return {
    x: panel.x * scaleX,
    y: panel.y * scaleY,
    width: panel.width * scaleX,
    height: panel.height * scaleY,
  };
}
