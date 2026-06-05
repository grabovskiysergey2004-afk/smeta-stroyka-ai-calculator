import assert from "node:assert/strict";

import { generateTypedLegacyEstimate } from "../src/legacy/legacyProjectAdapter";
import {
  mergeWithSampleCatalog,
  parsePriceCatalogInput,
  summarizePriceCatalog,
} from "../src/domains/pricing";

const csv = [
  "code;category;name;unit;material;work;requiresReview",
  "wall.gasblock400.m2;Коробка;Импорт: наружная стена;m2;4000;2500;false",
  "floor.draft.m2;Отделка;Импорт: черновой пол;m2;900;750;true",
].join("\n");

const imported = parsePriceCatalogInput({
  fileName: "supplier-june-2026.csv",
  text: csv,
  supplierName: "Supplier June 2026",
  importedAt: "2026-06-05T00:00:00.000Z",
});
const catalog = mergeWithSampleCatalog(imported);
const summary = summarizePriceCatalog(catalog);

const legacyProject = {
  name: "Демо импорта прайса",
  activeLevelId: "L-1",
  levels: [{ id: "L-1", name: "1 floor", type: "floor" }],
  levelsData: {
    "L-1": {
      walls: [{ id: "W-1", type: "external", x1: 0, y1: 0, x2: 10, y2: 0 }],
      windows: [],
      doors: [],
      openings: [],
      rooms: [{ id: "R-1", name: "Room", x: 0, y: 0, w: 10, h: 5 }],
    },
  },
};

const result = generateTypedLegacyEstimate(legacyProject, catalog);
const wall = result.rows.find((row) => row.typedLineId.includes(":W-1:"));
const floor = result.rows.find((row) => row.typedLineId.includes(":R-1:"));

assert.equal(imported.items.length, 2);
assert.equal(catalog.items.length, 7);
assert.equal(summary.items, 7);
assert.equal(summary.reviewItems, 6);
assert.equal(wall?.mat, 4000);
assert.equal(wall?.work, 2500);
assert.equal(wall?.total, 182000);
assert.equal(floor?.mat, 900);
assert.equal(floor?.work, 750);
assert.equal(floor?.status, "needs-review");
assert.equal(result.estimate.totals.grandTotal, 322690);

console.log(
  JSON.stringify(
    {
      ok: true,
      source: summary.sourceName,
      items: summary.items,
      reviewItems: summary.reviewItems,
      grandTotal: result.estimate.totals.grandTotal,
    },
    null,
    2,
  ),
);
