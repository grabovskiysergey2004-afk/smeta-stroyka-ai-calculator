# Iteration 2

## Goal

Create the first typed calculation core for individual housing projects before migrating complex UI.

## Done

- Expanded the project domain model:
  - project;
  - levels;
  - walls and partitions;
  - rooms;
  - openings;
  - roof segments;
  - foundation segments.
- Added source tracking for quantities and prices.
- Added technology packages for basic estimate generation.
- Added a sample price catalog.
- Added `generateEstimateDraft()` as a pure TypeScript function.
- Added `npm run domain:check` to verify formulas and totals.

## Core formulas

- Wall net area: `length * height - linked openings area`.
- Opening count: `count`.
- Room area: explicit area or polygon area.
- Roof area: `plan area * slope coefficient`.
- Slab foundation volume: `area * thickness`.

## Practical meaning

The project now has a calculation layer that can be tested without React, browser state, or the legacy JSX prototype. This makes future work safer: the canvas, PDF candidates, price imports, estimate table, and proposal export can all use the same calculation contract.

## Verification

Run:

```sh
npm run domain:check
npm run typecheck
npm run lint
npm run format:check
```

## Next iteration

Iteration 3 should start connecting the typed model to the planning canvas migration: convert or adapt the current legacy project shape into the new domain model and display generated estimate lines from the typed engine.
