import assert from "node:assert/strict";

import { generateEstimateDraft } from "../src/domains/estimates";
import { samplePriceCatalog } from "../src/domains/pricing";
import { sampleHouseProject } from "../src/domains/projects";

const estimate = generateEstimateDraft({
  project: sampleHouseProject,
  priceCatalog: samplePriceCatalog,
  marginPercent: 22,
  generatedAt: "2026-06-05T00:00:00.000Z",
});

const lineById = new Map(estimate.lines.map((line) => [line.id, line]));

const northWall = lineById.get("floor-1:wall-north:wall-gasblock-400-masonry");
const eastWall = lineById.get("floor-1:wall-east:wall-gasblock-400-masonry");
const foundation = lineById.get("foundation:foundation-slab-1:foundation-slab-concrete");
const roof = lineById.get("roof:roof-main:roof-metal-area");

assert.equal(estimate.lines.length, 8);
assert.equal(northWall?.quantity, 25.8);
assert.equal(eastWall?.quantity, 22.11);
assert.equal(foundation?.quantity, 27);
assert.equal(roof?.quantity, 134.4);
assert.equal(estimate.totals.materialTotal, 815714);
assert.equal(estimate.totals.laborTotal, 523591);
assert.equal(estimate.totals.subtotal, 1339305);
assert.equal(estimate.totals.marginTotal, 294647);
assert.equal(estimate.totals.grandTotal, 1633952);
assert.equal(
  estimate.lines.filter((line) => line.status === "needs-review").length,
  1,
  "Only demo window price should require review.",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      project: estimate.projectName,
      lines: estimate.lines.length,
      subtotal: estimate.totals.subtotal,
      grandTotal: estimate.totals.grandTotal,
      reviewLines: estimate.lines.filter((line) => line.status === "needs-review").length,
    },
    null,
    2,
  ),
);
