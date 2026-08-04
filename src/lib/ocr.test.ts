import {
  LOCATE_BAND,
  READ_BAND,
  adaptiveThreshold,
  clampCrop,
  containRect,
  displayToSource,
  fitForOcr,
  grayscaleStretch,
} from "./ocr.ts";

let fails = 0;

function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    fails++;
    console.log(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  } else {
    console.log(`ok   ${name}  -> ${JSON.stringify(got)}`);
  }
}

/** Builds RGBA pixels from a list of grey levels; luma of a grey pixel is exact. */
function greys(levels: number[]): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(levels.length * 4);
  levels.forEach((level, i) => {
    pixels[i * 4] = level;
    pixels[i * 4 + 1] = level;
    pixels[i * 4 + 2] = level;
    pixels[i * 4 + 3] = 255;
  });
  return pixels;
}

/** Reads back one channel per pixel, which is all that survives greyscaling. */
function levelsOf(pixels: Uint8ClampedArray): number[] {
  const out: number[] = [];
  for (let i = 0; i < pixels.length; i += 4) out.push(pixels[i]);
  return out;
}

// --- downscaling -------------------------------------------------------------

check("landscape photo fits the long edge", fitForOcr(3000, 2000, 1600, 800), {
  width: 1600,
  height: 1067,
});
check("portrait photo fits the long edge", fitForOcr(2000, 3000, 1600, 800), {
  width: 1067,
  height: 1600,
});
check("an image already in the band is left alone", fitForOcr(1000, 750, 1600, 800), {
  width: 1000,
  height: 750,
});
check("exact fit is left alone", fitForOcr(1600, 900, 1600, 800), { width: 1600, height: 900 });
check("extreme aspect keeps a pixel", fitForOcr(4000, 100, 1600, 800), { width: 1600, height: 40 });
check("never collapses to zero", fitForOcr(4000, 1, 1600, 800), { width: 1600, height: 1 });
check("a degenerate size does not divide by zero", fitForOcr(0, 0, 1600, 800), {
  width: 1,
  height: 1,
});

// The bug behind a label whose decimal commas went missing: a tight crop was
// left at whatever size it was captured, and small text loses its punctuation
// first. Undersized crops are now scaled up into the band.
check("a small crop is scaled up", fitForOcr(400, 300, 1600, 800), { width: 800, height: 600 });
check("a very small crop is not blown up without limit", fitForOcr(100, 80, 1600, 800), {
  width: 300,
  height: 240,
});
check("the default band upscales a typical crop", fitForOcr(700, 500), { width: 1400, height: 1000 });
check("the default band shrinks a phone photo", fitForOcr(4000, 3000), { width: 2600, height: 1950 });

// --- the two passes ----------------------------------------------------------
// Reading a whole 12 MP frame at 2600 px left the nutrition table's text around
// 21 px tall, under the ~30 px tesseract needs — which is why scanning an
// uncropped photo failed. The locating pass may be small because its text is
// thrown away; the pass whose numbers are kept must not be.

check(
  "the locating pass stays cheap",
  fitForOcr(4032, 3024, LOCATE_BAND.maxEdge, LOCATE_BAND.minEdge),
  { width: 2400, height: 1800 },
);

// A panel cropped out of a 12 MP photo, roughly a quarter of the frame across.
const panelCrop = fitForOcr(1100, 850, READ_BAND.maxEdge, READ_BAND.minEdge);
check("a located panel is read at full size", panelCrop, { width: 1800, height: 1391 });

/** Cap height of a nutrition row, as a fraction of the region it sits in. */
function capHeight(region: { height: number }, fraction: number): number {
  return Math.round(region.height * fraction);
}

// In the whole frame the table's rows are ~1.1% of the height; once cropped to
// the panel they are ~8% of it. That difference is the fix.
check(
  "whole-frame rows land under what tesseract needs",
  capHeight(fitForOcr(4032, 3024), 0.011) < 30,
  true,
);
check("a cropped panel's rows clear it comfortably", capHeight(panelCrop, 0.08) >= 30, true);

