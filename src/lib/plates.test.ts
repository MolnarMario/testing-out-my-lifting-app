import { PLATE_CONFIG, solveLoad, snapRequest } from "./plates.ts";

const kg = PLATE_CONFIG.kg, lb = PLATE_CONFIG.lb;
let fails = 0;
const show = (r: any) => r.plates.map((p: any) => `${p.count}x${p.plate.label}`).join(" + ") || "(none)";

function check(name: string, got: any, want: any) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
  else console.log(`ok   ${name}  -> ${JSON.stringify(got)}`);
}

let r = solveLoad(125, 20, 5, kg.plates);
check("kg 125 / 20 bar / 5 collars", [r.status, r.totalWeight, r.perSideWeight, show(r)], ["exact", 125, 50, "2x25 kg"]);

r = solveLoad(100, 20, 5, kg.plates);
check("kg 100 / 20 / 5", [r.status, r.totalWeight, r.perSideWeight, show(r)], ["exact", 100, 37.5, "1x25 kg + 1x10 kg + 1x2.5 kg"]);

r = solveLoad(225, 45, 0, lb.plates);
check("lb 225 / 45 bar", [r.status, r.totalWeight, r.perSideWeight, show(r)], ["exact", 225, 90, "2x45 lb"]);

r = solveLoad(20, 20, 5, kg.plates);
check("kg below min", [r.status, r.totalWeight], ["below-min", 25]);

r = solveLoad(25, 20, 5, kg.plates);
check("kg empty bar exactly at min", [r.status, r.totalWeight, show(r)], ["exact", 25, "(none)"]);

r = solveLoad(null, 20, 5, kg.plates);
check("null request", [r.status, r.totalWeight], ["empty", 0]);

// 101 kg cannot be made with standard plates: per side 38 -> 37.5 loadable, 0.5 short both sides = 1
r = solveLoad(101, 20, 5, kg.plates);
check("kg 101 rounds down", [r.status, r.totalWeight, r.shortBy], ["rounded", 100, 1]);

// micro plates close the gap
r = solveLoad(101, 20, 5, kg.platesRecord);
check("kg 101 with micro plates", [r.status, r.totalWeight, show(r)], ["exact", 101, "1x25 kg + 1x10 kg + 1x2.5 kg + 1x0.5 kg"]);

// float safety: 0.25 increments must not drift
r = solveLoad(126.5, 20, 5, kg.platesRecord);
check("kg 126.5 micro (reachable)", [r.status, r.totalWeight, r.perSideWeight, show(r)], ["exact", 126.5, 50.75, "2x25 kg + 1x0.5 kg + 1x0.25 kg"]);

// 126.25 needs 50.625/side; smallest plate is 0.25 so it is genuinely unloadable
r = solveLoad(126.25, 20, 5, kg.platesRecord);
check("kg 126.25 unreachable, rounds down", [r.status, r.totalWeight, r.shortBy], ["rounded", 126, 0.25]);

// snapping
check("snap kg 101 -> 100", snapRequest(101, "kg", 20, 5, false, 515), { value: 100, snapped: true });
check("snap kg 101 record mode untouched", snapRequest(101, "kg", 20, 5, true, 515), { value: 101, snapped: false });
check("snap lb 227 -> 225", snapRequest(227, "lb", 45, 0, false, 1135), { value: 225, snapped: true });
check("snap kg 125 already valid", snapRequest(125, "kg", 20, 5, false, 515), { value: 125, snapped: false });

// max heavy load
r = solveLoad(515, 20, 5, kg.plates);
check("kg 515 max", [r.status, r.totalWeight, r.perSideWeight], ["exact", 515, 245]);

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
