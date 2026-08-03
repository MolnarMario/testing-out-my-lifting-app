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
| Workout | Rebuilt — date navigation, set logging with RPE/percentage intensity, edit and delete, readiness meters, session timing, notes |
| Plates | Rebuilt — barbell visual, greedy plate solver, bar and collar options, quick pair chips, kg micro plates |
| Food | Rebuilt — calorie and macro tracking against daily targets, 92-food pantry plus custom entries, water and bodyweight, g/oz and ml/fl-oz input |

The plate icon on any logged set sends that weight straight to the loader.

Not carried over from the original food tab: the month calendar view and the
energy-drink counter.

**The rewrite does not read data saved by the legacy build.** The storage shapes are
different and no migration is provided, so the two are effectively separate apps.

## Notes

- Weights are stored canonically in kilograms and converted for display, so switching
  units never rewrites your saved numbers.
- `src/hooks/useLocalStorage.ts` keeps one shared store per key — every component reading
  a key sees the same value — and surfaces a warning banner when the browser refuses to
  persist (private mode, quota) rather than failing silently.
- `src/lib/plates.ts` is the one place that works in the *displayed* unit rather than
  canonical kg: in lb mode the bar really is 45 lb and the plates really are 45/35/25s,
  not converted kilos. It solves in thousandths so 0.25 kg plates don't drift.

**Live (legacy build): https://molnarmario.github.io/testing-out-my-lifting-app/**