// --- cropping ----------------------------------------------------------------

const whole = { x: 0, y: 0, width: 100, height: 80 };

check("no crop means the whole image", clampCrop(null, 100, 80), whole);
check("undefined crop means the whole image", clampCrop(undefined, 100, 80), whole);
check("a crop inside the image is kept", clampCrop({ x: 10, y: 10, width: 50, height: 40 }, 100, 80), {
  x: 10,
  y: 10,
  width: 50,
  height: 40,
});
check(
  "a crop running off the edge is clamped",
  clampCrop({ x: 60, y: 50, width: 500, height: 500 }, 100, 80),
  { x: 60, y: 50, width: 40, height: 30 },
);
// Intersection, not translation: a rectangle running off the top-left covers
// less of the image, rather than the same size slid inside it.
check(
  "an origin off the edge is intersected",
  clampCrop({ x: -20, y: -20, width: 50, height: 40 }, 100, 80),
  { x: 0, y: 0, width: 30, height: 20 },
);
// A stray tap on the preview should not send tesseract a 3-pixel sliver.
check(
  "a tap-sized rectangle falls back to the whole image",
  clampCrop({ x: 10, y: 10, width: 4, height: 3 }, 100, 80),
  whole,
);
check("fractional bounds are rounded", clampCrop({ x: 9.6, y: 10.4, width: 50.5, height: 40 }, 100, 80), {
  x: 10,
  y: 10,
  width: 50,
  height: 40,
});

// --- where the image is actually painted --------------------------------------
// The preview is height-capped, so a portrait photo is letterboxed left and
// right inside its element rather than filling it.

check("an exact fit has no letterbox", containRect(1000, 500, 400, 200), {
  x: 0,
  y: 0,
  width: 400,
  height: 200,
  scale: 0.4,
});
// 3:4 portrait in a 4:3 box: bars down the sides.
check("a portrait photo is letterboxed sideways", containRect(600, 800, 400, 400), {
  x: 50,
  y: 0,
  width: 300,
  height: 400,
  scale: 0.5,
});
// 2:1 landscape in a square box: bars above and below.
check("a landscape photo is letterboxed vertically", containRect(800, 400, 400, 400), {
  x: 0,
  y: 100,
  width: 400,
  height: 200,
  scale: 0.5,
});
check("a degenerate box paints nothing", containRect(600, 800, 0, 400).scale, 0);
check("a missing image paints nothing", containRect(0, 0, 400, 400).scale, 0);

// --- mapping a drag back onto the photo ---------------------------------------

// No letterbox: a 2x downscale, so displayed pixels double on the way back.
check(
  "a drag maps back through the downscale",
  displayToSource(
    { left: 100, top: 50, width: 200, height: 100 },
    { width: 800, height: 400 },
    { width: 400, height: 200 },
  ),
  { x: 200, y: 100, width: 400, height: 200 },
);

// The bug this function exists for: with 50 px bars down each side, a drag
// starting at x=50 is on the photo's left edge. Without removing the offset it
// would map to x=100, putting the crop 100 px into the image.
check(
  "the letterbox offset is removed",
  displayToSource(
    { left: 50, top: 0, width: 150, height: 400 },
    { width: 600, height: 800 },
    { width: 400, height: 400 },
  ),
  { x: 0, y: 0, width: 300, height: 800 },
);
check(
  "a crop inside a letterboxed photo maps correctly",
  displayToSource(
    { left: 125, top: 100, width: 150, height: 200 },
    { width: 600, height: 800 },
    { width: 400, height: 400 },
  ),
  { x: 150, y: 200, width: 300, height: 400 },
);

// A drag that strays into the bars still has to land inside the photo.
check(
  "a drag from the letterbox is clamped into the photo",
  displayToSource(
    { left: 0, top: 0, width: 200, height: 400 },
    { width: 600, height: 800 },
    { width: 400, height: 400 },
  ),
  { x: 0, y: 0, width: 300, height: 800 },
);

