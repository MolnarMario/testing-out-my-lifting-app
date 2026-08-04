import { normalizeText, parseLabel, parseNumber } from "./label.ts";

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

/** The five numbers the pantry actually stores, in a fixed order for comparison. */
function macros(text: string) {
  const { fields } = parseLabel(text);
  return [fields.kcal, fields.protein, fields.carbs, fields.fat, fields.fiber];
}

// --- number conventions ------------------------------------------------------
// Romanian writes 12,5 and 1.234; English writes 12.5 and 1,234 — same glyphs,
// opposite meanings. Every row here is a form that appears on a real label.

check("comma decimal (ro)", parseNumber("12,5"), 12.5);
check("dot decimal (en)", parseNumber("12.5"), 12.5);
check("dot thousands (ro)", parseNumber("1.234"), 1234);
check("comma thousands (en)", parseNumber("1,234"), 1234);
check("both, comma decimal", parseNumber("1.234,5"), 1234.5);
check("both, dot decimal", parseNumber("1,234.5"), 1234.5);
check("zero head stays decimal", parseNumber("0,003"), 0.003);
check("trace prefix", parseNumber("<0,5"), 0.5);
check("repeated thousands", parseNumber("1.234.567"), 1234567);
check("plain integer", parseNumber("295"), 295);
check("trailing zero decimal", parseNumber("12.50"), 12.5);
check("not a number", parseNumber("grasimi"), null);

// --- normalisation -----------------------------------------------------------

check("diacritics fold", normalizeText("Grăsimi"), "grasimi");
check("cedilla folds too", normalizeText("acizi graşi saturaţi"), "acizi grasi saturati");
check("uppercase folds", normalizeText("PROTEINE"), "proteine");
check("table borders drop", normalizeText("| 12,5 |").trim(), "12,5");

// --- Romanian, clean ---------------------------------------------------------

const roClean = `
Declaratie nutritionala
Valori medii pentru 100 g
Valoare energetica 1.996 kJ / 477 kcal
Grăsimi 24,5 g
din care acizi grași saturați 11,2 g
Glucide 54,3 g
din care zaharuri 23,1 g
Fibre 3,4 g
Proteine 6,8 g
Sare 0,58 g
`;

check("ro clean macros", macros(roClean), [477, 6.8, 54.3, 24.5, 3.4]);
check("ro clean is solid", parseLabel(roClean).type, "solid");
check("ro clean parses without warning", parseLabel(roClean).warnings, []);
check("ro clean basis", parseLabel(roClean).basis, "per100");

// --- the sub-row trap --------------------------------------------------------
// "din care" rows restate part of the row above. Reading saturates as total fat
// is the likeliest way to record a wrong number that still looks believable.

check("saturates are not fat", parseLabel(roClean).fields.fat, 24.5);
check("sugars are not carbs", parseLabel(roClean).fields.carbs, 54.3);

check(
  "sub-row folded onto its parent line",
  macros("Valoare energetica 300 kcal\nGrasimi 24,5 g din care acizi grasi saturati 11,2 g"),
  [300, 0, 0, 24.5, 0],
);

check(
  "us panel indents sub-rows instead of labelling them",
  macros("Calories 200\nTotal Fat 12g\nSaturated Fat 3.5g\nTrans Fat 0g\nProtein 5g"),
  [200, 5, 0, 12, 0],
);

// --- two columns: per 100 g and per portion ----------------------------------

const twoColumn = `
Informatii nutritionale
per 100 g    per portie (30 g)
Valoare energetica  1.590 kJ / 380 kcal   477 kJ / 114 kcal
Grasimi 12,0 g  3,6 g
din care saturate 2,1 g  0,6 g
Glucide 55,0 g  16,5 g
din care zaharuri 8,0 g  2,4 g
Fibre 7,0 g  2,1 g
Proteine 11,0 g  3,3 g
Sare 0,90 g  0,27 g
`;

check("takes the 100 g column", macros(twoColumn), [380, 11, 55, 12, 7]);
check("two column parses without warning", parseLabel(twoColumn).warnings, []);

// --- English, per 100 g (UK/EU) ----------------------------------------------

const enHundred = `
Nutrition Information
Typical values per 100 g
Energy 1,540 kJ / 368 kcal
Fat 4.2 g
of which saturates 0.9 g
Carbohydrate 68.0 g
of which sugars 3.1 g
Fibre 6.5 g
Protein 12.0 g
Salt 0.01 g
`;

