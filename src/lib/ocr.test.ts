import { clampCrop, containRect, displayToSource, fitWithin, grayscaleStretch } from "./ocr.ts";

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

check("landscape photo fits the long edge", fitWithin(3000, 2000, 1600), {
  width: 1600,
  height: 1067,
});
check("portrait photo fits the long edge", fitWithin(2000, 3000, 1600), {
  width: 1067,
  height: 1600,
});
check("small images are never upscaled", fitWithin(800, 600, 1600), { width: 800, height: 600 });
check("exact fit is left alone", fitWithin(1600, 900, 1600), { width: 1600, height: 900 });
check("extreme aspect keeps a pixel", fitWithin(4000, 100, 1600), { width: 1600, height: 40 });
check("never collapses to zero", fitWithin(4000, 1, 1600), { width: 1600, height: 1 });

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
// With four pixels the 2% clip rounds to zero, so the darkest and lightest set
// the ends directly: 50..200 is rescaled onto 0..255.

const stretched = greys([50, 100, 150, 200]);
grayscaleStretch(stretched);
check("mid-tones are stretched across the range", levelsOf(stretched), [0, 85, 170, 255]);

const colour = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
grayscaleStretch(colour);
check("colour collapses to grey", levelsOf(colour), [255, 0]);
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

// The flip side: a frame that is genuinely one tone plus a speck of glare has no
// range to recover, and is left as it is rather than driven to black.
const speck = greys([...Array<number>(49).fill(60), 255]);
grayscaleStretch(speck);
check("a uniform frame with a speck of glare is left alone", levelsOf(speck)[0], 60);

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
// Throwing (rather than setting process.exitCode) fails the run without pulling
// node's type definitions into a DOM-only tsconfig.
if (fails > 0) throw new Error(`${fails} ocr test failure(s)`);
