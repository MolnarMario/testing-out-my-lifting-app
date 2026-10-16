# Ironlog — Powerlifting Tracker

A powerlifting tracker that stores everything locally in your browser. Vite + React + TypeScript.

## Running it

```bash
npm install
npm run dev      # dev server
npm run build    # typecheck + production build into dist/
npm run preview  # serve the built output
npm test         # plate-solver and food-maths tests
```

## Status

This is a rewrite in progress. The original app shipped as a single 424 KB `index.html`
containing a minified React bundle; that build is kept at [`legacy/index.html`](legacy/index.html)
and is still the behavioural reference for the parts not yet rebuilt.

| Tab | State |
| --- | --- |
| Workout | Rebuilt — Today (set logging with RPE/percentage intensity, per-set gear, readiness meters, session timing, notes), Calendar (month overview with day preview), Exercises (47-lift library, add and remove) |
| Plates | Rebuilt — barbell visual, greedy plate solver, bar and collar options, quick pair chips, kg micro plates |
| Food | Rebuilt — calorie and macro tracking against daily targets, month calendar, 92-food pantry plus custom entries, water and bodyweight, g/oz and ml/fl-oz input |

The plate icon on any logged set sends that weight straight to the loader.

The workout calendar has a **+ Food** toggle that overlays each day's calories,
macro split, water and bodyweight onto the training grid.

Parity is tracked by diffing every class in `base.css` against the source. 17
classes remain unreferenced and **all 17 were already dead in the original
build** — every style the original actually used is now driven by this code.

## Importing data from the original build

On first load, if data written by the original single-file build is found on the
device, a banner offers to import it. It maps the old shapes onto the new. Each
set's exercise is resolved by name, and a name the library does not know becomes
a custom exercise rather than losing its sets. Weights convert into canonical
kilograms, a blank legacy weight imports as a 0 kg bodyweight set, and the food
journal's entries, water, cans and weigh-ins come across from the separate
places the old build kept them. Days already logged in the new build are left
as they are. The banner reports what came across and names anything the new
build has no place for (body-fat readings, edits to built-in exercises).

It runs at most once (guarded by `ironlog.migrated.v1`). Three keys are shared
between the builds and get overwritten (`ironlog.days`, `ironlog.custom`,
`ironlog.maxes`), so their raw contents are copied to `ironlog-legacy-backup.v1`
first. That name sits outside the `ironlog.` prefix, so "Clear saved data" on the
crash screen does not delete it. The old food journal (`macroJournal.v1`) is
never modified. After an import the page reloads, so no component can write its
pre-import copy of the data back over the result.

## Deploying

`npm run build` writes to `docs/`, which is committed. Point GitHub Pages at
**main → /docs** and the existing URL keeps working. Root `index.html` is the
Vite entry, not the published page — it cannot be the build output as well.

## Notes

- Weights are stored canonically in kilograms and converted for display, so switching
  units never rewrites your saved numbers.
- `src/hooks/useLocalStorage.ts` keeps one shared store per key — every component reading
  a key sees the same value — and surfaces a warning banner when the browser refuses to
  persist (private mode, quota) rather than failing silently.
- `src/lib/plates.ts` is the one place that works in the *displayed* unit rather than
  canonical kg: in lb mode the bar really is 45 lb and the plates really are 45/35/25s,
  not converted kilos. It solves in thousandths so 0.25 kg plates don't drift.

**Live: https://ironlog.thebarbellengineer.com/**