// A stray tap is not a crop, and saying so lets the caller label the button.
check(
  "a tap-sized drag is not a crop",
  displayToSource(
    { left: 100, top: 100, width: 3, height: 3 },
    { width: 800, height: 400 },
    { width: 400, height: 200 },
  ),
  null,
);
check(
  "a full-frame drag is not a crop either",
  displayToSource(
    { left: 0, top: 0, width: 400, height: 200 },
    { width: 800, height: 400 },
    { width: 400, height: 200 },
  ),
  null,
);
check(
  "an unmeasured box yields nothing",
  displayToSource({ left: 0, top: 0, width: 10, height: 10 }, { width: 800, height: 400 }, { width: 0, height: 0 }),
  null,
);

// --- contrast ----------------------------------------------------------------
// At least one pixel is clipped from each end whatever the size, so these need
// more than a handful: with four pixels the clip would be half the image, and
// there is genuinely no way to tell an outlier from signal in four samples.
// A hundred of each level puts the ends well clear of the clip.

const stretched = greys([50, 100, 150, 200].flatMap((level) => Array<number>(100).fill(level)));
grayscaleStretch(stretched);
const stretchedLevels = levelsOf(stretched);
check(
  "mid-tones are stretched across the range",
  [stretchedLevels[0], stretchedLevels[100], stretchedLevels[200], stretchedLevels[300]],
  [0, 85, 170, 255],
);

const colour = new Uint8ClampedArray([
  255, 0, 0, 255, 255, 0, 0, 255, // two red pixels, luma 76
  0, 0, 255, 255, 0, 0, 255, 255, // two blue, luma 29
]);
grayscaleStretch(colour);
check("colour collapses to grey", levelsOf(colour), [255, 255, 0, 0]);
check("alpha is forced opaque", colour[3], 255);
check(
  "channels end up equal",
  [colour[0] === colour[1], colour[1] === colour[2]],
  [true, true],
);

// A blank frame has nothing to stretch. Rescaling it would drive the whole image
// to black, which reads as a bug when the preview is shown back to the user.
const flat = greys([128, 128, 128, 128]);
grayscaleStretch(flat);
check("a flat image is left alone", levelsOf(flat), [128, 128, 128, 128]);

const black = greys([0, 0, 0, 0]);
grayscaleStretch(black);
check("an all-black image does not divide by zero", levelsOf(black), [0, 0, 0, 0]);

// Glare is the reason for clipping at all. A label photographed under a shop
// light has its text in a narrow band of mid-tones plus a blown-out highlight;
// scaling against that highlight would squash the text into the bottom quarter
// of the range. Here 49 pixels run 60..108 and one is blown to 255.
const glare = greys([...Array<number>(49).fill(0).map((_, i) => 60 + i), 255]);
grayscaleStretch(glare);
const glareLevels = levelsOf(glare);

check("the mid-tone band is opened to the full range", glareLevels[48] - glareLevels[0], 255);
check("the darkest mid-tone bottoms out", glareLevels[0], 0);
// Without clipping this pixel would land near 63, a quarter of the way up.
check("the brightest mid-tone reaches the top", glareLevels[48], 255);
check("the blown highlight clamps rather than setting the scale", glareLevels[49], 255);

// The bug that made scanning fail almost every time. Ink is a small minority of
// a label photo, so a clip sized like the ink itself eats the text: the low end
// of the stretch lands in the paper instead of the letters, and what gets
// amplified across the full range is paper noise. Measured on a real frame this
// took a page tesseract read at 110 words down to 22 words of nonsense.
//
// 1000 pixels of paper around 235, twenty of ink around 25 — 2% ink, which is
// typical. The window must still open on the ink.
const sparse = greys([
  ...Array<number>(1000).fill(0).map((_, i) => 233 + (i % 5)),
  ...Array<number>(20).fill(0).map((_, i) => 24 + (i % 3)),
]);
grayscaleStretch(sparse);
const sparseLevels = levelsOf(sparse);

