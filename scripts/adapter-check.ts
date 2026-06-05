import assert from "node:assert/strict";

import { generateTypedLegacyEstimate } from "../src/legacy/legacyProjectAdapter";

const legacyProject = {
  name: "Legacy demo",
  activeLevelId: "L-1",
  levels: [{ id: "L-1", name: "1 этаж", type: "floor" }],
  levelsData: {
    "L-1": {
      walls: [
        { id: "W-1", type: "external", x1: 0, y1: 0, x2: 10, y2: 0 },
        { id: "W-2", type: "internal", x1: 2, y1: 0, x2: 2, y2: 5 },
      ],
      windows: [{ id: "WIN-1", onIdx: 0, a: 1, b: 2.5 }],
      doors: [{ id: "DR-1", onIdx: 0, a: 6, b: 7 }],
      openings: [],
      rooms: [{ id: "R-1", name: "Комната", x: 0, y: 0, w: 10, h: 5 }],
    },
  },
};

const result = generateTypedLegacyEstimate(legacyProject);
const northWall = result.rows.find((row) => row.typedLineId.includes(":W-1:"));
const partition = result.rows.find((row) => row.typedLineId.includes(":W-2:"));
const floor = result.rows.find((row) => row.typedLineId.includes(":R-1:"));

assert.equal(result.domainProject.levels.length, 1);
assert.equal(result.rows.length, 5);
assert.equal(northWall?.qty, 23.8);
assert.equal(partition?.qty, 14);
assert.equal(floor?.qty, 50);
assert.equal(result.estimate.totals.grandTotal, 344162);

console.log(
  JSON.stringify(
    {
      ok: true,
      rows: result.rows.length,
      grandTotal: result.estimate.totals.grandTotal,
      typedRows: result.rows.map((row) => ({ id: row.id, qty: row.qty, total: row.total })),
    },
    null,
    2,
  ),
);