check("english per 100 g", macros(enHundred), [368, 12, 68, 4.2, 6.5]);
check("english parses without warning", parseLabel(enHundred).warnings, []);

// --- English, per serving (US Nutrition Facts) -------------------------------
// Declared per serving, so every value has to be rescaled to 100 g or the day's
// totals silently come out wrong.

const usPanel = `
Nutrition Facts
Serving size 55g
Amount per serving
Calories 240
Total Fat 12g
Saturated Fat 3.5g
Trans Fat 0g
Total Carbohydrate 28g
Dietary Fiber 4g
Total Sugars 9g
Protein 5g
`;

check("us panel rescaled to 100 g", macros(usPanel), [436.36, 9.09, 50.91, 21.82, 7.27]);
check("us panel basis", parseLabel(usPanel).basis, "serving");
check("us panel serving size", parseLabel(usPanel).servingSize, 55);
check("us panel says it rescaled", parseLabel(usPanel).warnings.length, 1);

// --- bilingual RO/HU, dashed sub-rows ----------------------------------------

const bilingual = `
Valoare energetica / Energia 2.100 kJ / 502 kcal
Grasimi / Zsir 27,0 g
- din care acizi grasi saturati 4,0 g
Glucide / Szenhidrat 55,0 g
- din care zaharuri 4,5 g
Fibre / Rost 4,0 g
Proteine / Feherje 9,0 g
Sare / So 1,20 g
`;

check("bilingual macros", macros(bilingual), [502, 9, 55, 27, 4]);
check("bilingual parses without warning", parseLabel(bilingual).warnings, []);

// --- mangled OCR output ------------------------------------------------------
// Confused digits (O/0, l/1) and keywords damaged in the same way.

const mangled = `
VaIoare energetica 1.798 kJ / 43O kcal
Gr@simi 2O,1 g
din care saturate 9,8 g
GIucide 5O,2 g
Fibre 3,O g
Proteine 7,4 g
`;

check("mangled digits and keywords", macros(mangled), [430, 7.4, 50.2, 20.1, 3]);
check("mangled parses without warning", parseLabel(mangled).warnings, []);

// --- kJ only -----------------------------------------------------------------

const kjOnly = `
Valoare energetica 1.100 kJ
Grasimi 5,0 g
Glucide 45,0 g
Fibre 2,0 g
Proteine 8,5 g
`;

check("kcal derived from kj", macros(kjOnly), [262.91, 8.5, 45, 5, 2]);
check("derivation is reported", parseLabel(kjOnly).warnings.length, 1);

// A printed kcal always beats a derived one. OCR often breaks the energy row so
// the two halves land on separate lines; reading only the kJ side and converting
// it hides a misread kJ token behind a number that still looks plausible.
const splitEnergy = `
Valoarea energetica 1966 kJ /
469 kcal
Grasimi 24,3 g
Glucide 54,6 g
Proteine 6,5 g
`;

check("the printed kcal wins over the kj beside it", macros(splitEnergy), [469, 6.5, 54.6, 24.3, 0]);
check("and nothing is reported as derived", parseLabel(splitEnergy).warnings, []);

// --- the unit read as a digit ------------------------------------------------
// A lowercase g against the baseline is the commonest misread on these labels,
// and when the space goes with it the unit lands inside the number: "6,5 g"
// comes back as "6,58". Measured on a real scan, this was the only thing left
// wrong once the table was being found and read at size.

check("a trailing g read as 8 is dropped", macros("Proteine 6,58\nFibre 3,18"), [0, 6.5, 0, 0, 3.1]);
// The row having no unit is the whole tell, so a row that kept one is untouched.
check("a real two-decimal value with its unit survives", macros("Grasimi 0,58 g"), [0, 0, 0, 0.58, 0]);
check("and a separate stray 8 was never the problem", macros("Grasimi 24,3 8"), [0, 0, 0, 24.3, 0]);
check("one decimal place is left alone", macros("Grasimi 24,8"), [0, 0, 0, 24.8, 0]);

// --- liquid ------------------------------------------------------------------

const liquid = `
Valori nutritionale per 100 ml
Valoare energetica 188 kJ / 45 kcal
Grasimi 1,5 g
din care acizi grasi saturati 1,0 g
Glucide 4,7 g
din care zaharuri 4,7 g
Proteine 3,2 g
Sare 0,10 g
`;

