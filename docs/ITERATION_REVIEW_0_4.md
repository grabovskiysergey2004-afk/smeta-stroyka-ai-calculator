# Iteration Review 0-4

## Current Product State

The prototype is now a local-first construction estimate workspace. The legacy visual UI still runs, but the most important business logic has started moving into typed, testable modules.

## What Is Solid Now

- Iteration 0: safe project structure, legacy backup, client-data folders, checks.
- Iteration 1: local Vite API for projects, company profile, and backups.
- Iteration 2: typed domain model and pure estimate generation.
- Iteration 3: adapter from the legacy planning canvas into the typed estimate engine.
- Iteration 4: local CSV/JSON price import and active price catalog bridge.

## Improvements Added After Review

- Added `npm run check` for the core non-browser verification chain.
- Added `npm run check:all` for the full chain including browser smoke.
- Added `docs/PRICE_CATALOG_TEMPLATE.csv` as a practical supplier-price template.
- Kept the pricing UI in Russian while preserving technical price codes for mapping.

## Product Design Notes

- The next product bottleneck is not another visual section. It is trust: users need to see why a line is calculated, where its price came from, and what still needs review.
- The estimate flow should gradually become: canvas element -> quantity formula -> price source -> warning/review -> proposal line.
- Keep the interface dense and operational. This product is closer to a working estimator's tool than a marketing dashboard.

## Creative Production Notes

- The strongest positioning route is "local-first AI estimator for small construction teams".
- The trust signal is not generic AI magic; it is traceability: every quantity and price should show its source.
- Future commercial assets should emphasize: local data, editable estimates, price-source control, and fast proposal preparation.

## Recommended Next Issues

1. Manual price mapping and row editing.
2. Result Center source/warning panel for every estimate line.
3. Move more legacy JSX into typed React modules.
4. PDF/import confirmation flow before estimate generation.
5. GitHub Actions check pipeline for `npm run check`.
