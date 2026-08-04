import { findPanel, scalePanel } from "./panel.ts";
import type { WordBox } from "./panel.ts";
import { panelTerm } from "./label.ts";

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

/** Places a word on a row, in the shape tesseract reports bounding boxes. */
function word(text: string, x: number, y: number, w = text.length * 10, h = 20): WordBox {
  return { text, bbox: { x0: x, y0: y, x1: x + w, y1: y + h } };
}

/** Lays a nutrition table out as words: a label column at x, values at valueX. */
function table(originX: number, originY: number, valueX: number, rowGap = 30): WordBox[] {
  const rows = [
    ["Valoare", "energetica", "469", "kcal"],
    ["Grasimi", "", "24,3", "g"],
    ["Glucide", "", "54,6", "g"],
    ["Fibre", "", "3,1", "g"],
    ["Proteine", "", "6,5", "g"],
  ];

  const out: WordBox[] = [];
  rows.forEach((row, i) => {
    const y = originY + i * rowGap;
    if (row[0] !== "") out.push(word(row[0], originX, y));
    if (row[1] !== "") out.push(word(row[1], originX + 90, y));
    out.push(word(row[2], valueX, y));
    out.push(word(row[3], valueX + 50, y));
  });
  return out;
}

// --- the vocabulary ----------------------------------------------------------
// The locator borrows the parser's keywords, so a term the parser knows is one
// the locator can find. These are the words that actually appear on a label.

check("a fat row is a term", panelTerm("Grasimi"), "fat");
check("diacritics do not matter", panelTerm("Grăsimi"), "fat");
check("nor does case", panelTerm("PROTEINE"), "protein");
check("english too", panelTerm("Carbohydrate"), "carbs");
check("the energy keyword", panelTerm("energetica"), "energy");
check("the unit is its own evidence", panelTerm("kcal"), "unit");
check("sub-rows count toward the table's shape", panelTerm("zaharuri"), "sugars");
check("so does the heading", panelTerm("Nutritionale"), "heading");
check("an ordinary word is not a term", panelTerm("ciocolata"), null);
check("nor is a bare number", panelTerm("24,3"), null);

// --- finding the table -------------------------------------------------------

const frame = { width: 1500, height: 1125 };

// A table in the lower-left of the frame, values 300 px to the right of the labels.
const panel = findPanel(table(200, 700, 500), frame.width, frame.height);

check("the table is found", panel !== null, true);
check(
  "the crop is around the table, not the frame",
  panel !== null && panel.x > 100 && panel.y > 600 && panel.y + panel.height < 900,
  true,
);
check(
  "and reaches past the labels to take in the values",
  panel !== null && panel.x + panel.width > 550,
  true,
);

// --- weak evidence -----------------------------------------------------------
// An ingredients list mentions fat and salt in passing. Two terms is not a table,
// and cropping to a stray phrase is worse than reading the whole frame.

const ingredients = [
  word("Ingrediente", 100, 100),
  word("faina", 300, 100),
  word("grasimi", 400, 100),
  word("vegetale", 550, 100),
  word("sare", 700, 100),
];

check("two terms in prose is not a table", findPanel(ingredients, frame.width, frame.height), null);
check("no words at all", findPanel([], frame.width, frame.height), null);
check(
  "a degenerate frame does not divide by zero",
  findPanel(table(200, 700, 500), 0, 0),
  null,
);

// --- competing clusters ------------------------------------------------------
// A package often names its macros twice: a real table, and a marketing flash
// like "high protein, low fat". The denser, more varied run is the table.

const withFlash = [
  word("proteine", 100, 60),
  word("grasimi", 300, 60),
  ...table(200, 700, 500),
];

const chosen = findPanel(withFlash, frame.width, frame.height);
check("the real table wins over a marketing flash", chosen !== null && chosen.y > 500, true);

// --- a table that already fills the frame ------------------------------------
// The user cropped tightly themselves, or shot the panel close up. Cropping again
// buys nothing, so a second pass is not worth paying for.

const closeUp = findPanel(table(20, 20, 400, 200), 900, 1100);
check("a frame that is already the table needs no crop", closeUp, null);

// --- mapping back to the original photo --------------------------------------
// Words are measured on the downscaled locating pass; the crop has to come from
// the full-size photo, where the detail still is.

check(
  "a panel scales onto the original photo",
  scalePanel({ x: 100, y: 200, width: 300, height: 150 }, { width: 1500, height: 1125 }, { width: 3000, height: 2250 }),
  { x: 200, y: 400, width: 600, height: 300 },
);

check(
  "scaling from nothing is a no-op rather than a crash",
  scalePanel({ x: 10, y: 20, width: 30, height: 40 }, { width: 0, height: 0 }, { width: 100, height: 100 }),
  { x: 10, y: 20, width: 30, height: 40 },
);

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
// Throwing (rather than setting process.exitCode) fails the run without pulling
// node's type definitions into a DOM-only tsconfig.
if (fails > 0) throw new Error(`${fails} panel test failure(s)`);