check("sparse ink still reaches black", sparseLevels[1000], 0);
check("and the paper still reaches white", sparseLevels[999] > 200, true);
// The failure mode: paper varying by 4 levels blown apart into hundreds.
check(
  "paper stays paper rather than becoming texture",
  Math.max(...sparseLevels.slice(0, 1000)) - Math.min(...sparseLevels.slice(0, 1000)) < 30,
  true,
);

// The flip side: a frame that is genuinely one tone plus a speck of glare has no
// range to recover, and is left as it is rather than driven to black.
const speck = greys([...Array<number>(49).fill(60), 255]);
grayscaleStretch(speck);
check("a uniform frame with a speck of glare is left alone", levelsOf(speck)[0], 60);

// --- adaptive threshold -------------------------------------------------------
// The point of this is text that survives uneven lighting. A photograph of a
// package always has a bright side and a shadowed side, and one cut-off across
// the whole frame loses whichever end falls the wrong side of it.

/** Paper running bright on the left to deep shadow on the right, with dark ink on it. */
function litPage(width: number, height: number, inkAt: (x: number, y: number) => boolean) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const paper = 235 - Math.round((x / (width - 1)) * 175); // 235 -> 60
      const value = inkAt(x, y) ? Math.round(paper * 0.25) : paper;
      const p = (y * width + x) * 4;
      pixels[p] = value;
      pixels[p + 1] = value;
      pixels[p + 2] = value;
      pixels[p + 3] = 255;
    }
  }
  return pixels;
}

const W = 96;
const H = 48;
// Vertical strokes every 8th column, away from the edges.
const isInk = (x: number, y: number) => x % 8 === 0 && x > 4 && x < W - 5 && y > 4 && y < H - 5;

const lit = litPage(W, H, isInk);
adaptiveThreshold(lit, W, H);

let inkKept = 0;
let inkLost = 0;
let paperKept = 0;
let paperLost = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const value = lit[(y * W + x) * 4];
    if (isInk(x, y)) {
      if (value === 0) inkKept++;
      else inkLost++;
    } else {
      if (value === 255) paperKept++;
      else paperLost++;
    }
  }
}

check("every stroke survives the gradient", inkLost, 0);
check("ink is black", inkKept > 0, true);
check("paper stays white", paperLost, 0);
check("paper is white", paperKept > 0, true);

// The shadowed end is the half a global threshold gives up on: ink there is
// brighter than paper at the lit end, so no single cut-off can separate both.
const darkEndInk = lit[((H >> 1) * W + 88) * 4];
const lightEndPaper = lit[((H >> 1) * W + 3) * 4];
check("ink in deep shadow is still ink", darkEndInk, 0);
check("paper in bright light is still paper", lightEndPaper, 255);

// Output must be strictly bilevel — tesseract should have no thresholding left.
const levels = new Set<number>();
for (let p = 0; p < lit.length; p += 4) levels.add(lit[p]);
check("the result is bilevel", [...levels].sort((a, b) => a - b), [0, 255]);

// Blank paper has no ink to find and must not dissolve into speckle, which
// tesseract would then try to read.
//
// The width matters: this ramp drops 175 levels across the frame, so at 96 px
// that is 1.8 levels/px — already ~25x steeper than a real photo, where the
// lighting varies across thousands of pixels (~0.07 levels/px at 2600 px wide).
// Squeezed into a narrow frame the same ramp becomes a genuine edge, and
// finding an edge there is correct rather than a bug.
const blank = litPage(W, H, () => false);
adaptiveThreshold(blank, W, H);
check("blank paper under uneven light stays blank", [...new Set([...blank.filter((_, i) => i % 4 === 0)])], [255]);

check("a zero-size frame is ignored", (() => {
  const empty = new Uint8ClampedArray(0);
  adaptiveThreshold(empty, 0, 0);
  return empty.length;
})(), 0);

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
// Throwing (rather than setting process.exitCode) fails the run without pulling
// node's type definitions into a DOM-only tsconfig.
if (fails > 0) throw new Error(`${fails} ocr test failure(s)`);
