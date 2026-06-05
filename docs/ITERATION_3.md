# Iteration 3 - Typed Estimate Bridge

## Goal

Connect the legacy planning canvas to the typed estimate domain so the visible calculator can start using the checked calculation core without a full UI rewrite.

## Delivered

- Added `src/legacy/legacyProjectAdapter.ts` to convert the current legacy project shape into the typed `Project` model.
- Added `src/legacy/legacyEstimateBridge.ts` and loaded it from `index.html` as a Vite module.
- Updated `screen-planning.jsx` so estimate rows prefer typed-domain rows and fall back to the legacy draft when the typed bridge is unavailable.
- Added `npm run adapter:check` with a deterministic legacy-project fixture.

## Practical Rules Captured

- External walls map to `wall-gasblock-400`.
- Internal walls map to `partition-gasblock-100`.
- Windows and doors are attached to their host wall by `onIdx`.
- Wall quantities subtract linked openings.
- Room rectangles produce draft-floor estimate lines.
- Typed rows keep the legacy row shape so existing panels, result center, overrides, and export flows can keep working.

## Why This Matters

This is a migration layer. The current UI can stay usable while calculation logic moves into typed, testable modules. It reduces risk because each migrated rule can be checked with a script before it affects commercial proposals.

## Verification

Run:

```bash
npm run adapter:check
npm run domain:check
npm run typecheck
npm run lint
npm run format:check
npm run smoke
```

Expected adapter fixture:

- rows: `5`
- external wall quantity: `23.8 m2`
- partition quantity: `14 m2`
- draft floor quantity: `50 m2`
- grand total: `344162 RUB`

## Next Iteration Candidate

Move price catalog editing/import closer to production use: local CSV/JSON price upload, source metadata, and visible warnings for estimate lines that use demo prices or need review.