check("liquid detected from 100 ml", parseLabel(liquid).type, "liquid");
check("liquid macros", macros(liquid), [45, 3.2, 4.7, 1.5, 0]);
check("absent fibre is flagged unread", parseLabel(liquid).found.fiber, false);
check("present protein is flagged read", parseLabel(liquid).found.protein, true);
check("liquid parses without warning", parseLabel(liquid).warnings, []);

// --- value split onto the next line ------------------------------------------

check(
  "value on the following line",
  macros("Valoare energetica\n300 kcal\nGrasimi\n12,0 g\nGlucide\n45,0 g\nProteine\n8,0 g"),
  [300, 8, 45, 12, 0],
);

// --- collapsed rows ----------------------------------------------------------
// Tesseract does not reliably keep a table's line breaks; a narrow or rotated
// label can come back with the whole declaration on one line.

check(
  "whole table collapsed onto one line",
  macros("Energie 477 kcal Grasimi 24,5 g Glucide 54,3 g Fibre 3,4 g Proteine 6,8 g"),
  [477, 6.8, 54.3, 24.5, 3.4],
);

check(
  "collapsed rows keep their sub-rows out",
  macros("Grasimi 24,5 g din care saturate 11,2 g Glucide 54,3 g din care zaharuri 23,1 g"),
  [0, 0, 54.3, 24.5, 0],
);

// --- a real degraded scan ----------------------------------------------------
// Verbatim tesseract output from a photograph of a whole Romanian back panel.
// The engine broke the energy row in half and put the value on the line *before*
// its label, so looking only forward from the keyword lost it entirely.

const degraded = `Dedig;atia nutritionala
Valori medii pentru 100 g
ci                      186 kJ
Valoarea energetică            ,
Grăsimi                                   0,69
- din care acizi grași saturați           <0,1g
Glucide                                              469                     -
- din care zaharuri                              0,79
CEE NYY,
:           "Conţinutul de sare se datorează exclusiv
prezenţei în mod natural a sodiului.
Ambalat in România
Distribuit în      a      i
our România SA
Saniora, nr, pr Green                   - 1
AT soc a Clădirea`;

// 186 kJ is self-labelling, so it is usable even though its keyword ended up on
// the following line: 186 / 4.184.
check("a split energy row is still read", parseLabel(degraded).fields.kcal, 44.46);
check("and is reported as derived", parseLabel(degraded).found.kcal, true);

// The sub-rows are still kept out, even this badly mangled.
check("saturates do not become fat", parseLabel(degraded).fields.fat, 0.69);
check("sugars do not become carbs", parseLabel(degraded).fields.carbs, 469);
// "Proteine" was destroyed past recognition; a blank is correct, zero is not.
check("an unreadable row stays unread", parseLabel(degraded).found.protein, false);

// The carbs figure is a misread and must be called out rather than recorded
// quietly — the label's " g" was read as a 9 and the comma lost.
const degradedWarnings = parseLabel(degraded).warnings;
check("the impossible carbs value is flagged", degradedWarnings.some((w) => w.includes("100 g")), true);
check("the calorie mismatch is flagged", degradedWarnings.some((w) => w.includes("do not add up")), true);

// --- validation catches numbers that do not add up ---------------------------

const inconsistent = `
Valoare energetica 500 kcal
Grasimi 2,0 g
Glucide 10,0 g
Proteine 3,0 g
`;

check("atwater mismatch warns", parseLabel(inconsistent).warnings.length > 0, true);
check("missing calories warns", parseLabel("Grasimi 2,0 g").warnings.length > 0, true);
check(
  "kj and kcal disagreeing warns",
  parseLabel("Valoare energetica 1.996 kJ / 120 kcal").warnings.length > 0,
  true,
);

// --- nothing to read ---------------------------------------------------------

check("empty input yields zeroes", macros(""), [0, 0, 0, 0, 0]);
check("empty input finds nothing", parseLabel("").found.kcal, false);
check("garbage does not throw", macros("qwerty asdf 12345"), [0, 0, 0, 0, 0]);

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
// Throwing (rather than setting process.exitCode) fails the run without pulling
// node's type definitions into a DOM-only tsconfig.
if (fails > 0) throw new Error(`${fails} label test failure(s)`);
