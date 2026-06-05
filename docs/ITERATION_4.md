# Iteration 4 - Local Price Catalog Import

## Goal

Make price lists usable in the local app flow: import a client CSV/JSON catalog, store it in `client-data/prices`, and let the typed estimate bridge calculate with the active catalog.

## Delivered

- Added typed price import helpers in `src/domains/pricing/importCatalog.ts`.
- Added `window.plPriceCatalogTools` for the legacy UI.
- Added `/api/prices/current` local API routes.
- Updated the typed estimate bridge to use the active price catalog instead of always using demo prices.
- Added a new `PricesScreenV2` with real CSV/JSON import, source summary, search, category filtering, and review badges.
- Added `npm run price-import:check`.

## Accepted CSV Columns

Required:

- `code`
- `category`
- `name`
- `unit`
- `material`
- `work`

Optional:

- `requiresReview`

The parser also accepts common aliases such as `materialUnitPrice`, `laborUnitPrice`, `mat`, and `labor`.

## Fallback Rule

Imported catalogs are merged with the sample catalog. If an imported file does not contain every known price code, the missing codes fall back to demo values and are marked `requiresReview`.

This keeps the estimate usable while making risky demo prices visible before a commercial proposal is sent.

## Verification

Run:

```bash
npm run price-import:check
npm run adapter:check
npm run domain:check
npm run typecheck
npm run lint
npm run format:check
npm run smoke
```

Expected `price-import:check`:

- source: `supplier-june-2026 + демо-подстановка`
- items: `7`
- review items: `6`
- grand total: `322690 RUB`

## Next Iteration Candidate

Add manual price mapping and editing: users should be able to map unknown supplier rows to internal price codes, edit one row, and immediately see which estimate lines changed.
