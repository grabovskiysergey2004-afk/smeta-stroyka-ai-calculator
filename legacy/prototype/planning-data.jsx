/* global window */
// ============================================================
// Planning · constants, geometry helpers, templates
// ============================================================

// World viewport defaults (meters). Per-level overrides supported.
// Большой мир позволяет рисовать помещения любых размеров — от комнаты 3×4 м
// до промышленного объекта 150×100 м. Холст всегда заполняет видимую область
// при «По размеру», а пользователь приближает только ту часть, где работает.
var DEFAULT_WORLD = { w: 150, h: 100 };
var PX_PER_M = 40;          // pixels per meter at zoom = 1
var MIN_ZOOM = 0.04;
var MAX_ZOOM = 6;

// Grid sizes (in meters)
var GRID_SIZES = [0.5, 1, 5, 10];

// Modes — top-level work mode
var MODES = [
  { id: "plan",     label: "Планировка",  icon: "Ruler" },
  { id: "levels",   label: "Этажи",       icon: "Building" },
  { id: "roof",     label: "Кровля",      icon: "House" },
  { id: "zones",    label: "Зоны",        icon: "Room" },
  { id: "estimate", label: "Смета",       icon: "Calc" },
  { id: "export",   label: "Экспорт",     icon: "Download" },
];

// Level types
var LEVEL_TYPES = {
  site:           { label: "Участок",         iconName: "Folder",   bg: "rgba(100,116,139,0.04)" },
  floor:          { label: "Этаж",            iconName: "House",    bg: "rgba(30,58,138,0.03)"  },
  attic:          { label: "Мансарда",        iconName: "House",    bg: "rgba(30,58,138,0.03)"  },
  garage:         { label: "Гараж",           iconName: "Building", bg: "rgba(234,88,12,0.03)"  },
  roof:           { label: "Кровля",          iconName: "House",    bg: "rgba(124,58,237,0.03)" },
  industrial_roof:{ label: "Пром. кровля",    iconName: "Building", bg: "rgba(8,145,178,0.04)"  },
};

// Pricing (₽)
var PRICE = {
  externalWall: { mat: 4800, work: 2200 },
  internalWall: { mat: 1600, work: 1100 },
  window:       { mat: 18000, work: 4500 },
  door:         { mat: 12000, work: 3500 },
  floorPerM2:   { mat: 1450, work: 850 },
  ceilingPerM2: { mat: 950, work: 700 },
  roofPerM2:    { mat: 1850, work: 1100 },
  parapetPerM:  { mat: 1900, work: 700 },
  aerator:      { mat: 4800, work: 1200 },
  drain:        { mat: 9500, work: 3500 },
  margin: 0.22,
};

var ROOM_COLORS = [
  "rgba(30,58,138,0.05)",
  "rgba(234,88,12,0.06)",
  "rgba(21,128,61,0.05)",
  "rgba(8,145,178,0.06)",
  "rgba(124,58,237,0.05)",
  "rgba(180,83,9,0.06)",
  "rgba(100,116,139,0.05)",
];

// ============================================================
// Geometry helpers
// ============================================================
function wallLen(w) { return Math.hypot(w.x2 - w.x1, w.y2 - w.y1); }
var wallIsH = function wallIsH(w) { return w.y1 === w.y2; };
function snapToGrid(x, step = 0.5) { return Math.round(x / step) * step; }
function axisLock(start, end) {
  const dx = Math.abs(end.x - start.x), dy = Math.abs(end.y - start.y);
  return dx >= dy ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
}
function distanceToSegment(p, w) {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const lenSq = dx*dx + dy*dy;
  if (lenSq < 0.0001) return { dist: Infinity, t: 0 };
  let t = ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { dist: Math.hypot(p.x - (w.x1 + t * dx), p.y - (w.y1 + t * dy)), t };
}
function findNearestWall(walls, point, threshold = 0.5) {
  let best = null, bestDist = Infinity, bestT = 0;
  for (const w of walls) {
    const { dist, t } = distanceToSegment(point, w);
    if (dist < threshold && dist < bestDist) { best = w; bestDist = dist; bestT = t; }
  }
  return best ? { wall: best, t: bestT, dist: bestDist } : null;
}
function formatRu(n) { return Math.round(n).toLocaleString("ru-RU"); }
function polygonArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    s += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(s) / 2;
}
function polygonPerimeter(pts) {
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    p += Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
  }
  return p;
}

// ============================================================
// Floor-plan templates
// Each template is a list of levels. Each level has its own
// walls / windows / doors / openings / rooms — OR a roof object
// for roof-type levels.
// ============================================================

// Helper to scaffold floor data
const F = (walls, windows, doors, rooms) => ({ walls, windows, doors, openings: [], rooms });

var TEMPLATES = [
  // ───────────────── Дом ИЖС 120 м² ─────────────────
  {
    id: "tpl-house",
    name: "Дом ИЖС 120 м²",
    category: "Жилой дом",
    area: 120, rooms: 5, world: { w: 24, h: 16 },
    badge: "популярное",
    levels: [
      { id: "L-1", name: "1 этаж", type: "floor",
        ...F(
          [
            { type: "external", x1: 4,  y1: 3,  x2: 16, y2: 3  },
            { type: "external", x1: 16, y1: 3,  x2: 16, y2: 13 },
            { type: "external", x1: 4,  y1: 13, x2: 16, y2: 13 },
            { type: "external", x1: 4,  y1: 3,  x2: 4,  y2: 13 },
            { type: "internal", x1: 10, y1: 3,  x2: 10, y2: 13 },
            { type: "internal", x1: 4,  y1: 8,  x2: 10, y2: 8  },
            { type: "internal", x1: 10, y1: 8,  x2: 16, y2: 8  },
            { type: "internal", x1: 13, y1: 8,  x2: 13, y2: 13 },
          ],
          [
            { onIdx: 0, a: 5,  b: 7  }, { onIdx: 0, a: 12, b: 14 },
            { onIdx: 1, a: 4,  b: 6  }, { onIdx: 3, a: 10, b: 12 },
            { onIdx: 2, a: 5,  b: 7  },
          ],
          [
            { onIdx: 2, a: 14, b: 15.5, swing: "in", front: true },
            { onIdx: 5, a: 6,  b: 7,    swing: "in" },
            { onIdx: 4, a: 6,  b: 7,    swing: "in" },
            { onIdx: 4, a: 10, b: 11,   swing: "in" },
            { onIdx: 7, a: 9,  b: 10,   swing: "in" },
            { onIdx: 6, a: 14, b: 15,   swing: "in" },
          ],
          [
            { name: "Спальня",   x: 4,  y: 3, w: 6, h: 5, color: ROOM_COLORS[0] },
            { name: "Кухня",     x: 10, y: 3, w: 6, h: 5, color: ROOM_COLORS[1] },
            { name: "Гостиная",  x: 4,  y: 8, w: 6, h: 5, color: ROOM_COLORS[2] },
            { name: "Санузел",   x: 10, y: 8, w: 3, h: 5, color: ROOM_COLORS[3] },
            { name: "Прихожая",  x: 13, y: 8, w: 3, h: 5, color: ROOM_COLORS[6] },
          ]),
      },
    ],
  },

  // ───────────────── Дом 2 этажа 180 м² ─────────────────
  {
    id: "tpl-house2",
    name: "Дом 2 этажа 180 м²",
    category: "Жилой дом",
    area: 180, rooms: 8, world: { w: 24, h: 16 },
    levels: [
      { id: "L-1", name: "1 этаж", type: "floor",
        ...F(
          [
            { type: "external", x1: 5,  y1: 3,  x2: 17, y2: 3  },
            { type: "external", x1: 17, y1: 3,  x2: 17, y2: 11 },
            { type: "external", x1: 5,  y1: 11, x2: 17, y2: 11 },
            { type: "external", x1: 5,  y1: 3,  x2: 5,  y2: 11 },
            { type: "internal", x1: 11, y1: 3,  x2: 11, y2: 11 },
            { type: "internal", x1: 5,  y1: 7,  x2: 11, y2: 7  },
          ],
          [
            { onIdx: 0, a: 6, b: 8 }, { onIdx: 0, a: 13, b: 15 },
            { onIdx: 1, a: 5, b: 7 }, { onIdx: 2, a: 7, b: 9 },
          ],
          [
            { onIdx: 2, a: 14, b: 15, swing: "in", front: true },
            { onIdx: 4, a: 5, b: 6, swing: "in" },
            { onIdx: 5, a: 7, b: 8, swing: "in" },
          ],
          [
            { name: "Кухня",    x: 5,  y: 3, w: 6, h: 4, color: ROOM_COLORS[1] },
            { name: "Прихожая", x: 5,  y: 7, w: 6, h: 4, color: ROOM_COLORS[6] },
            { name: "Гостиная", x: 11, y: 3, w: 6, h: 8, color: ROOM_COLORS[2] },
          ]),
      },
      { id: "L-2", name: "2 этаж", type: "floor",
        ...F(
          [
            { type: "external", x1: 5,  y1: 3,  x2: 17, y2: 3  },
            { type: "external", x1: 17, y1: 3,  x2: 17, y2: 11 },
            { type: "external", x1: 5,  y1: 11, x2: 17, y2: 11 },
            { type: "external", x1: 5,  y1: 3,  x2: 5,  y2: 11 },
            { type: "internal", x1: 11, y1: 3,  x2: 11, y2: 11 },
            { type: "internal", x1: 11, y1: 7,  x2: 17, y2: 7  },
          ],
          [
            { onIdx: 0, a: 6, b: 8 }, { onIdx: 0, a: 13, b: 15 },
            { onIdx: 1, a: 4, b: 6 }, { onIdx: 1, a: 8, b: 10 },
            { onIdx: 2, a: 7, b: 9 },
          ],
          [
            { onIdx: 4, a: 4, b: 5, swing: "in" },
            { onIdx: 5, a: 13, b: 14, swing: "in" },
            { onIdx: 4, a: 8, b: 9, swing: "in" },
          ],
          [
            { name: "Спальня 1", x: 5,  y: 3, w: 6, h: 8, color: ROOM_COLORS[0] },
            { name: "Спальня 2", x: 11, y: 3, w: 6, h: 4, color: ROOM_COLORS[4] },
            { name: "Санузел",   x: 11, y: 7, w: 6, h: 4, color: ROOM_COLORS[3] },
          ]),
      },
    ],
  },

  // ───────────────── Дом + Гараж ─────────────────
  {
    id: "tpl-house-garage",
    name: "Дом + Гараж",
    category: "Жилой дом",
    area: 145, rooms: 5, world: { w: 30, h: 16 },
    badge: "новое",
    levels: [
      { id: "L-1", name: "1 этаж", type: "floor",
        ...F(
          [
            // House box
            { type: "external", x1: 3,  y1: 3,  x2: 15, y2: 3  },
            { type: "external", x1: 15, y1: 3,  x2: 15, y2: 13 },
            { type: "external", x1: 3,  y1: 13, x2: 15, y2: 13 },
            { type: "external", x1: 3,  y1: 3,  x2: 3,  y2: 13 },
            { type: "internal", x1: 9,  y1: 3,  x2: 9,  y2: 13 },
            { type: "internal", x1: 3,  y1: 8,  x2: 9,  y2: 8  },
          ],
          [
            { onIdx: 0, a: 4, b: 6 }, { onIdx: 0, a: 10, b: 13 },
            { onIdx: 3, a: 4, b: 6 }, { onIdx: 2, a: 4, b: 6 },
          ],
          [
            { onIdx: 2, a: 11, b: 12, swing: "in", front: true },
            { onIdx: 4, a: 5, b: 6, swing: "in" },
            { onIdx: 4, a: 10, b: 11, swing: "in" },
            { onIdx: 5, a: 6, b: 7, swing: "in" },
          ],
          [
            { name: "Спальня",  x: 3, y: 3, w: 6, h: 5, color: ROOM_COLORS[0] },
            { name: "Гостиная", x: 3, y: 8, w: 6, h: 5, color: ROOM_COLORS[2] },
            { name: "Кухня",    x: 9, y: 3, w: 6, h: 10, color: ROOM_COLORS[1] },
          ]),
      },
      { id: "L-G", name: "Гараж", type: "garage", world: { w: 30, h: 16 },
        ...F(
          [
            // Garage attached east of house
            { type: "external", x1: 17, y1: 4,  x2: 27, y2: 4  },
            { type: "external", x1: 27, y1: 4,  x2: 27, y2: 12 },
            { type: "external", x1: 17, y1: 12, x2: 27, y2: 12 },
            { type: "external", x1: 17, y1: 4,  x2: 17, y2: 12 },
          ],
          [{ onIdx: 0, a: 25, b: 26 }],
          // door = front gate, very wide
          [{ onIdx: 2, a: 18.5, b: 23.5, swing: "in", front: true, gate: true }],
          [{ name: "Гараж · 2 машино-места", x: 17, y: 4, w: 10, h: 8, color: ROOM_COLORS[5] }]),
      },
    ],
  },

  // ───────────────── Баня 30 м² ─────────────────
  {
    id: "tpl-banya",
    name: "Баня 30 м²",
    category: "Малая форма",
    area: 30, rooms: 3, world: { w: 18, h: 12 },
    levels: [
      { id: "L-1", name: "Баня", type: "floor",
        ...F(
          [
            { type: "external", x1: 5,  y1: 3,  x2: 11, y2: 3  },
            { type: "external", x1: 11, y1: 3,  x2: 11, y2: 8 },
            { type: "external", x1: 5,  y1: 8,  x2: 11, y2: 8 },
            { type: "external", x1: 5,  y1: 3,  x2: 5,  y2: 8 },
            { type: "internal", x1: 5,  y1: 5,  x2: 11, y2: 5 },
            { type: "internal", x1: 8,  y1: 3,  x2: 8,  y2: 5 },
          ],
          [
            { onIdx: 2, a: 6,   b: 7.5 },
            { onIdx: 3, a: 5.5, b: 6.5 },
          ],
          [
            { onIdx: 2, a: 9,    b: 10,   swing: "in", front: true },
            { onIdx: 4, a: 6,    b: 7,    swing: "in" },
            { onIdx: 4, a: 9,    b: 10,   swing: "in" },
          ],
          [
            { name: "Парная",         x: 5, y: 3, w: 3, h: 2, color: ROOM_COLORS[1] },
            { name: "Моечная",        x: 8, y: 3, w: 3, h: 2, color: ROOM_COLORS[3] },
            { name: "Комната отдыха", x: 5, y: 5, w: 6, h: 3, color: ROOM_COLORS[0] },
          ]),
      },
    ],
  },

  // ───────────────── Склад 30×60 ─────────────────
  {
    id: "tpl-warehouse",
    name: "Склад 30×60",
    category: "Промышленный",
    area: 1800, rooms: 3, world: { w: 70, h: 40 },
    badge: "1 800 м²",
    levels: [
      { id: "L-1", name: "Цех", type: "floor", world: { w: 70, h: 40 },
        ...F(
          [
            { type: "external", x1: 5,  y1: 5,  x2: 65, y2: 5  },
            { type: "external", x1: 65, y1: 5,  x2: 65, y2: 35 },
            { type: "external", x1: 5,  y1: 35, x2: 65, y2: 35 },
            { type: "external", x1: 5,  y1: 5,  x2: 5,  y2: 35 },
            { type: "internal", x1: 50, y1: 5,  x2: 50, y2: 35 },
          ],
          [
            { onIdx: 0, a: 10, b: 14 }, { onIdx: 0, a: 24, b: 28 }, { onIdx: 0, a: 38, b: 42 },
            { onIdx: 2, a: 10, b: 14 }, { onIdx: 2, a: 24, b: 28 }, { onIdx: 2, a: 38, b: 42 },
          ],
          [
            { onIdx: 0, a: 56, b: 62, swing: "in", front: true, gate: true },
            { onIdx: 4, a: 18, b: 22, swing: "in" },
          ],
          [
            { name: "Цех · 1350 м²",  x: 5,  y: 5, w: 45, h: 30, color: ROOM_COLORS[3] },
            { name: "Офис · 450 м²",  x: 50, y: 5, w: 15, h: 30, color: ROOM_COLORS[5] },
          ]),
      },
    ],
  },

  // ───────────────── Плоская кровля 500 м² ─────────────────
  {
    id: "tpl-roof-500",
    name: "Плоская кровля 500 м²",
    category: "Кровля",
    area: 500, rooms: 1, world: { w: 32, h: 24 },
    levels: [
      { id: "L-R", name: "Кровля", type: "roof", world: { w: 32, h: 24 },
        roof: {
          contour: [
            { x: 4, y: 3 }, { x: 28, y: 3 }, { x: 28, y: 21 }, { x: 4, y: 21 },
          ],
          parapetHeight: 0.5,
          slope: 1.5,
          material: "ПВХ-мембрана Logicroof 1.5мм",
          aerators: [
            { x: 10, y: 8 }, { x: 16, y: 8 }, { x: 22, y: 8 },
            { x: 10, y: 16 }, { x: 16, y: 16 }, { x: 22, y: 16 },
          ],
          drains: [
            { x: 7, y: 7 }, { x: 25, y: 7 }, { x: 7, y: 17 }, { x: 25, y: 17 },
          ],
          slopes: [
            { x1: 16, y1: 5,  x2: 7, y2: 7,  label: "1.5%" },
            { x1: 16, y1: 5,  x2: 25, y2: 7,  label: "1.5%" },
            { x1: 16, y1: 19, x2: 7, y2: 17, label: "1.5%" },
            { x1: 16, y1: 19, x2: 25, y2: 17, label: "1.5%" },
          ],
        },
      },
    ],
  },

  // ───────────────── Промышленная кровля 2000 м² ─────────────────
  {
    id: "tpl-roof-2000",
    name: "Промышленная кровля 2 000 м²",
    category: "Кровля",
    area: 2000, rooms: 1, world: { w: 80, h: 60 },
    badge: "промышленность",
    levels: [
      { id: "L-IR", name: "Пром. кровля", type: "industrial_roof", world: { w: 80, h: 60 },
        roof: {
          contour: [
            { x: 8,  y: 8 }, { x: 72, y: 8 }, { x: 72, y: 50 }, { x: 8, y: 50 },
          ],
          parapetHeight: 0.6,
          slope: 1.5,
          material: "Битумно-полимерная мембрана Техноэласт 2-сл.",
          aerators: (() => {
            const out = [];
            for (let r = 0; r < 4; r++) {
              for (let c = 0; c < 7; c++) {
                out.push({ x: 13 + c * 9, y: 13 + r * 11 });
              }
            }
            return out;
          })(),
          drains: [
            { x: 12, y: 12 }, { x: 30, y: 12 }, { x: 50, y: 12 }, { x: 68, y: 12 },
            { x: 12, y: 46 }, { x: 30, y: 46 }, { x: 50, y: 46 }, { x: 68, y: 46 },
            { x: 12, y: 29 }, { x: 68, y: 29 },
          ],
          slopes: [
            { x1: 40, y1: 14, x2: 12, y2: 12, label: "1.5%" },
            { x1: 40, y1: 14, x2: 68, y2: 12, label: "1.5%" },
            { x1: 40, y1: 44, x2: 12, y2: 46, label: "1.5%" },
            { x1: 40, y1: 44, x2: 68, y2: 46, label: "1.5%" },
          ],
          segments: [
            { id: "S-A", name: "Секция A · 800 м²",  bounds: { x: 8,  y: 8,  w: 32, h: 21 } },
            { id: "S-B", name: "Секция B · 720 м²",  bounds: { x: 40, y: 8,  w: 32, h: 21 } },
            { id: "S-C", name: "Секция C · 480 м²",  bounds: { x: 8,  y: 29, w: 64, h: 21 } },
          ],
        },
      },
    ],
  },
];

// ============================================================
// Instantiate template into stateful project with ids
// ============================================================
function instantiateTemplate(tpl) {
  const levels = tpl.levels.map((lvl, li) => {
    const walls = (lvl.walls || []).map((w, i) => ({ id: `${lvl.id}-W${i+1}`, layerId: w.type === "external" ? "L-walls-ext" : "L-walls-int", ...w }));
    const windows = (lvl.windows || []).map((wn, i) => ({
      id: `${lvl.id}-WN${i+1}`,
      on: walls[wn.onIdx] ? walls[wn.onIdx].id : null,
      a: wn.a, b: wn.b,
      layerId: "L-openings",
    }));
    const doors = (lvl.doors || []).map((d, i) => ({
      id: `${lvl.id}-D${i+1}`,
      on: walls[d.onIdx] ? walls[d.onIdx].id : null,
      a: d.a, b: d.b,
      swing: d.swing, front: d.front, gate: d.gate,
      layerId: "L-openings",
    }));
    const rooms = (lvl.rooms || []).map((r, i) => ({ id: `${lvl.id}-R${i+1}`, geometryType: "rect", layerId: "L-rooms", ...r }));

    // Roof — preserve as-is if present
    const roof = lvl.roof ? {
      ...lvl.roof,
      aerators: (lvl.roof.aerators || []).map((a, i) => ({ id: `${lvl.id}-AER${i+1}`, layerId: "L-aerators", ...a })),
      drains:   (lvl.roof.drains   || []).map((d, i) => ({ id: `${lvl.id}-DRN${i+1}`, layerId: "L-drains", ...d })),
      slopes:   (lvl.roof.slopes   || []).map((s, i) => ({ id: `${lvl.id}-SLP${i+1}`, layerId: "L-slopes", percent: s.percent || parseFloat((s.label || "1.5").toString().replace("%", "")) || 1.5, ...s })),
      segments: (lvl.roof.segments || []).map((s, i) => ({
        id: s.id || `${lvl.id}-SEG${i+1}`,
        layerId: "L-segments",
        ...s,
        x: s.x ?? s.bounds?.x,
        y: s.y ?? s.bounds?.y,
        w: s.w ?? s.bounds?.w,
        h: s.h ?? s.bounds?.h,
      })),
      parapets:  (lvl.roof.parapets  || []).map((p, i) => ({ id: `${lvl.id}-PRP${i+1}`, layerId: "L-parapets", ...p })),
      junctions: (lvl.roof.junctions || []).map((j, i) => ({ id: `${lvl.id}-JCT${i+1}`, layerId: "L-junctions", ...j })),
      engouts:   (lvl.roof.engouts   || []).map((e, i) => ({ id: `${lvl.id}-EGO${i+1}`, layerId: "L-engouts", ...e })),
    } : null;

    return {
      id: lvl.id,
      name: lvl.name,
      type: lvl.type || "floor",
      world: lvl.world || tpl.world || DEFAULT_WORLD,
      walls, windows, doors, openings: [], rooms,
      dimensions: [], notes: [],
      layers: defaultLayersForType(lvl.type),
      roof,
    };
  });
  return { levels, world: tpl.world || DEFAULT_WORLD };
}
function emptyLevel(id, name, type, world) {
  const isRoof = type === "roof" || type === "industrial_roof";
  return {
    id, name, type: type || "floor",
    world: world || DEFAULT_WORLD,
    walls: [], windows: [], doors: [], openings: [], rooms: [],
    dimensions: [], notes: [],
    backgrounds: [],
    layers: defaultLayersForType(type),
    roof: isRoof ? {
      contour: [], parapetHeight: 0.5, slope: 1.5, material: "—",
      aerators: [], drains: [], slopes: [], segments: [],
      parapets: [], junctions: [], engouts: [],
    } : null,
  };
}

// ============================================================
// Layers
// ============================================================
const LAYERS_PLAN = [
  { id: "L-bgs",        name: "Подложки / Чертежи", color: "#94A3B8", visible: true, locked: false, opacity: 1 },
  { id: "L-candidates", name: "AI-кандидаты",       color: "#7C3AED", visible: true, locked: false, opacity: 1 },
  { id: "L-walls-ext",  name: "Внешние стены",  color: "#1F2937", visible: true, locked: false, opacity: 1 },
  { id: "L-walls-int",  name: "Перегородки",    color: "#4A5365", visible: true, locked: false, opacity: 1 },
  { id: "L-rooms",      name: "Комнаты / зоны", color: "#15803D", visible: true, locked: false, opacity: 1 },
  { id: "L-openings",   name: "Окна и двери",   color: "#2563EB", visible: true, locked: false, opacity: 1 },
  { id: "L-dims",       name: "Размеры",        color: "#7C2D12", visible: true, locked: false, opacity: 1 },
  { id: "L-notes",      name: "Заметки",        color: "#B45309", visible: true, locked: false, opacity: 1 },
];
const LAYERS_ROOF = [
  { id: "L-bgs",      name: "Подложки / Чертежи", color: "#94A3B8", visible: true, locked: false, opacity: 1 },
  { id: "L-contour",  name: "Контур кровли",  color: "#0B1220", visible: true, locked: false, opacity: 1 },
  { id: "L-segments", name: "Сегменты кровли",color: "#7C3AED", visible: true, locked: false, opacity: 1 },
  { id: "L-slopes",   name: "Уклоны",         color: "#7C2D12", visible: true, locked: false, opacity: 1 },
  { id: "L-aerators", name: "Аэраторы",       color: "#1E3A8A", visible: true, locked: false, opacity: 1 },
  { id: "L-drains",   name: "Воронки",        color: "#0891B2", visible: true, locked: false, opacity: 1 },
  { id: "L-parapets", name: "Парапеты",       color: "#7C2D12", visible: true, locked: false, opacity: 1 },
  { id: "L-junctions",name: "Примыкания",     color: "#9A3412", visible: true, locked: false, opacity: 1 },
  { id: "L-engouts",  name: "Инж. выходы",    color: "#4A5365", visible: true, locked: false, opacity: 1 },
  { id: "L-dims",     name: "Размеры",        color: "#7C2D12", visible: true, locked: false, opacity: 1 },
  { id: "L-notes",    name: "Заметки",        color: "#B45309", visible: true, locked: false, opacity: 1 },
];
function defaultLayersForType(type) {
  const isRoof = type === "roof" || type === "industrial_roof";
  return JSON.parse(JSON.stringify(isRoof ? LAYERS_ROOF : LAYERS_PLAN));
}

// Default layer assignment per object kind
var LAYER_OF = {
  wall_external: "L-walls-ext",
  wall_internal: "L-walls-int",
  room: "L-rooms",
  window: "L-openings",
  door: "L-openings",
  opening: "L-openings",
  dimension: "L-dims",
  note: "L-notes",
  background: "L-bgs",
  contour: "L-contour",
  segment: "L-segments",
  slope: "L-slopes",
  aerator: "L-aerators",
  drain: "L-drains",
  parapet: "L-parapets",
  junction: "L-junctions",
  engout: "L-engouts",
};
function layerIdFor(obj, kind) {
  if (obj && obj.layerId) return obj.layerId;
  return LAYER_OF[kind] || null;
}

// ============================================================
// Room types & engout/junction types
// ============================================================
const ROOM_TYPES = [
  "Жилая", "Кухня", "Санузел", "Коридор", "Тех. помещение",
  "Гараж", "Склад", "Кровельная зона",
];
const ENGOUT_TYPES = [
  "Вентиляционная шахта", "Труба", "Кабельный ввод",
  "Люк", "Выход на кровлю", "Другое",
];
const JUNCTION_TYPES = [
  "к стене", "к парапету", "к трубе", "к шахте",
  "к инженерному выходу", "другое",
];

// Geometry helpers for layers/walls
function pointInPolygon(p, poly) {
  if (!poly || poly.length < 3) return true;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const denom = (yj - yi) || 1e-9;
    if (((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / denom + xi)) inside = !inside;
  }
  return inside;
}

// ============================================================
// CAD-lite viewport helpers
// world = meters; screen = px; viewState = { panX, panY, zoom }
// panX/panY — смещение мира в screen-px (origin world (0,0) на экране).
// zoom — масштаб world→px (1 = PX_PER_M пикселей на метр)
// ============================================================
function clampZoom(z) { return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z)); }
function screenToWorld(sx, sy, viewState) {
  return {
    x: (sx - viewState.panX) / (PX_PER_M * viewState.zoom),
    y: (sy - viewState.panY) / (PX_PER_M * viewState.zoom),
  };
}
function worldToScreen(wx, wy, viewState) {
  return {
    x: wx * PX_PER_M * viewState.zoom + viewState.panX,
    y: wy * PX_PER_M * viewState.zoom + viewState.panY,
  };
}
function snapPoint(p, gridSize, alt) {
  if (alt) return p;
  return { x: snapToGrid(p.x, gridSize), y: snapToGrid(p.y, gridSize) };
}

// Bounds: returns { x, y, w, h } in world meters, or null if empty
function getObjectBounds(obj) {
  if (!obj) return null;
  if ("x1" in obj && "y1" in obj && "x2" in obj && "y2" in obj) {
    const x = Math.min(obj.x1, obj.x2), y = Math.min(obj.y1, obj.y2);
    const w = Math.abs(obj.x2 - obj.x1), h = Math.abs(obj.y2 - obj.y1);
    return { x: x - 0.2, y: y - 0.2, w: w + 0.4, h: h + 0.4 };
  }
  if ("w" in obj && "h" in obj && "x" in obj && "y" in obj) {
    return { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
  }
  if ("x" in obj && "y" in obj) {
    return { x: obj.x - 0.5, y: obj.y - 0.5, w: 1, h: 1 };
  }
  return null;
}
function unionBounds(list) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of list) {
    if (!b) continue;
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
    if (b.y + b.h > maxY) maxY = b.y + b.h;
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
function getLevelBounds(data) {
  const list = [];
  for (const w of (data.walls || [])) list.push(getObjectBounds(w));
  for (const r of (data.rooms || [])) list.push(getObjectBounds(r));
  if (data.roof) {
    if (data.roof.contour?.length >= 3) {
      const xs = data.roof.contour.map(p => p.x), ys = data.roof.contour.map(p => p.y);
      list.push({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) });
    }
    for (const a of (data.roof.aerators || [])) list.push(getObjectBounds(a));
    for (const d of (data.roof.drains || [])) list.push(getObjectBounds(d));
    for (const s of (data.roof.segments || [])) if (s.bounds) list.push(s.bounds);
  }
  return unionBounds(list);
}
// Compute viewState to fit bounds within screen rect (px) with padding
function fitBoundsToView(bounds, screenW, screenH, paddingPx = 60) {
  if (!bounds || bounds.w <= 0 || bounds.h <= 0 || screenW <= 0 || screenH <= 0) return null;
  const availW = Math.max(50, screenW - paddingPx * 2);
  const availH = Math.max(50, screenH - paddingPx * 2);
  const zoom = clampZoom(Math.min(availW / (bounds.w * PX_PER_M), availH / (bounds.h * PX_PER_M)));
  // Center bounds
  const wPx = bounds.w * PX_PER_M * zoom;
  const hPx = bounds.h * PX_PER_M * zoom;
  const panX = (screenW - wPx) / 2 - bounds.x * PX_PER_M * zoom;
  const panY = (screenH - hPx) / 2 - bounds.y * PX_PER_M * zoom;
  return { panX, panY, zoom };
}
// Visible grid step based on zoom (returns meters)
function getVisibleGridStep(zoom) {
  // Aim for ~25-50px between minor lines
  const pxPerM = PX_PER_M * zoom;
  if (pxPerM >= 100) return 0.5;
  if (pxPerM >=  30) return 1;
  if (pxPerM >=   8) return 5;
  return 10;
}
// Distance to wall/room/point object in meters
function distanceToObject(obj, point) {
  if (!obj) return Infinity;
  if ("x1" in obj && "y1" in obj) {
    return distanceToSegment(point, obj).dist;
  }
  if ("w" in obj && "h" in obj && "x" in obj) {
    // Distance to rect (0 inside)
    const dx = Math.max(obj.x - point.x, 0, point.x - (obj.x + obj.w));
    const dy = Math.max(obj.y - point.y, 0, point.y - (obj.y + obj.h));
    return Math.hypot(dx, dy);
  }
  if ("x" in obj && "y" in obj) {
    return Math.hypot(obj.x - point.x, obj.y - point.y);
  }
  return Infinity;
}
// Hit-test: prefer points > walls > rooms (smaller objects on top)
function findObjectAtPoint(data, point, threshold = 0.5) {
  // Roof points first
  if (data.roof) {
    for (const a of (data.roof.aerators || [])) {
      if (Math.hypot(a.x - point.x, a.y - point.y) < 0.45) return { obj: a, type: "aerator" };
    }
    for (const d of (data.roof.drains || [])) {
      if (Math.hypot(d.x - point.x, d.y - point.y) < 0.4) return { obj: d, type: "drain" };
    }
  }
  // Walls
  let bestWall = null, bestWallDist = Infinity;
  for (const w of (data.walls || [])) {
    const { dist } = distanceToSegment(point, w);
    if (dist < threshold && dist < bestWallDist) { bestWall = w; bestWallDist = dist; }
  }
  if (bestWall) return { obj: bestWall, type: "wall" };
  // Rooms (inside)
  for (const r of (data.rooms || [])) {
    if (point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h) {
      return { obj: r, type: "room" };
    }
  }
  return null;
}

// ============================================================
// Estimate draft helper — generates table rows from level data
// ============================================================
function getEstimateDraft(levelData, levelType) {
  const out = [];
  const isRoof = levelType === "roof" || levelType === "industrial_roof";
  if (isRoof && levelData.roof) {
    const r = levelData.roof;
    const area = r.contour?.length >= 3 ? polygonArea(r.contour) : 0;
    if (area > 0) out.push({ id: "roof-cover", group: "Кровля", name: r.material || "Кровельное покрытие", qty: +area.toFixed(1), unit: "м²", mat: PRICE.roofPerM2.mat, work: PRICE.roofPerM2.work, total: area * (PRICE.roofPerM2.mat + PRICE.roofPerM2.work), source: "Прайс Июнь 2026", include: true });

    // Segments (filter out excluded)
    for (const s of (r.segments || [])) {
      if (s.includeInEstimate === false) continue;
      const sa = s.area != null ? s.area : (s.w && s.h ? s.w * s.h : (s.bounds ? s.bounds.w * s.bounds.h : 0));
      if (sa < 0.1) continue;
      out.push({ id: `seg-${s.id}`, group: "Кровля · сегменты", name: s.name || s.id, qty: +sa.toFixed(1), unit: "м²", mat: PRICE.roofPerM2.mat, work: PRICE.roofPerM2.work, total: sa * (PRICE.roofPerM2.mat + PRICE.roofPerM2.work), source: s.material || "Прайс Июнь 2026", include: true });
    }

    // Parapets — explicit list, fallback to contour
    const parapets = r.parapets || [];
    const parapetLen = parapets.length
      ? parapets.filter(p => p.includeInEstimate !== false).reduce((s, p) => s + (p.length != null ? p.length : Math.hypot(p.x2 - p.x1, p.y2 - p.y1)), 0)
      : (r.contour?.length >= 3 ? polygonPerimeter(r.contour) : 0);
    if (parapetLen > 0.1) out.push({ id: "roof-parapet", group: "Кровля", name: "Парапет", qty: +parapetLen.toFixed(1), unit: "м", mat: PRICE.parapetPerM.mat, work: PRICE.parapetPerM.work, total: parapetLen * (PRICE.parapetPerM.mat + PRICE.parapetPerM.work), source: "Прайс Июнь 2026", include: true });

    // Junctions
    const junctionLen = (r.junctions || [])
      .filter(j => j.includeInEstimate !== false)
      .reduce((s, j) => s + (j.length != null ? j.length : Math.hypot(j.x2 - j.x1, j.y2 - j.y1)), 0);
    if (junctionLen > 0.1) out.push({ id: "roof-junction", group: "Кровля", name: "Примыкания (узлы)", qty: +junctionLen.toFixed(1), unit: "м", mat: 1100, work: 800, total: junctionLen * 1900, source: "Прайс Июнь 2026", include: true });

    // Engineering outlets — break down by type
    const engs = (r.engouts || []).filter(e => e.includeInEstimate !== false);
    if (engs.length) {
      const byType = {};
      for (const e of engs) {
        const t = e.engoutType || "Другое";
        byType[t] = (byType[t] || 0) + 1;
      }
      const enr = (label, mat, work) => ({ id: `roof-eng-${label}`, group: "Кровля · доп. элементы", name: label, qty: 1, unit: "шт", mat, work, total: mat + work, source: "Прайс Июнь 2026", include: true });
      for (const [t, cnt] of Object.entries(byType)) {
        const e = enr(t, 3500, 1800);
        e.qty = cnt; e.total = cnt * (e.mat + e.work);
        out.push(e);
      }
    }

    const aer = (r.aerators || []).filter(a => a.includeInEstimate !== false).length;
    if (aer) out.push({ id: "roof-aerator", group: "Кровля", name: "Аэратор", qty: aer, unit: "шт", mat: PRICE.aerator.mat, work: PRICE.aerator.work, total: aer * (PRICE.aerator.mat + PRICE.aerator.work), source: "Прайс Июнь 2026", include: true });
    const drn = (r.drains || []).filter(d => d.includeInEstimate !== false).length;
    if (drn) out.push({ id: "roof-drain", group: "Кровля", name: "Воронка водосточная", qty: drn, unit: "шт", mat: PRICE.drain.mat, work: PRICE.drain.work, total: drn * (PRICE.drain.mat + PRICE.drain.work), source: "Прайс Июнь 2026", include: true });
    return out;
  }
  const walls = (levelData.walls || []).filter(w => w.includeInEstimate !== false);
  const ext = walls.filter(w => w.type === "external");
  const int = walls.filter(w => w.type === "internal");
  const extLen = ext.reduce((s, w) => s + wallLen(w), 0);
  const intLen = int.reduce((s, w) => s + wallLen(w), 0);
  if (extLen) out.push({ id: "wall-ext", group: "Стены", name: "Внешняя стена",  qty: +extLen.toFixed(1), unit: "м", mat: PRICE.externalWall.mat, work: PRICE.externalWall.work, total: extLen * (PRICE.externalWall.mat + PRICE.externalWall.work), source: "Прайс Июнь 2026", include: true });
  if (intLen) out.push({ id: "wall-int", group: "Стены", name: "Перегородка",   qty: +intLen.toFixed(1), unit: "м", mat: PRICE.internalWall.mat, work: PRICE.internalWall.work, total: intLen * (PRICE.internalWall.mat + PRICE.internalWall.work), source: "Прайс Июнь 2026", include: true });
  const winList = (levelData.windows || []).filter(w => w.includeInEstimate !== false);
  if (winList.length) out.push({ id: "win", group: "Окна", name: "Окно ПВХ", qty: winList.length, unit: "шт", mat: PRICE.window.mat, work: PRICE.window.work, total: winList.length * (PRICE.window.mat + PRICE.window.work), source: "Прайс Июнь 2026", include: true });
  const doorList = (levelData.doors || []).filter(d => d.includeInEstimate !== false);
  const gates = doorList.filter(d => d.gate);
  const doorsOnly = doorList.filter(d => !d.gate);
  if (doorsOnly.length) out.push({ id: "door", group: "Двери", name: "Дверь", qty: doorsOnly.length, unit: "шт", mat: PRICE.door.mat, work: PRICE.door.work, total: doorsOnly.length * (PRICE.door.mat + PRICE.door.work), source: "Прайс Июнь 2026", include: true });
  if (gates.length)    out.push({ id: "gate", group: "Двери", name: "Ворота", qty: gates.length, unit: "шт", mat: 38000, work: 9500, total: gates.length * 47500, source: "Прайс Июнь 2026", include: true });
  const ops = (levelData.openings || []).filter(o => o.includeInEstimate !== false);
  if (ops.length)     out.push({ id: "open", group: "Проёмы", name: "Проём (без двери)", qty: ops.length, unit: "шт", mat: 0, work: 1800, total: ops.length * 1800, source: "Прайс Июнь 2026", include: true });
  const area = (levelData.rooms || []).filter(r => r.includeInEstimate !== false).reduce((s, r) => s + r.w * r.h, 0);
  if (area) {
    out.push({ id: "floor", group: "Полы и потолки", name: "Пол (черновой + чистовой)", qty: +area.toFixed(1), unit: "м²", mat: PRICE.floorPerM2.mat, work: PRICE.floorPerM2.work, total: area * (PRICE.floorPerM2.mat + PRICE.floorPerM2.work), source: "Прайс Июнь 2026", include: true });
    out.push({ id: "ceil",  group: "Полы и потолки", name: "Потолок", qty: +area.toFixed(1), unit: "м²", mat: PRICE.ceilingPerM2.mat, work: PRICE.ceilingPerM2.work, total: area * (PRICE.ceilingPerM2.mat + PRICE.ceilingPerM2.work), source: "Прайс Июнь 2026", include: true });
  }
  return out;
}

// ============================================================
// Validation — warnings list
// ============================================================
function getValidationWarnings(levelData, levelType) {
  const warns = [];
  const isRoof = levelType === "roof" || levelType === "industrial_roof";
  const walls = levelData.walls || [];
  const rooms = levelData.rooms || [];

  if (isRoof) {
    const c = levelData.roof?.contour || [];
    const roof = levelData.roof || {};
    if (c.length === 0) warns.push({ id: "roof-empty", level: "info", text: "Контур кровли не задан" });
    else if (c.length < 3) warns.push({ id: "roof-open", level: "warn", text: "Контур кровли не замкнут (минимум 3 угла)" });
    if (c.length >= 3) {
      const inside = (p) => pointInPolygon(p, c);
      for (const a of (roof.aerators || [])) if (!inside(a)) warns.push({ id: `out-${a.id}`, level: "warn", text: `Аэратор ${a.id} вне контура кровли`, targetId: a.id });
      for (const d of (roof.drains || [])) if (!inside(d)) warns.push({ id: `out-${d.id}`, level: "warn", text: `Воронка ${d.id} вне контура кровли`, targetId: d.id });
      for (const e of (roof.engouts || [])) if (!inside(e)) warns.push({ id: `out-${e.id}`, level: "warn", text: `Инж. выход ${e.id} вне контура кровли`, targetId: e.id });
      for (const j of (roof.junctions || [])) {
        const mid = { x: (j.x1 + j.x2)/2, y: (j.y1 + j.y2)/2 };
        if (!inside(mid)) warns.push({ id: `out-${j.id}`, level: "warn", text: `Примыкание ${j.id} вне контура кровли`, targetId: j.id });
      }
      for (const s of (roof.segments || [])) {
        const corners = [{ x: s.x, y: s.y }, { x: s.x + s.w, y: s.y }, { x: s.x + s.w, y: s.y + s.h }, { x: s.x, y: s.y + s.h }];
        if (!corners.every(inside)) warns.push({ id: `out-${s.id}`, level: "warn", text: `Сегмент «${s.name || s.id}» выходит за контур кровли`, targetId: s.id });
        if (s.w * s.h < 1) warns.push({ id: `small-${s.id}`, level: "info", text: `Сегмент «${s.name || s.id}» меньше 1 м²`, targetId: s.id });
      }
      const area = polygonArea(c);
      const drnCnt = (roof.drains || []).length;
      if (area >= 200 && drnCnt === 0) warns.push({ id: "no-drain", level: "warn", text: "На большой плоской кровле не задана ни одна воронка" });
      if (area >= 200 && (roof.slopes || []).length === 0) warns.push({ id: "no-slope", level: "warn", text: "На плоской кровле не задан уклон" });
      const hasParapet = (roof.parapets || []).length > 0;
      if (!hasParapet) warns.push({ id: "no-parapet", level: "info", text: "Парапет не задан (по умолчанию по контуру)" });
      // Material checks on segments
      for (const s of (roof.segments || [])) {
        if (!s.material && s.includeInEstimate !== false) {
          warns.push({ id: `mat-${s.id}`, level: "warn", text: `Сегмент «${s.name || s.id}» без материала`, targetId: s.id });
        }
      }
      // Excluded-from-estimate informational warning
      const excludedTypes = [];
      const checkExcluded = (arr, label) => {
        const n = (arr || []).filter(o => o.includeInEstimate === false).length;
        if (n) excludedTypes.push(`${label}: ${n}`);
      };
      checkExcluded(roof.segments, "сегментов");
      checkExcluded(roof.aerators, "аэраторов");
      checkExcluded(roof.drains,   "воронок");
      checkExcluded(roof.parapets, "парапетов");
      checkExcluded(roof.junctions,"примыканий");
      checkExcluded(roof.engouts,  "инж. выходов");
      if (excludedTypes.length) {
        warns.push({ id: "excluded", level: "info", text: `Исключено из сметы — ${excludedTypes.join(" · ")}` });
      }
      // Slope without segment link (mild)
      for (const sl of (roof.slopes || [])) {
        if (!sl.segmentId) warns.push({ id: `slp-unlinked-${sl.id}`, level: "info", text: `Уклон ${sl.id} не привязан к сегменту`, targetId: sl.id });
      }
    }
  } else {
    if (walls.length === 0 && rooms.length === 0) warns.push({ id: "empty", level: "info", text: "На уровне ещё нет объектов" });
    for (const w of walls) {
      if (wallLen(w) < 0.4) warns.push({ id: `short-${w.id}`, level: "warn", text: `Стена ${w.id} слишком короткая (< 0.4 м)`, targetId: w.id });
    }
    for (const r of rooms) {
      if (r.w * r.h < 1) warns.push({ id: `small-${r.id}`, level: "info", text: `Комната «${r.name}» меньше 1 м²`, targetId: r.id });
    }
    for (const win of (levelData.windows || [])) {
      const w = walls.find(x => x.id === win.on);
      if (!w) { warns.push({ id: `orph-${win.id}`, level: "error", text: `Окно ${win.id} не привязано к стене`, targetId: win.id }); continue; }
      const isH = wallIsH(w);
      const a = isH ? Math.min(w.x1, w.x2) : Math.min(w.y1, w.y2);
      const b = isH ? Math.max(w.x1, w.x2) : Math.max(w.y1, w.y2);
      if (win.b - win.a > b - a + 0.01) warns.push({ id: `over-${win.id}`, level: "warn", text: `Окно ${win.id} шире стены`, targetId: win.id });
      else if (win.a < a - 0.01 || win.b > b + 0.01) warns.push({ id: `oob-${win.id}`, level: "warn", text: `Окно ${win.id} выходит за стену`, targetId: win.id });
    }
    for (const d of (levelData.doors || [])) {
      const w = walls.find(x => x.id === d.on);
      if (!w) { warns.push({ id: `orph-${d.id}`, level: "error", text: `${d.gate ? "Ворота" : "Дверь"} ${d.id} не привязаны к стене`, targetId: d.id }); continue; }
      const isH = wallIsH(w);
      const a = isH ? Math.min(w.x1, w.x2) : Math.min(w.y1, w.y2);
      const b = isH ? Math.max(w.x1, w.x2) : Math.max(w.y1, w.y2);
      const label = d.gate ? "Ворота" : "Дверь";
      if (d.b - d.a > b - a + 0.01) warns.push({ id: `over-${d.id}`, level: "warn", text: `${label} ${d.id} шире стены`, targetId: d.id });
      else if (d.a < a - 0.01 || d.b > b + 0.01) warns.push({ id: `oob-${d.id}`, level: "warn", text: `${label} ${d.id} выходит за стену`, targetId: d.id });
    }
  }
  return warns;
}

// ============================================================
// Tools per mode
// ============================================================
var TOOLSETS = {
  plan: [
    { id: "select",   label: "Выбор",        icon: "Cursor",    kbd: "V" },
    { id: "hand",     label: "Перемещение",  icon: "Hand",      kbd: "H" },
    { sep: true },
    { id: "wall",     label: "Стена",        icon: "Wall",      kbd: "W" },
    { id: "partition",label: "Перегородка",  icon: "Partition", kbd: "P" },
    { id: "window",   label: "Окно",         icon: "Window",    kbd: "O" },
    { id: "door",     label: "Дверь",        icon: "Door",      kbd: "D" },
    { id: "opening",  label: "Проём",        icon: "Opening",   kbd: "G" },
    { sep: true },
    { id: "room",     label: "Комната",      icon: "Room",      kbd: "R" },
    { id: "dim",      label: "Размер",       icon: "Ruler",     kbd: "M" },
    { id: "note",     label: "Заметка",      icon: "Edit",      kbd: "N" },
  ],
  roof: [
    { id: "select",      label: "Выбор",          icon: "Cursor",  kbd: "V" },
    { id: "hand",        label: "Перемещение",    icon: "Hand",    kbd: "H" },
    { sep: true },
    { id: "roof_contour",label: "Контур кровли",  icon: "Room",    kbd: "C" },
    { id: "roof_segment",label: "Сегмент",        icon: "Partition", kbd: "S" },
    { id: "slope",       label: "Уклон",          icon: "ArrowRight", kbd: "L" },
    { sep: true },
    { id: "aerator",     label: "Аэратор",        icon: "Aerator", kbd: "A" },
    { id: "drain",       label: "Воронка",        icon: "Drain",   kbd: "G" },
    { id: "parapet",     label: "Парапет",        icon: "Wall",    kbd: "P" },
    { id: "junction",    label: "Примыкание",     icon: "Opening", kbd: "J" },
    { id: "engout",      label: "Инж. выход",     icon: "Door",    kbd: "E" },
    { sep: true },
    { id: "dim",         label: "Размер",         icon: "Ruler",   kbd: "M" },
    { id: "note",        label: "Заметка",        icon: "Edit",    kbd: "T" },
  ],
  zones: [
    { id: "select", label: "Выбор",       icon: "Cursor", kbd: "V" },
    { id: "hand",   label: "Перемещение", icon: "Hand",   kbd: "H" },
    { sep: true },
    { id: "zone",   label: "Зона",        icon: "Room",   kbd: "Z" },
    { id: "dim",    label: "Размер",      icon: "Ruler",  kbd: "M" },
    { id: "note",   label: "Заметка",     icon: "Edit",   kbd: "T" },
  ],
};

// Expose to other files via globals
Object.assign(window, {
  PL_DEFAULT_WORLD: DEFAULT_WORLD,
  PL_PX_PER_M: PX_PER_M,
  PL_MIN_ZOOM: MIN_ZOOM,
  PL_MAX_ZOOM: MAX_ZOOM,
  PL_GRID_SIZES: GRID_SIZES,
  PL_MODES: MODES,
  PL_LEVEL_TYPES: LEVEL_TYPES,
  PL_PRICE: PRICE,
  PL_ROOM_COLORS: ROOM_COLORS,
  PL_TEMPLATES: TEMPLATES,
  PL_TOOLSETS: TOOLSETS,
  PL_LAYERS_PLAN: LAYERS_PLAN,
  PL_LAYERS_ROOF: LAYERS_ROOF,
  PL_ROOM_TYPES: ROOM_TYPES,
  PL_ENGOUT_TYPES: ENGOUT_TYPES,
  PL_JUNCTION_TYPES: JUNCTION_TYPES,
  PL_LAYER_OF: LAYER_OF,
  // helpers
  plWallLen: wallLen,
  plWallIsH: wallIsH,
  plSnapToGrid: snapToGrid,
  plAxisLock: axisLock,
  plDistanceToSegment: distanceToSegment,
  plFindNearestWall: findNearestWall,
  plFormatRu: formatRu,
  plPolygonArea: polygonArea,
  plPolygonPerimeter: polygonPerimeter,
  plPointInPolygon: pointInPolygon,
  plDefaultLayersForType: defaultLayersForType,
  plLayerIdFor: layerIdFor,
  plInstantiateTemplate: instantiateTemplate,
  plEmptyLevel: emptyLevel,
  plWallAxisBounds: wallAxisBounds,
  plClampOpeningOnWall: clampOpeningOnWall,
  plClassifyObject: classifyObject,
  plObjectKind: objectKind,
  plIterAllObjects: iterAllObjects,
  plFindObjectById: findObjectById,
  // CAD-lite helpers
  plClampZoom: clampZoom,
  plScreenToWorld: screenToWorld,
  plWorldToScreen: worldToScreen,
  plSnapPoint: snapPoint,
  plGetObjectBounds: getObjectBounds,
  plGetLevelBounds: getLevelBounds,
  plFitBoundsToView: fitBoundsToView,
  plGetVisibleGridStep: getVisibleGridStep,
  plDistanceToObject: distanceToObject,
  plFindObjectAtPoint: findObjectAtPoint,
  plGetEstimateDraft: getEstimateDraft,
  plGetValidationWarnings: getValidationWarnings,
  plUnionBounds: unionBounds,
  // back-compat with old name
  formatRu,
});

// ============================================================
// Object-kind classification helpers (used by selection,
// inspector, layer system, multi-select, etc.)
// ============================================================
function wallAxisBounds(wall) {
  const isH = wallIsH(wall);
  return {
    isH,
    a: isH ? Math.min(wall.x1, wall.x2) : Math.min(wall.y1, wall.y2),
    b: isH ? Math.max(wall.x1, wall.x2) : Math.max(wall.y1, wall.y2),
  };
}
function clampOpeningOnWall(wall, opening) {
  const { a, b } = wallAxisBounds(wall);
  const width = opening.b - opening.a;
  const wmax = Math.max(0.4, Math.min(width, b - a - 0.05));
  let na = opening.a, nb = na + wmax;
  if (na < a) { na = a; nb = a + wmax; }
  if (nb > b) { nb = b; na = b - wmax; }
  return { a: na, b: nb };
}
function objectKind(id) {
  if (!id) return null;
  if (id.includes("-AER") || id.startsWith("AER-")) return "aerator";
  if (id.includes("-DRN") || id.startsWith("DRN-")) return "drain";
  if (id.includes("-SLP") || id.startsWith("SLP-")) return "slope";
  if (id.includes("-SEG") || id.startsWith("SEG-")) return "segment";
  if (id.includes("-PRP") || id.startsWith("PRP-")) return "parapet";
  if (id.includes("-JCT") || id.startsWith("JCT-")) return "junction";
  if (id.includes("-EGO") || id.startsWith("EGO-")) return "engout";
  if (id.includes("-DIM") || id.startsWith("DIM-")) return "dimension";
  if (id.includes("-NOTE") || id.startsWith("NOTE-")) return "note";
  if (id.includes("-WN") || id.startsWith("WN-")) return "window";
  if (id.includes("-WI") || id.startsWith("WI-")) return "window";
  if (id.startsWith("O-") || /-O\d/.test(id)) return "opening";
  if (id.startsWith("R-") || /-R\d/.test(id)) return "room";
  if (id.startsWith("D-") || /-D\d/.test(id)) return "door";
  if (id.startsWith("W-") || /-W\d/.test(id)) return "wall";
  return null;
}
function classifyObject(obj) {
  if (!obj || !obj.id) return null;
  const k = objectKind(obj.id);
  if (k === "wall") return obj.type === "external" ? "wall_external" : "wall_internal";
  return k;
}
function iterAllObjects(data) {
  const out = [];
  for (const w of (data.walls || [])) out.push({ obj: w, kind: w.type === "external" ? "wall_external" : "wall_internal" });
  for (const r of (data.rooms || [])) out.push({ obj: r, kind: "room" });
  for (const o of (data.windows || [])) out.push({ obj: o, kind: "window" });
  for (const o of (data.doors || [])) out.push({ obj: o, kind: "door" });
  for (const o of (data.openings || [])) out.push({ obj: o, kind: "opening" });
  for (const o of (data.dimensions || [])) out.push({ obj: o, kind: "dimension" });
  for (const o of (data.notes || [])) out.push({ obj: o, kind: "note" });
  if (data.roof) {
    for (const s of (data.roof.segments || [])) out.push({ obj: s, kind: "segment" });
    for (const s of (data.roof.slopes   || [])) out.push({ obj: s, kind: "slope" });
    for (const a of (data.roof.aerators || [])) out.push({ obj: a, kind: "aerator" });
    for (const d of (data.roof.drains   || [])) out.push({ obj: d, kind: "drain" });
    for (const p of (data.roof.parapets || [])) out.push({ obj: p, kind: "parapet" });
    for (const j of (data.roof.junctions|| [])) out.push({ obj: j, kind: "junction" });
    for (const e of (data.roof.engouts  || [])) out.push({ obj: e, kind: "engout" });
  }
  return out;
}
function findObjectById(data, id) {
  for (const e of iterAllObjects(data)) if (e.obj.id === id) return e;
  return null;
}

Object.assign(window, {
  plWallAxisBounds: wallAxisBounds,
  plClampOpeningOnWall: clampOpeningOnWall,
  plClassifyObject: classifyObject,
  plObjectKind: objectKind,
  plIterAllObjects: iterAllObjects,
  plFindObjectById: findObjectById,
});

// ============================================================
// ROOF-mode helpers — summary, builders, grouped warnings
// ============================================================

// Aggregate metrics for the roof dashboard (single source of truth).
function getRoofSummary(data) {
  const r = data.roof || {};
  const contour = r.contour || [];
  const area = contour.length >= 3 ? polygonArea(contour) : 0;
  const perimeter = contour.length >= 3 ? polygonPerimeter(contour) : 0;
  const parapets = r.parapets || [];
  const junctions = r.junctions || [];
  const parapetLen = parapets.length
    ? parapets.reduce((s, p) => s + (p.length != null ? p.length : Math.hypot(p.x2 - p.x1, p.y2 - p.y1)), 0)
    : perimeter;
  const junctionLen = junctions.reduce((s, j) => s + (j.length != null ? j.length : Math.hypot(j.x2 - j.x1, j.y2 - j.y1)), 0);
  const segments = r.segments || [];
  const aerators = r.aerators || [];
  const drains = r.drains || [];
  const engouts = r.engouts || [];
  const slopes = r.slopes || [];
  const segByStatus = {};
  for (const s of segments) {
    const st = s.status || "Не обследовано";
    segByStatus[st] = (segByStatus[st] || 0) + 1;
  }
  return {
    area, perimeter,
    contourPts: contour.length,
    parapetLen,
    junctionLen,
    segmentsCount: segments.length,
    aeratorsCount: aerators.length,
    drainsCount: drains.length,
    engoutsCount: engouts.length,
    slopesCount: slopes.length,
    segByStatus,
    material: r.material || "—",
    slope: r.slope != null ? r.slope : null,
    parapetHeight: r.parapetHeight != null ? r.parapetHeight : null,
  };
}

// Build a clean rectangular roof contour at given size.
// Returns the contour points and optionally a parapet-by-contour ring.
function makeRectRoofContour(w, h, opts = {}) {
  const padX = opts.padX != null ? opts.padX : 4;
  const padY = opts.padY != null ? opts.padY : 4;
  const x0 = padX, y0 = padY, x1 = padX + w, y1 = padY + h;
  return [
    { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
  ];
}

// Build parapets along a closed contour.
function buildParapetsFromContour(contour, stamp, opts = {}) {
  if (!contour || contour.length < 3) return [];
  const parapets = [];
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i], b = contour[(i + 1) % contour.length];
    parapets.push({
      id: `PRP-${stamp}-${i}`, type: "parapet",
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      length: Math.hypot(b.x - a.x, b.y - a.y),
      height: opts.height != null ? opts.height : 0.5,
      material: opts.material || "Парапет металлический",
      nodeType: "стандарт",
      includeInEstimate: true,
      layerId: "L-parapets",
    });
  }
  return parapets;
}

// Demo industrial roof — a polished, aesthetic 40×50 m roof with
// 4 segments, aerator grid, 10 drains, slopes, parapet, junctions, engouts.
// Designed for an instant "wow" demo: not chaotic, technical-looking.
function makeDemoIndustrialRoof(stamp = Date.now()) {
  const W = 40, H = 50, x0 = 8, y0 = 5;
  const contour = [
    { x: x0,     y: y0     },
    { x: x0 + W, y: y0     },
    { x: x0 + W, y: y0 + H },
    { x: x0,     y: y0 + H },
  ];
  // Aerators — 5 cols × 4 rows, evenly spaced
  const aerators = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      aerators.push({
        id: `AER-${stamp}-${r}-${c}`,
        x: x0 + 4 + c * 8,
        y: y0 + 7 + r * 12,
        aeratorType: "Wirplast K-3",
        diameter: 110,
        zone: `Зона ${r + 1}`,
        status: "Запланирован",
        includeInEstimate: true,
        layerId: "L-aerators",
      });
    }
  }
  // Drains — 10 along edges, 3 per long side + 2 mid edge
  const drains = [
    { x: x0 + 5,      y: y0 + 4 }, { x: x0 + 20, y: y0 + 4 }, { x: x0 + 35, y: y0 + 4 },
    { x: x0 + 5,      y: y0 + H - 4 }, { x: x0 + 20, y: y0 + H - 4 }, { x: x0 + 35, y: y0 + H - 4 },
    { x: x0 + 4,      y: y0 + 18 }, { x: x0 + W - 4, y: y0 + 18 },
    { x: x0 + 4,      y: y0 + 36 }, { x: x0 + W - 4, y: y0 + 36 },
  ].map((p, i) => ({
    id: `DRN-${stamp}-${i}`, x: p.x, y: p.y,
    drainType: "HL62.1 с обогревом", diameter: 110, capacity: 4.5,
    zone: `Сектор ${i + 1}`,
    status: "Запланирован",
    includeInEstimate: true, layerId: "L-drains",
  }));
  // Segments — 4 sections, with statuses + materials
  const segDef = [
    { x: x0,         y: y0,         w: W / 2, h: H / 2, name: "Секция A · северо-запад", status: "Требует ремонта", material: "ПВХ-мембрана Logicroof 1.5мм" },
    { x: x0 + W / 2, y: y0,         w: W / 2, h: H / 2, name: "Секция B · северо-восток", status: "Не обследовано", material: "ПВХ-мембрана Logicroof 1.5мм" },
    { x: x0,         y: y0 + H / 2, w: W / 2, h: H / 2, name: "Секция C · юго-запад",     status: "В работе",        material: "ТПО-мембрана Sintofoil RM" },
    { x: x0 + W / 2, y: y0 + H / 2, w: W / 2, h: H / 2, name: "Секция D · юго-восток",   status: "Готово",          material: "ПВХ-мембрана Logicroof 1.5мм" },
  ];
  const segments = segDef.map((s, i) => ({
    id: `SEG-${stamp}-${i}`,
    layerId: "L-segments",
    ...s,
    area: s.w * s.h,
    slope: 1.5,
    comment: "",
    includeInEstimate: true,
  }));
  // Slopes — 4 from interior peak to nearest edge drains
  const slopes = [
    { x1: x0 + W / 2 - 4, y1: y0 + 12, x2: x0 + 5,      y2: y0 + 4,       label: "1.5%" },
    { x1: x0 + W / 2 + 4, y1: y0 + 12, x2: x0 + W - 4,  y2: y0 + 4,       label: "1.5%" },
    { x1: x0 + W / 2 - 4, y1: y0 + H - 12, x2: x0 + 5,  y2: y0 + H - 4,   label: "1.5%" },
    { x1: x0 + W / 2 + 4, y1: y0 + H - 12, x2: x0 + W - 4, y2: y0 + H - 4,label: "1.5%" },
  ].map((s, i) => ({
    id: `SLP-${stamp}-${i}`, layerId: "L-slopes",
    percent: 1.5, ...s,
  }));
  // Parapet along contour
  const parapets = buildParapetsFromContour(contour, stamp, { height: 0.6 });
  // Junctions — 3 to walls / shaft
  const junctions = [
    { x1: x0 + 8,   y1: y0 + 25, x2: x0 + 12,  y2: y0 + 25, junctionType: "к шахте" },
    { x1: x0 + 28,  y1: y0 + 14, x2: x0 + 30,  y2: y0 + 14, junctionType: "к трубе" },
    { x1: x0 + 22,  y1: y0 + 40, x2: x0 + 28,  y2: y0 + 40, junctionType: "к стене" },
  ].map((j, i) => ({
    id: `JCT-${stamp}-${i}`, type: "junction",
    x1: j.x1, y1: j.y1, x2: j.x2, y2: j.y2,
    length: Math.hypot(j.x2 - j.x1, j.y2 - j.y1),
    junctionType: j.junctionType, height: 0.3,
    material: "Узел примыкания", comment: "", includeInEstimate: true,
    layerId: "L-junctions",
  }));
  // Engineering outlets — vent shaft + pipes + roof exit
  const engouts = [
    { x: x0 + 10, y: y0 + 25, engoutType: "Вентиляционная шахта", width: 2.4, height: 2.4 },
    { x: x0 + 29, y: y0 + 14, engoutType: "Труба",                width: 0.6, height: 0.6 },
    { x: x0 + 25, y: y0 + 40, engoutType: "Выход на кровлю",      width: 1.2, height: 1.2 },
  ].map((e, i) => ({
    id: `EGO-${stamp}-${i}`, layerId: "L-engouts",
    x: e.x, y: e.y, engoutType: e.engoutType,
    width: e.width, height: e.height,
    comment: "", includeInEstimate: true,
    status: "Запланирован",
  }));
  return {
    contour,
    parapetHeight: 0.6,
    slope: 1.5,
    material: "ПВХ-мембрана Logicroof 1.5мм",
    aerators, drains, slopes, segments, parapets, junctions, engouts,
  };
}

// Group warnings by topic for the "Проверить кровлю" panel.
function groupRoofWarnings(warnings) {
  const groups = {
    "Контур":         [],
    "Водоотвод":      [],
    "Уклоны":         [],
    "Элементы":       [],
    "Сметные данные": [],
  };
  for (const w of warnings) {
    const t = (w.text || "").toLowerCase();
    if (w.id === "roof-empty" || w.id === "roof-open" || t.includes("контур")) groups["Контур"].push(w);
    else if (t.includes("воронк") || t.includes("парапет")) groups["Водоотвод"].push(w);
    else if (t.includes("уклон")) groups["Уклоны"].push(w);
    else if (t.includes("материал") || t.includes("смет")) groups["Сметные данные"].push(w);
    else groups["Элементы"].push(w);
  }
  return groups;
}

// Overall roof status verdict for the dashboard
function getRoofStatus(warnings, area) {
  if (area < 1) return { code: "empty", label: "Недостаточно данных", tone: "info" };
  const hasError = warnings.some(w => w.level === "error");
  const hasWarn  = warnings.some(w => w.level === "warn");
  if (hasError) return { code: "error", label: "Есть критические ошибки", tone: "error" };
  if (hasWarn)  return { code: "warn", label: "Есть замечания", tone: "warn" };
  return { code: "ok", label: "Готово к черновому расчёту", tone: "ok" };
}

Object.assign(window, {
  plGetRoofSummary: getRoofSummary,
  plMakeRectRoofContour: makeRectRoofContour,
  plBuildParapetsFromContour: buildParapetsFromContour,
  plMakeDemoIndustrialRoof: makeDemoIndustrialRoof,
  plGroupRoofWarnings: groupRoofWarnings,
  plGetRoofStatus: getRoofStatus,
});

// ============================================================
// SCENARIO builders — produce a tpl-shaped object that can be
// passed to instantiateTemplate. Used by Quick Start wizard.
// ============================================================

// Helper: build window onIdx list from explicit ranges
function _winRanges(wallIdx, ranges) { return ranges.map(([a, b]) => ({ onIdx: wallIdx, a, b })); }

// House rectangle — simple, clean 1-floor layout for sizes 8×10…14×16.
// Generates 4 ext walls + 1-2 internal walls + 2-4 rooms + windows/doors.
function buildHouseRectTpl(w, h, opts = {}) {
  const padX = Math.max(3, (24 - w) / 2);
  const padY = Math.max(3, (16 - h) / 2);
  const x0 = padX, y0 = padY, x1 = x0 + w, y1 = y0 + h;
  const cx = x0 + Math.round(w * 100 / 2) / 100;
  const cy = y0 + Math.round(h * 100 / 2) / 100;
  const splitX = w >= 9 ? cx : null;
  const splitY = h >= 7 ? cy : null;
  const walls = [
    { type: "external", x1: x0, y1: y0, x2: x1, y2: y0 }, // 0 top
    { type: "external", x1: x1, y1: y0, x2: x1, y2: y1 }, // 1 right
    { type: "external", x1: x0, y1: y1, x2: x1, y2: y1 }, // 2 bottom
    { type: "external", x1: x0, y1: y0, x2: x0, y2: y1 }, // 3 left
  ];
  if (splitX != null) walls.push({ type: "internal", x1: splitX, y1: y0, x2: splitX, y2: y1 });
  if (splitY != null) walls.push({ type: "internal", x1: x0, y1: splitY, x2: x1, y2: splitY });
  // Windows: even count along top + bottom; 1-2 on sides
  const winCnt = w >= 12 ? 2 : 1;
  const winW = 1.5;
  const winSep = w / (winCnt + 1);
  const windows = [];
  for (let i = 1; i <= winCnt; i++) {
    const a = x0 + winSep * i - winW / 2, b = a + winW;
    windows.push({ onIdx: 0, a, b });
  }
  windows.push({ onIdx: 1, a: y0 + h / 2 - winW / 2, b: y0 + h / 2 + winW / 2 });
  windows.push({ onIdx: 3, a: y0 + h / 2 - winW / 2, b: y0 + h / 2 + winW / 2 });
  // Front door on bottom wall
  const doorA = x0 + w / 2 - 0.5;
  const doors = [{ onIdx: 2, a: doorA, b: doorA + 1.0, swing: "in", front: true }];
  if (splitX != null) doors.push({ onIdx: 4, a: cy - 0.45, b: cy + 0.45, swing: "in" });
  // Rooms
  const rooms = [];
  if (splitX != null && splitY != null) {
    rooms.push({ name: "Кухня",    x: x0, y: y0, w: splitX - x0, h: splitY - y0, color: ROOM_COLORS[1] });
    rooms.push({ name: "Гостиная", x: splitX, y: y0, w: x1 - splitX, h: splitY - y0, color: ROOM_COLORS[2] });
    rooms.push({ name: "Спальня",  x: x0, y: splitY, w: splitX - x0, h: y1 - splitY, color: ROOM_COLORS[0] });
    rooms.push({ name: "Санузел",  x: splitX, y: splitY, w: x1 - splitX, h: y1 - splitY, color: ROOM_COLORS[3] });
  } else if (splitX != null) {
    rooms.push({ name: "Жилая зона", x: x0,     y: y0, w: splitX - x0, h: y1 - y0, color: ROOM_COLORS[2] });
    rooms.push({ name: "Спальня",    x: splitX, y: y0, w: x1 - splitX, h: y1 - y0, color: ROOM_COLORS[0] });
  } else {
    rooms.push({ name: "Помещение", x: x0, y: y0, w: w, h: h, color: ROOM_COLORS[2] });
  }
  const world = { w: Math.max(24, x1 + padX + 2), h: Math.max(16, y1 + padY + 2) };
  return {
    id: `scn-house-${w}x${h}-${Date.now()}`,
    name: `Дом ${w}×${h}`,
    category: "Сценарий",
    area: w * h, rooms: rooms.length,
    world,
    levels: [{ id: "L-1", name: "1 этаж", type: "floor", world, walls, windows, doors, rooms }],
  };
}

// House + garage scenario — house with attached garage to the east.
function buildHouseGarageTpl(hw, hh, gw, gh, opts = {}) {
  const padX = 3, padY = 3;
  // House box
  const x0 = padX, y0 = padY, x1 = x0 + hw, y1 = y0 + hh;
  const houseWalls = [
    { type: "external", x1: x0, y1: y0, x2: x1, y2: y0 },
    { type: "external", x1: x1, y1: y0, x2: x1, y2: y1 },
    { type: "external", x1: x0, y1: y1, x2: x1, y2: y1 },
    { type: "external", x1: x0, y1: y0, x2: x0, y2: y1 },
    { type: "internal", x1: x0 + hw / 2, y1: y0, x2: x0 + hw / 2, y2: y1 },
  ];
  const houseWindows = [
    { onIdx: 0, a: x0 + 1.5, b: x0 + 3.5 },
    { onIdx: 0, a: x0 + hw - 3.5, b: x0 + hw - 1.5 },
    { onIdx: 3, a: y0 + hh / 2 - 0.75, b: y0 + hh / 2 + 0.75 },
  ];
  const houseDoors = [
    { onIdx: 2, a: x0 + hw / 2 - 0.5, b: x0 + hw / 2 + 0.5, swing: "in", front: true },
    { onIdx: 4, a: y0 + hh / 2 - 0.45, b: y0 + hh / 2 + 0.45, swing: "in" },
  ];
  const houseRooms = [
    { name: "Гостиная-кухня", x: x0, y: y0, w: hw / 2, h: hh, color: ROOM_COLORS[2] },
    { name: "Спальня · санузел", x: x0 + hw / 2, y: y0, w: hw / 2, h: hh, color: ROOM_COLORS[0] },
  ];
  // Garage: attached east, slightly inset vertically (centered on house)
  const gx0 = x1 + 1.5;
  const gy0 = y0 + Math.max(0, (hh - gh) / 2);
  const gx1 = gx0 + gw, gy1 = gy0 + gh;
  const garageWalls = [
    { type: "external", x1: gx0, y1: gy0, x2: gx1, y2: gy0 },
    { type: "external", x1: gx1, y1: gy0, x2: gx1, y2: gy1 },
    { type: "external", x1: gx0, y1: gy1, x2: gx1, y2: gy1 },
    { type: "external", x1: gx0, y1: gy0, x2: gx0, y2: gy1 },
  ];
  const gateA = gx0 + 0.5, gateB = Math.min(gx1 - 0.5, gateA + 3.0);
  const garageDoors = [
    { onIdx: 2, a: gateA, b: gateB, swing: "in", front: true, gate: true },
  ];
  const garageRooms = [{ name: "Гараж", x: gx0, y: gy0, w: gw, h: gh, color: ROOM_COLORS[5], roomType: "Гараж" }];
  const world = { w: Math.max(30, gx1 + padX + 2), h: Math.max(16, Math.max(y1, gy1) + padY + 2) };
  return {
    id: `scn-house-garage-${Date.now()}`,
    name: `Дом ${hw}×${hh} + Гараж ${gw}×${gh}`,
    category: "Сценарий",
    area: hw * hh + gw * gh, rooms: 3,
    world,
    levels: [
      { id: "L-1", name: "1 этаж", type: "floor", world, walls: houseWalls, windows: houseWindows, doors: houseDoors, rooms: houseRooms },
      { id: "L-G", name: "Гараж", type: "garage", world, walls: garageWalls, windows: [], doors: garageDoors, rooms: garageRooms },
    ],
  };
}

// Two-floor house — same footprint for both floors
function buildTwoFloorTpl(w, h, opts = {}) {
  const base = buildHouseRectTpl(w, h, opts);
  const lvl1 = base.levels[0];
  // Floor 2: copy ext walls, simpler interior
  const x0 = lvl1.walls[0].x1, y0 = lvl1.walls[0].y1;
  const x1 = lvl1.walls[1].x1, y1 = lvl1.walls[1].y2;
  const cy = (y0 + y1) / 2;
  const f2Walls = [
    { type: "external", x1: x0, y1: y0, x2: x1, y2: y0 },
    { type: "external", x1: x1, y1: y0, x2: x1, y2: y1 },
    { type: "external", x1: x0, y1: y1, x2: x1, y2: y1 },
    { type: "external", x1: x0, y1: y0, x2: x0, y2: y1 },
    { type: "internal", x1: x0, y1: cy, x2: x1, y2: cy },
  ];
  const f2Windows = [
    { onIdx: 0, a: x0 + 2, b: x0 + 3.5 },
    { onIdx: 0, a: x1 - 3.5, b: x1 - 2 },
    { onIdx: 2, a: x0 + 2, b: x0 + 3.5 },
    { onIdx: 2, a: x1 - 3.5, b: x1 - 2 },
  ];
  const f2Doors = [{ onIdx: 4, a: x0 + (x1 - x0) / 2 - 0.45, b: x0 + (x1 - x0) / 2 + 0.45, swing: "in" }];
  const f2Rooms = [
    { name: "Спальня 1", x: x0, y: y0, w: x1 - x0, h: cy - y0, color: ROOM_COLORS[0] },
    { name: "Спальня 2 · санузел", x: x0, y: cy, w: x1 - x0, h: y1 - cy, color: ROOM_COLORS[4] },
  ];
  return {
    ...base,
    id: `scn-2floor-${w}x${h}-${Date.now()}`,
    name: `Дом 2 этажа ${w}×${h}`,
    levels: [
      lvl1,
      { id: "L-2", name: "2 этаж", type: "floor", world: lvl1.world, walls: f2Walls, windows: f2Windows, doors: f2Doors, rooms: f2Rooms },
    ],
    area: 2 * w * h,
    rooms: 4,
  };
}

// Warehouse / industrial shell — large rectangle, gates, maybe office strip
function buildWarehouseTpl(w, h, opts = {}) {
  const padX = 4, padY = 4;
  const x0 = padX, y0 = padY, x1 = x0 + w, y1 = y0 + h;
  const walls = [
    { type: "external", x1: x0, y1: y0, x2: x1, y2: y0 },
    { type: "external", x1: x1, y1: y0, x2: x1, y2: y1 },
    { type: "external", x1: x0, y1: y1, x2: x1, y2: y1 },
    { type: "external", x1: x0, y1: y0, x2: x0, y2: y1 },
  ];
  // Office strip on east if width allows
  let officeIdx = null;
  if (w >= 25) {
    walls.push({ type: "internal", x1: x1 - 8, y1: y0, x2: x1 - 8, y2: y1 });
    officeIdx = walls.length - 1;
  }
  // Gates on top + bottom (loading bays)
  const gateW = Math.min(4, Math.max(2.5, w / 8));
  const cx = (x0 + (officeIdx != null ? x1 - 8 : x1)) / 2;
  const doors = [
    { onIdx: 0, a: cx - gateW / 2, b: cx + gateW / 2, swing: "in", front: true, gate: true },
    { onIdx: 2, a: cx - gateW / 2, b: cx + gateW / 2, swing: "in", front: true, gate: true },
  ];
  if (officeIdx != null) {
    doors.push({ onIdx: 1, a: y0 + h / 2 - 0.45, b: y0 + h / 2 + 0.45, swing: "in" });
  }
  const windows = officeIdx != null ? [
    { onIdx: 1, a: y0 + 2, b: y0 + 4 },
    { onIdx: 1, a: y0 + h - 4, b: y0 + h - 2 },
  ] : [];
  const rooms = officeIdx != null
    ? [
        { name: `Цех · ${((w - 8) * h).toFixed(0)} м²`, x: x0, y: y0, w: w - 8, h: h, color: ROOM_COLORS[3] },
        { name: `Офис · ${(8 * h).toFixed(0)} м²`, x: x1 - 8, y: y0, w: 8, h: h, color: ROOM_COLORS[5] },
      ]
    : [{ name: `Помещение · ${(w * h).toFixed(0)} м²`, x: x0, y: y0, w, h, color: ROOM_COLORS[3] }];
  const world = { w: Math.max(60, x1 + padX + 4), h: Math.max(40, y1 + padY + 4) };
  return {
    id: `scn-warehouse-${w}x${h}-${Date.now()}`,
    name: `Склад ${w}×${h}`,
    category: "Сценарий",
    area: w * h, rooms: rooms.length, world,
    levels: [{ id: "L-1", name: "Цех", type: "floor", world, walls, windows, doors, rooms }],
  };
}

// Industrial roof rectangle scenario
function buildIndustrialRoofRectTpl(w, h, opts = {}) {
  const padX = 6, padY = 6;
  const contour = [
    { x: padX, y: padY },
    { x: padX + w, y: padY },
    { x: padX + w, y: padY + h },
    { x: padX, y: padY + h },
  ];
  const world = { w: Math.max(60, padX * 2 + w + 2), h: Math.max(40, padY * 2 + h + 2) };
  return {
    id: `scn-iroof-${w}x${h}-${Date.now()}`,
    name: `Промышленная кровля ${w}×${h}`,
    category: "Сценарий",
    area: w * h, rooms: 1, world,
    levels: [{
      id: "L-IR", name: "Пром. кровля", type: "industrial_roof", world,
      walls: [], windows: [], doors: [], rooms: [],
      roof: {
        contour, parapetHeight: 0.5, slope: 1.5,
        material: "ПВХ-мембрана Logicroof 1.5мм",
        aerators: [], drains: [], slopes: [], segments: [], parapets: [], junctions: [], engouts: [],
      },
    }],
  };
}

// Demo industrial roof — uses makeDemoIndustrialRoof, packaged as scenario
function buildDemoIndustrialRoofTpl() {
  const stamp = Date.now();
  const roof = makeDemoIndustrialRoof(stamp);
  return {
    id: `scn-demo-iroof-${stamp}`,
    name: "Демо: Пром. кровля 2000 м²",
    category: "Демо",
    area: 2000, rooms: 1, world: { w: 60, h: 70 },
    levels: [{ id: "L-IR", name: "Пром. кровля", type: "industrial_roof", world: { w: 60, h: 70 },
      walls: [], windows: [], doors: [], rooms: [], roof,
    }],
  };
}

// ===== "Create roof from house bounds" =====
// Build a fresh roof level using the external bounds of an existing floor.
function buildRoofLevelFromBounds(bounds, overhang = 0.5, opts = {}) {
  const o = overhang;
  const contour = [
    { x: bounds.x - o,             y: bounds.y - o },
    { x: bounds.x + bounds.w + o,  y: bounds.y - o },
    { x: bounds.x + bounds.w + o,  y: bounds.y + bounds.h + o },
    { x: bounds.x - o,             y: bounds.y + bounds.h + o },
  ];
  const stamp = opts.stamp || Date.now();
  const parapets = opts.withParapet === false ? [] : buildParapetsFromContour(contour, stamp, { height: 0.5 });
  return {
    id: opts.levelId || `L-R-${stamp}`,
    name: opts.name || "Кровля",
    type: "roof",
    world: opts.world,
    walls: [], windows: [], doors: [], openings: [],
    rooms: [], dimensions: [], notes: [],
    layers: defaultLayersForType("roof"),
    roof: {
      contour, parapetHeight: 0.5, slope: 1.5,
      material: "Битумно-полимерная мембрана Техноэласт 2-сл.",
      aerators: [], drains: [], slopes: [], segments: [],
      parapets, junctions: [], engouts: [],
    },
  };
}

// External wall bounding box for a floor data level (excluding decorations)
function getExternalBounds(data) {
  const ext = (data?.walls || []).filter(w => w.type === "external");
  if (ext.length === 0) {
    // Fallback to rooms
    const rms = data?.rooms || [];
    if (rms.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of rms) {
      if (r.x < minX) minX = r.x;
      if (r.y < minY) minY = r.y;
      if (r.x + r.w > maxX) maxX = r.x + r.w;
      if (r.y + r.h > maxY) maxY = r.y + r.h;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  const xs = ext.flatMap(w => [w.x1, w.x2]);
  const ys = ext.flatMap(w => [w.y1, w.y2]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

Object.assign(window, {
  plBuildHouseRectTpl: buildHouseRectTpl,
  plBuildHouseGarageTpl: buildHouseGarageTpl,
  plBuildTwoFloorTpl: buildTwoFloorTpl,
  plBuildWarehouseTpl: buildWarehouseTpl,
  plBuildIndustrialRoofRectTpl: buildIndustrialRoofRectTpl,
  plBuildDemoIndustrialRoofTpl: buildDemoIndustrialRoofTpl,
  plBuildRoofLevelFromBounds: buildRoofLevelFromBounds,
  plGetExternalBounds: getExternalBounds,
});

// ============================================================
// Quick-start SCENARIO catalog — used by the Quick Start wizard
// ============================================================
const SCENARIOS = [
  {
    id: "house",
    label: "Дом ИЖС",
    icon: "House",
    summary: "1 этаж · стены · окна · двери",
    presets: [
      { id: "h-8x10",  label: "8 × 10",  hint: "80 м²",   build: () => buildHouseRectTpl(8, 10) },
      { id: "h-10x12", label: "10 × 12", hint: "120 м²",  build: () => buildHouseRectTpl(10, 12) },
      { id: "h-12x15", label: "12 × 15", hint: "180 м²",  build: () => buildHouseRectTpl(12, 15) },
      { id: "h-custom", label: "Свой размер", custom: true, build: (o) => buildHouseRectTpl(o.w || 10, o.h || 12) },
    ],
  },
  {
    id: "house_garage",
    label: "Дом + Гараж",
    icon: "Building",
    summary: "Жилой дом и пристроенный гараж",
    presets: [
      { id: "hg-1", label: "10×12 + 6×4", hint: "144 м²", build: () => buildHouseGarageTpl(10, 12, 6, 4) },
      { id: "hg-2", label: "12×15 + 6×6", hint: "216 м²", build: () => buildHouseGarageTpl(12, 15, 6, 6) },
      { id: "hg-custom", label: "Свой размер", custom: true, build: (o) => buildHouseGarageTpl(o.w || 10, o.h || 12, o.gw || 6, o.gh || 4) },
    ],
  },
  {
    id: "two_floor",
    label: "2 этажа",
    icon: "Building",
    summary: "Дом с двумя этажами и подложкой",
    presets: [
      { id: "tf-1", label: "10 × 12", hint: "240 м²", build: () => buildTwoFloorTpl(10, 12) },
      { id: "tf-2", label: "12 × 15", hint: "360 м²", build: () => buildTwoFloorTpl(12, 15) },
      { id: "tf-custom", label: "Свой размер", custom: true, build: (o) => buildTwoFloorTpl(o.w || 10, o.h || 12) },
    ],
  },
  {
    id: "warehouse",
    label: "Склад / Цех",
    icon: "Building",
    summary: "Большая прямоугольная конструкция · ворота",
    presets: [
      { id: "w-20x30", label: "20 × 30",  hint: "600 м²",  build: () => buildWarehouseTpl(20, 30) },
      { id: "w-30x60", label: "30 × 60",  hint: "1 800 м²",build: () => buildWarehouseTpl(30, 60) },
      { id: "w-40x80", label: "40 × 80",  hint: "3 200 м²",build: () => buildWarehouseTpl(40, 80) },
      { id: "w-custom", label: "Свой размер", custom: true, build: (o) => buildWarehouseTpl(o.w || 30, o.h || 60) },
    ],
  },
  {
    id: "ind_roof",
    label: "Промышленная кровля",
    icon: "House",
    summary: "Плоская кровля 500–3000 м² для расчёта",
    presets: [
      { id: "ir-20x25", label: "20 × 25",  hint: "500 м²",  build: () => buildIndustrialRoofRectTpl(20, 25) },
      { id: "ir-30x40", label: "30 × 40",  hint: "1 200 м²",build: () => buildIndustrialRoofRectTpl(30, 40) },
      { id: "ir-40x50", label: "40 × 50",  hint: "2 000 м²",build: () => buildIndustrialRoofRectTpl(40, 50) },
      { id: "ir-50x60", label: "50 × 60",  hint: "3 000 м²",build: () => buildIndustrialRoofRectTpl(50, 60) },
      { id: "ir-demo",  label: "Демо-кровля", hint: "Сегменты · воронки · аэраторы", build: () => buildDemoIndustrialRoofTpl(), badge: "Демо" },
    ],
  },
  {
    id: "import_drawing",
    label: "Загрузить чертёж",
    icon: "Upload",
    summary: "PNG/JPG · масштаб по отрезку · обводка поверх",
    presets: [
      { id: "im-pick",   label: "Выбрать файл…",  hint: "PNG / JPG / WebP",     build: null, fileImport: true },
      { id: "im-demo",   label: "Демо-подложка",   hint: "План 12×9 м",         build: null, demoBackground: true, badge: "Демо" },
    ],
  },
  {
    id: "empty",
    label: "Пустой проект",
    icon: "Folder",
    summary: "Начать с чистого холста",
    presets: [
      { id: "e", label: "Пустой", hint: "Холст 24×16", build: null }, // sentinel — handled in apply
    ],
  },
];

// Demo scenarios — curated showcase set
const DEMO_SCENARIOS = [
  { id: "d-house",   label: "Дом ИЖС 120 м²",         build: () => buildHouseRectTpl(10, 12),   hint: "5 комнат · окна · двери", scenarioTip: "house" },
  { id: "d-hg",      label: "Дом + Гараж",            build: () => buildHouseGarageTpl(10, 12, 6, 4), hint: "Гараж учитывается отдельно", scenarioTip: "house_garage" },
  { id: "d-2f",      label: "2-этажный дом 10×12",    build: () => buildTwoFloorTpl(10, 12),    hint: "Два уровня, подложка", scenarioTip: "two_floor" },
  { id: "d-wh",      label: "Склад 30×60",            build: () => buildWarehouseTpl(30, 60),   hint: "Цех + офис · ворота", scenarioTip: "warehouse" },
  { id: "d-iroof",   label: "Промышленная кровля 2000 м²", build: () => buildDemoIndustrialRoofTpl(), hint: "Сегменты · воронки · уклоны · парапет", scenarioTip: "ind_roof" },
  { id: "d-trace",   label: "Обводка по подложке",    build: null, demoBackground: true, hint: "План на скане → калибровка → обводка стен", scenarioTip: "import_drawing" },
  { id: "d-pdf",     label: "PDF-проект → AI-предобводка", build: null, demoPdf: true, hint: "Листы · кандидаты стен/комнат → конвертация", scenarioTip: "pdf_takeoff", badge: "AI" },
];

Object.assign(window, {
  PL_SCENARIOS: SCENARIOS,
  PL_DEMO_SCENARIOS: DEMO_SCENARIOS,
});

// ============================================================
// BACKGROUND / UNDERLAY helpers
// ============================================================

// Build a background object from a loaded image. Sizes it so the image
// occupies ~12 meters of world width by default — this gives a sensible
// starting point on a default 24×16 world before calibration.
function buildBackground({ name, src, imgWidth, imgHeight, defaultWorldWidth = 12, viewCenter, opacity = 0.6, locked = true, visible = true }) {
  const ar = imgHeight && imgWidth ? imgHeight / imgWidth : 1;
  const width = defaultWorldWidth;
  const height = defaultWorldWidth * ar;
  const cx = viewCenter ? viewCenter.x : 8;
  const cy = viewCenter ? viewCenter.y : 6;
  return {
    id: `BG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: name || "Подложка",
    type: "image",
    src,
    x: cx - width / 2,
    y: cy - height / 2,
    width, height, rotation: 0,
    naturalWidth: imgWidth || 0,
    naturalHeight: imgHeight || 0,
    opacity, locked, visible,
    scaleCalibrated: false,
    pixelsPerMeter: imgWidth ? imgWidth / width : null,
    calibrationLine: null,
    layerId: "L-bgs",
    createdAt: Date.now(),
  };
}

// Apply calibration to a background — anchor scale around the first
// calibration point so the image content stays under the line.
function calibrateBackground(bg, p1, p2, realLengthMeters) {
  const measured = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (measured < 1e-6 || realLengthMeters <= 0) return bg;
  const k = realLengthMeters / measured;
  const dx = p1.x - bg.x;
  const dy = p1.y - bg.y;
  const newX = p1.x - dx * k;
  const newY = p1.y - dy * k;
  const newWidth  = bg.width  * k;
  const newHeight = bg.height * k;
  // Scale p2 too (anchored at p1) so the visible line tracks the image.
  const newP2x = p1.x + (p2.x - p1.x) * k;
  const newP2y = p1.y + (p2.y - p1.y) * k;
  return {
    ...bg,
    x: newX, y: newY,
    width: newWidth, height: newHeight,
    scaleCalibrated: true,
    pixelsPerMeter: bg.naturalWidth ? bg.naturalWidth / newWidth : null,
    calibrationLine: {
      x1: p1.x, y1: p1.y,
      x2: newP2x, y2: newP2y,
      realLength: realLengthMeters,
      measuredLength: measured * k, // equals realLength now
    },
  };
}

// Return bounds union of all backgrounds + roof/floor objects for fit
function getBackgroundsBounds(backgrounds) {
  if (!backgrounds || !backgrounds.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of backgrounds) {
    if (!b.visible) continue;
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width  > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// Background-specific validation
function getBackgroundsWarnings(backgrounds, otherObjectsCount = 0) {
  const warns = [];
  for (const bg of (backgrounds || [])) {
    if (!bg.visible) warns.push({ id: `bg-hidden-${bg.id}`, level: "info", text: `Подложка «${bg.name}» скрыта`, targetId: bg.id });
    if (!bg.scaleCalibrated) warns.push({ id: `bg-noscale-${bg.id}`, level: "warn", text: `Подложка «${bg.name}» — масштаб не задан`, targetId: bg.id });
    if (bg.visible && !bg.locked) warns.push({ id: `bg-unlocked-${bg.id}`, level: "info", text: `Подложка «${bg.name}» разблокирована — может сдвинуться при обводке`, targetId: bg.id });
    if (bg.width < 0.5 || bg.height < 0.5) warns.push({ id: `bg-small-${bg.id}`, level: "warn", text: `Подложка «${bg.name}» слишком мала`, targetId: bg.id });
    if (bg.width > 500 || bg.height > 500) warns.push({ id: `bg-big-${bg.id}`, level: "warn", text: `Подложка «${bg.name}» слишком велика`, targetId: bg.id });
  }
  if ((backgrounds || []).length > 0 && otherObjectsCount === 0) {
    warns.push({ id: "bg-no-trace", level: "info", text: "Есть подложка, но нет обведённых объектов — начните с инструмента Стена / Контур" });
  }
  return warns;
}

// Tiny embedded demo background — a soft floorplan-like SVG dataURL,
// used by Demo Mode "Обводка по подложке".
function makeDemoBackgroundSrc() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 480" width="600" height="480">
    <rect width="600" height="480" fill="#FAF8F4"/>
    <g stroke="#94A3B8" stroke-width="1" fill="none" opacity="0.35">
      <path d="M0 60H600M0 120H600M0 180H600M0 240H600M0 300H600M0 360H600M0 420H600"/>
      <path d="M60 0V480M120 0V480M180 0V480M240 0V480M300 0V480M360 0V480M420 0V480M480 0V480M540 0V480"/>
    </g>
    <g stroke="#0B1220" stroke-width="6" fill="none">
      <rect x="60" y="60" width="480" height="360"/>
      <line x1="300" y1="60" x2="300" y2="420"/>
      <line x1="60" y1="240" x2="300" y2="240"/>
      <line x1="300" y1="180" x2="540" y2="180"/>
      <line x1="420" y1="180" x2="420" y2="420"/>
    </g>
    <g stroke="#0B1220" stroke-width="3" fill="#FAF8F4">
      <rect x="140" y="56" width="60" height="8"/>
      <rect x="380" y="56" width="60" height="8"/>
      <rect x="296" y="320" width="8" height="60"/>
      <rect x="56" y="140" width="8" height="60"/>
    </g>
    <g fill="#94A3B8" font-family="sans-serif" font-size="20">
      <text x="170" y="160">Гостиная</text>
      <text x="170" y="340">Кухня</text>
      <text x="338" y="130">Спальня</text>
      <text x="450" y="320">С/у</text>
      <text x="240" y="450" font-size="14" fill="#475569">План дома · 12 × 9 м (масштаб известен)</text>
    </g>
    <g stroke="#DC2626" stroke-width="2" stroke-dasharray="6 4">
      <line x1="60" y1="440" x2="540" y2="440"/>
      <polygon points="60,440 70,436 70,444" fill="#DC2626"/>
      <polygon points="540,440 530,436 530,444" fill="#DC2626"/>
    </g>
    <text x="290" y="436" font-family="sans-serif" font-size="14" fill="#DC2626" font-weight="600">12.0 м</text>
  </svg>`;
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
}

Object.assign(window, {
  plBuildBackground: buildBackground,
  plCalibrateBackground: calibrateBackground,
  plGetBackgroundsBounds: getBackgroundsBounds,
  plGetBackgroundsWarnings: getBackgroundsWarnings,
  plMakeDemoBackgroundSrc: makeDemoBackgroundSrc,
});

// ============================================================
// PRICE CATALOG — mock demo prices, used by getEstimateDraft
// ============================================================
const PRICE_CATALOG = [
  // Walls / openings
  { id: "P-wall-ext",   name: "Внешняя стена · кирпич 380мм",            unit: "м²",   defaultPrice: 4800, category: "Стены",         source: "Демо-прайс · июнь 2026", updatedAt: "2026-05-12" },
  { id: "P-wall-int",   name: "Перегородка · газобетон 100мм",          unit: "м²",   defaultPrice: 1900, category: "Стены",         source: "Демо-прайс · июнь 2026", updatedAt: "2026-05-12" },
  { id: "P-window",     name: "Окно ПВХ 2-камерное",                     unit: "шт",   defaultPrice: 14500, category: "Окна и двери", source: "Демо-прайс · июнь 2026", updatedAt: "2026-04-30" },
  { id: "P-door-int",   name: "Дверь межкомнатная",                       unit: "шт",   defaultPrice: 11200, category: "Окна и двери", source: "Демо-прайс · июнь 2026", updatedAt: "2026-04-30" },
  { id: "P-door-ext",   name: "Дверь входная · металл",                   unit: "шт",   defaultPrice: 38000, category: "Окна и двери", source: "Демо-прайс · июнь 2026", updatedAt: "2026-04-30" },
  { id: "P-gate",       name: "Ворота секционные",                        unit: "шт",   defaultPrice: 78000, category: "Окна и двери", source: "Демо-прайс · июнь 2026", updatedAt: "2026-04-30" },
  // Roof
  { id: "P-roof-pvc",   name: "ПВХ-мембрана Logicroof 1.5мм",            unit: "м²",   defaultPrice: 940,  category: "Кровля",        source: "Демо-прайс · июнь 2026", updatedAt: "2026-05-20" },
  { id: "P-roof-tpo",   name: "ТПО-мембрана Sintofoil RM",                unit: "м²",   defaultPrice: 1080, category: "Кровля",        source: "Демо-прайс · июнь 2026", updatedAt: "2026-05-20" },
  { id: "P-roof-bit",   name: "Битумно-полимерная Техноэласт 2сл.",       unit: "м²",   defaultPrice: 720,  category: "Кровля",        source: "Демо-прайс · июнь 2026", updatedAt: "2026-05-20" },
  { id: "P-insulation", name: "Утеплитель кровельный PIR 100мм",         unit: "м²",   defaultPrice: 1250, category: "Кровля",        source: "Демо-прайс · июнь 2026", updatedAt: "2026-05-20" },
  { id: "P-parapet",    name: "Парапет металлический",                    unit: "м.п.", defaultPrice: 1450, category: "Кровля",        source: "Демо-прайс · июнь 2026", updatedAt: "2026-05-20" },
  { id: "P-junction",   name: "Узел примыкания",                          unit: "м.п.", defaultPrice: 980,  category: "Кровля",        source: "Демо-прайс · июнь 2026", updatedAt: "2026-05-20" },
  { id: "P-drain",      name: "Кровельная воронка HL62.1 с обогревом",   unit: "шт",   defaultPrice: 6800, category: "Кровля",        source: "Демо-прайс · июнь 2026", updatedAt: "2026-05-20" },
  { id: "P-aerator",    name: "Аэратор кровельный Wirplast K-3",          unit: "шт",   defaultPrice: 2300, category: "Кровля",        source: "Демо-прайс · июнь 2026", updatedAt: "2026-05-20" },
  { id: "P-engout",     name: "Инженерный выход · узел",                  unit: "шт",   defaultPrice: 5300, category: "Кровля",        source: "Демо-прайс · июнь 2026", updatedAt: "2026-05-20" },
  // Floors / zones
  { id: "P-floor",      name: "Чистовой пол · стяжка + покрытие",         unit: "м²",   defaultPrice: 1850, category: "Полы",          source: "Демо-прайс · июнь 2026", updatedAt: "2026-04-15" },
  { id: "P-floor-ind",  name: "Промышленный пол · топпинг",              unit: "м²",   defaultPrice: 2100, category: "Полы",          source: "Демо-прайс · июнь 2026", updatedAt: "2026-04-15" },
];

function getPriceById(id) { return PRICE_CATALOG.find(p => p.id === id) || null; }

// ============================================================
// LocalStorage helpers — generated estimates + proposals
// ============================================================
const STORAGE_GEN_ESTIMATES = "stroika.generated.estimates";
const STORAGE_GEN_PROPOSALS = "stroika.generated.proposals";

function loadGeneratedEstimates() {
  try { return JSON.parse(localStorage.getItem(STORAGE_GEN_ESTIMATES) || "[]"); }
  catch { return []; }
}
function loadGeneratedProposals() {
  try { return JSON.parse(localStorage.getItem(STORAGE_GEN_PROPOSALS) || "[]"); }
  catch { return []; }
}
function saveGeneratedEstimate(est) {
  const list = loadGeneratedEstimates();
  const i = list.findIndex(x => x.id === est.id);
  if (i >= 0) list[i] = est; else list.unshift(est);
  try { localStorage.setItem(STORAGE_GEN_ESTIMATES, JSON.stringify(list.slice(0, 50))); } catch {}
  return list;
}
function saveGeneratedProposal(kp) {
  const list = loadGeneratedProposals();
  const i = list.findIndex(x => x.id === kp.id);
  if (i >= 0) list[i] = kp; else list.unshift(kp);
  try { localStorage.setItem(STORAGE_GEN_PROPOSALS, JSON.stringify(list.slice(0, 50))); } catch {}
  return list;
}
function deleteGeneratedEstimate(id) {
  const list = loadGeneratedEstimates().filter(x => x.id !== id);
  try { localStorage.setItem(STORAGE_GEN_ESTIMATES, JSON.stringify(list)); } catch {}
  return list;
}
function deleteGeneratedProposal(id) {
  const list = loadGeneratedProposals().filter(x => x.id !== id);
  try { localStorage.setItem(STORAGE_GEN_PROPOSALS, JSON.stringify(list)); } catch {}
  return list;
}

// ============================================================
// PROJECT-LEVEL helpers for result center
// ============================================================
function getProjectEstimateRows(project) {
  const out = [];
  for (const lvl of project.levels) {
    const d = project.levelsData[lvl.id]; if (!d) continue;
    const rows = getEstimateDraft(d, lvl.type) || [];
    for (const r of rows) {
      out.push({ ...r, id: `${lvl.id}-${r.id}`, levelName: lvl.name, levelId: lvl.id, levelType: lvl.type });
    }
  }
  return out;
}
function getProjectStats(project) {
  let totalArea = 0, totalRoofArea = 0, totalWalls = 0, totalWindows = 0, totalDoors = 0, totalGates = 0, totalWarnings = 0;
  const byLevel = project.levels.map(l => {
    const d = project.levelsData[l.id] || {};
    const isRoof = l.type === "roof" || l.type === "industrial_roof";
    let area = 0;
    if (isRoof) {
      const c = d.roof?.contour || [];
      area = c.length >= 3 ? polygonArea(c) : 0;
      totalRoofArea += area;
    } else {
      area = (d.rooms || []).reduce((s, r) => s + r.w * r.h, 0);
      totalArea += area;
      totalWalls += (d.walls || []).filter(w => w.type === "external").reduce((s, w) => s + wallLen(w), 0);
      totalWindows += (d.windows || []).length;
      const allDoors = (d.doors || []);
      totalDoors += allDoors.filter(x => !x.gate).length;
      totalGates += allDoors.filter(x => x.gate).length;
    }
    const w = getValidationWarnings(d, l.type);
    totalWarnings += w.length;
    const rows = getEstimateDraft(d, l.type) || [];
    const total = rows.reduce((s, r) => s + (r.include !== false ? r.total : 0), 0);
    return { id: l.id, name: l.name, type: l.type, area, warnings: w.length, items: rows.length, total };
  });
  const grandTotal = byLevel.reduce((s, r) => s + r.total, 0);
  return { byLevel, totalArea, totalRoofArea, totalWalls, totalWindows, totalDoors, totalGates, totalWarnings, grandTotal };
}

// Status flow — derived from warnings + proposal/export markers
function getProjectStatus({ hasWarnings, hasErrors, calculated, hasProposal, exported }) {
  if (exported) return { code: "exported", label: "Экспортировано", tone: "success" };
  if (hasProposal) return { code: "proposed", label: "КП сформировано", tone: "primary" };
  if (calculated) {
    if (hasErrors) return { code: "review", label: "Требует проверки", tone: "warn" };
    if (hasWarnings) return { code: "review", label: "Требует проверки", tone: "warn" };
    return { code: "ready", label: "Готово к КП", tone: "success" };
  }
  return { code: "draft", label: "Черновик", tone: "neutral" };
}

Object.assign(window, {
  PL_PRICE_CATALOG: PRICE_CATALOG,
  plGetPriceById: getPriceById,
  plLoadGeneratedEstimates: loadGeneratedEstimates,
  plLoadGeneratedProposals: loadGeneratedProposals,
  plSaveGeneratedEstimate: saveGeneratedEstimate,
  plSaveGeneratedProposal: saveGeneratedProposal,
  plDeleteGeneratedEstimate: deleteGeneratedEstimate,
  plDeleteGeneratedProposal: deleteGeneratedProposal,
  plGetProjectEstimateRows: getProjectEstimateRows,
  plGetProjectStats: getProjectStats,
  plGetProjectStatus: getProjectStatus,
});

// ============================================================
// PDF ANALYSIS DEMO — mock-данные для UX-прототипа модуля
// «AI/vector PDF-предобработка чертежа»
// ============================================================
const PDF_SHEET_TYPES = {
  plan:     { label: "План",         color: "#2563EB" },
  montage:  { label: "Монтаж",       color: "#7C3AED" },
  spec:     { label: "Спецификация", color: "#0891B2" },
  list:     { label: "Ведомость",    color: "#0F766E" },
  section:  { label: "Разрез",       color: "#9A3412" },
  visual:   { label: "Визуализация", color: "#A16207" },
  general:  { label: "Общие данные", color: "#4A5365" },
};

function buildPdfAnalysisDemo() {
  const sheets = [
    { num: 1,  title: "Общие данные",                    type: "general", confidence: 0.99, tags: [] },
    { num: 2,  title: "Обмерочный чертёж",               type: "plan",    confidence: 0.96, tags: ["traceable", "dims"] },
    { num: 4,  title: "План квартиры до перепланировки", type: "plan",    confidence: 0.94, tags: ["traceable", "dims"] },
    { num: 6,  title: "Монтажный план по конструкциям",  type: "montage", confidence: 0.91, tags: ["traceable", "tables"] },
    { num: 7,  title: "Монтажный план по отделке",       type: "montage", confidence: 0.86, tags: ["traceable"] },
    { num: 12, title: "План сантехнического оборудования", type: "plan",  confidence: 0.82, tags: ["tables"] },
    { num: 16, title: "План электрики",                   type: "plan",  confidence: 0.74, tags: ["tables"] },
    { num: 27, title: "План напольных покрытий",          type: "plan",  confidence: 0.88, tags: ["tables"] },
    { num: 28, title: "План дверных проёмов",             type: "spec",  confidence: 0.93, tags: ["tables", "dims"] },
    { num: 38, title: "Ведомость материалов",             type: "list",  confidence: 0.97, tags: ["tables"] },
  ];

  const tables = {
    rooms: {
      title: "Экспликация помещений",
      sheet: 4,
      columns: ["Помещение", "Площадь, м²", "Тип"],
      rows: [
        ["Прихожая / коридор",   "14.4",  "Нежилое"],
        ["Санузел",              "3.3",   "Сан. узел"],
        ["Нежилое помещение",    "3.7",   "Гардероб"],
        ["Кухня",                "12.5",  "Кухня"],
        ["Жилая комната 1",      "12.3",  "Жилая"],
        ["Жилая комната 2",      "16.8",  "Жилая"],
        ["ИТОГО",                "63.0",  ""],
      ],
    },
    partitions: {
      title: "Спецификация перегородок",
      sheet: 6,
      columns: ["Материал / тип", "Толщина, мм", "Площадь, м²"],
      rows: [
        ["Газобетонные блоки",                        "100",  "53.14"],
        ["Газобетонные блоки",                        "200",  "3.39"],
        ["Газобетонные блоки",                        "250",  "2.16"],
        ["ВГКЛ / ГКЛ по металлическому каркасу",     "75",   "18.42"],
        ["ВГКЛ / ГКЛ по металлическому каркасу",     "100",  "9.10"],
        ["Штукатурка цементно-известковая",          "—",    "120.96"],
      ],
    },
    doors: {
      title: "Дверные проёмы",
      sheet: 28,
      columns: ["Тип", "Размер проёма", "Размер полотна", "Кол-во"],
      rows: [
        ["Входная",     "900 × 2070", "—",          "1"],
        ["Межкомнатная","800 × 2070", "700 × 2000", "3"],
        ["Межкомнатная","900 × 2070", "800 × 2000", "2"],
        ["Санузел",     "700 × 2070", "650 × 2000", "1"],
      ],
    },
    materials: {
      title: "Ведомость материалов · фрагмент",
      sheet: 38,
      columns: ["Раздел", "Позиция", "Ед.", "Кол-во"],
      rows: [
        ["Перегородки", "Газобетон D500 100 мм",         "м²",  "53.14"],
        ["Полы",        "Плитка керамогранит 600×600",   "м²",  "21.20"],
        ["Полы",        "Ламинат 33 кл.",                "м²",  "41.80"],
        ["Гидроизоляция","Обмазочная гидроизоляция",     "м²",  "12.80"],
        ["Сантехника",  "Точка водоснабжения",           "шт",  "8"],
        ["Сантехника",  "Точка канализации",             "шт",  "5"],
        ["Отделка",     "Штукатурка стен",               "м²",  "120.96"],
      ],
    },
    plumbing: {
      title: "Сантехнические точки",
      sheet: 12,
      columns: ["Тип", "Локация", "Размер"],
      rows: [
        ["Унитаз",   "Санузел",      "—"],
        ["Раковина", "Санузел",      "60 см"],
        ["Душ",      "Санузел",      "90×90"],
        ["Мойка",    "Кухня",        "60 см"],
        ["Стиральная","Санузел",     "60×60"],
      ],
    },
  };

  // Candidate geometry — designed for a 12×7m flat-style layout that drops
  // into the viewport. Coordinates are in meters, world-space relative to (1, 1).
  const x0 = 1, y0 = 1, W = 12, H = 7;
  const cWalls = [
    // External shell
    { id: "C-W-1", kind: "wall", type: "external", x1: x0,       y1: y0,       x2: x0 + W,   y2: y0,       sourceSheet: 4, sourceLabel: "Обмерочный чертёж",  confidence: 0.96, layerId: "L-candidates", status: "new" },
    { id: "C-W-2", kind: "wall", type: "external", x1: x0 + W,   y1: y0,       x2: x0 + W,   y2: y0 + H,   sourceSheet: 4, sourceLabel: "Обмерочный чертёж",  confidence: 0.96, layerId: "L-candidates", status: "new" },
    { id: "C-W-3", kind: "wall", type: "external", x1: x0,       y1: y0 + H,   x2: x0 + W,   y2: y0 + H,   sourceSheet: 4, sourceLabel: "Обмерочный чертёж",  confidence: 0.96, layerId: "L-candidates", status: "new" },
    { id: "C-W-4", kind: "wall", type: "external", x1: x0,       y1: y0,       x2: x0,       y2: y0 + H,   sourceSheet: 4, sourceLabel: "Обмерочный чертёж",  confidence: 0.96, layerId: "L-candidates", status: "new" },
    // Internal partitions
    { id: "C-W-5", kind: "wall", type: "internal", x1: x0 + 4,   y1: y0,       x2: x0 + 4,   y2: y0 + 4,   sourceSheet: 6, sourceLabel: "Монтажный план",      confidence: 0.91, layerId: "L-candidates", status: "new" },
    { id: "C-W-6", kind: "wall", type: "internal", x1: x0,       y1: y0 + 4,   x2: x0 + 8,   y2: y0 + 4,   sourceSheet: 6, sourceLabel: "Монтажный план",      confidence: 0.88, layerId: "L-candidates", status: "new" },
    { id: "C-W-7", kind: "wall", type: "internal", x1: x0 + 8,   y1: y0 + 4,   x2: x0 + 8,   y2: y0 + H,   sourceSheet: 6, sourceLabel: "Монтажный план",      confidence: 0.86, layerId: "L-candidates", status: "new" },
    { id: "C-W-8", kind: "wall", type: "internal", x1: x0 + 8,   y1: y0 + 2.5, x2: x0 + W,   y2: y0 + 2.5, sourceSheet: 6, sourceLabel: "Монтажный план",      confidence: 0.72, layerId: "L-candidates", status: "new" },
  ];
  // openings reference candidate walls by id but use world coordinates
  const cOpenings = [
    { id: "C-O-1", kind: "window", x1: x0 + 1,   y1: y0,       x2: x0 + 2.4, y2: y0,       sourceSheet: 4, confidence: 0.92, layerId: "L-candidates", status: "new", w: 1.4 },
    { id: "C-O-2", kind: "window", x1: x0 + 5.6, y1: y0,       x2: x0 + 7,   y2: y0,       sourceSheet: 4, confidence: 0.90, layerId: "L-candidates", status: "new", w: 1.4 },
    { id: "C-O-3", kind: "window", x1: x0 + 9,   y1: y0,       x2: x0 + 10.5,y2: y0,       sourceSheet: 4, confidence: 0.88, layerId: "L-candidates", status: "new", w: 1.5 },
    { id: "C-O-4", kind: "door",   x1: x0 + 5.4, y1: y0 + H,   x2: x0 + 6.3, y2: y0 + H,   sourceSheet: 28, confidence: 0.95, layerId: "L-candidates", status: "new", w: 0.9, swing: "in", front: true },
    { id: "C-O-5", kind: "door",   x1: x0 + 4,   y1: y0 + 2,   x2: x0 + 4,   y2: y0 + 2.8, sourceSheet: 28, confidence: 0.83, layerId: "L-candidates", status: "new", w: 0.8 },
    { id: "C-O-6", kind: "door",   x1: x0,       y1: y0 + 4,   x2: x0,       y2: y0 + 4.7, sourceSheet: 28, confidence: 0.79, layerId: "L-candidates", status: "new", w: 0.7 },
  ];
  const cRooms = [
    { id: "C-R-1", kind: "room", name: "Прихожая / коридор", x: x0,     y: y0 + 4, w: 4,    h: 3,    color: ROOM_COLORS[3], sourceSheet: 4, confidence: 0.94, layerId: "L-candidates", status: "new" },
    { id: "C-R-2", kind: "room", name: "Санузел",            x: x0,     y: y0,     w: 4,    h: 4,    color: ROOM_COLORS[4], sourceSheet: 4, confidence: 0.96, layerId: "L-candidates", status: "new" },
    { id: "C-R-3", kind: "room", name: "Кухня",              x: x0 + 4, y: y0,     w: 4,    h: 4,    color: ROOM_COLORS[1], sourceSheet: 4, confidence: 0.92, layerId: "L-candidates", status: "new" },
    { id: "C-R-4", kind: "room", name: "Жилая комната 1",    x: x0 + 4, y: y0 + 4, w: 4,    h: 3,    color: ROOM_COLORS[0], sourceSheet: 4, confidence: 0.90, layerId: "L-candidates", status: "new" },
    { id: "C-R-5", kind: "room", name: "Жилая комната 2",    x: x0 + 8, y: y0,     w: 4,    h: 2.5,  color: ROOM_COLORS[2], sourceSheet: 4, confidence: 0.88, layerId: "L-candidates", status: "new" },
    { id: "C-R-6", kind: "room", name: "Нежилое",            x: x0 + 8, y: y0 + 2.5, w: 4,  h: 4.5,  color: ROOM_COLORS[5], sourceSheet: 4, confidence: 0.74, layerId: "L-candidates", status: "new" },
  ];
  const cAnnotations = [
    { id: "C-A-1", kind: "note", x: x0 + 0.4, y: y0 + 7.3, text: "Спец. перегородок · с.6", color: "#7C3AED", sourceSheet: 6, confidence: 0.86, layerId: "L-candidates", status: "new" },
    { id: "C-A-2", kind: "plumb", x: x0 + 1.5, y: y0 + 1.5, label: "Раковина", sourceSheet: 12, confidence: 0.78, layerId: "L-candidates", status: "new" },
    { id: "C-A-3", kind: "plumb", x: x0 + 2.6, y: y0 + 2.8, label: "Унитаз",   sourceSheet: 12, confidence: 0.82, layerId: "L-candidates", status: "new" },
    { id: "C-A-4", kind: "plumb", x: x0 + 0.6, y: y0 + 3,   label: "Душ",      sourceSheet: 12, confidence: 0.76, layerId: "L-candidates", status: "new" },
    { id: "C-A-5", kind: "plumb", x: x0 + 5,   y: y0 + 0.7, label: "Мойка",    sourceSheet: 12, confidence: 0.80, layerId: "L-candidates", status: "new" },
  ];

  // Estimate rows that the PDF analysis would suggest, w/ "source: PDF"
  const estimateRows = [
    { id: "PDF-est-walls-ext",  group: "Стены · из PDF",      name: "Внешние стены · кирпич 380мм",         qty: 38,    unit: "м²",   mat: 4800, work: 2200, total: 38 * 7000, source: "PDF · с. 4", include: true },
    { id: "PDF-est-walls-gas100", group: "Перегородки · из PDF", name: "Газобетон D500 100 мм",            qty: 53.14, unit: "м²",   mat: 1900, work: 950,  total: 53.14 * 2850, source: "PDF · с. 6", include: true },
    { id: "PDF-est-walls-gkl",  group: "Перегородки · из PDF", name: "ГКЛ по металлическому каркасу 75мм",  qty: 18.42, unit: "м²",   mat: 1600, work: 800,  total: 18.42 * 2400, source: "PDF · с. 6", include: true },
    { id: "PDF-est-rooms",      group: "Помещения · из PDF",  name: "Чистовой пол · 6 помещений",           qty: 63,    unit: "м²",   mat: 1850, work: 600,  total: 63 * 2450,    source: "PDF · с. 4", include: true },
    { id: "PDF-est-doors",      group: "Двери · из PDF",      name: "Дверь межкомнатная",                    qty: 6,     unit: "шт",   mat: 11200, work: 1800, total: 6 * 13000,    source: "PDF · с. 28", include: true },
    { id: "PDF-est-doors-ext",  group: "Двери · из PDF",      name: "Дверь входная · металл",                qty: 1,     unit: "шт",   mat: 38000, work: 3500, total: 41500,        source: "PDF · с. 28", include: true },
    { id: "PDF-est-plumb",      group: "Сантехника · из PDF", name: "Точка водоснабжения",                   qty: 8,     unit: "шт",   mat: 1200, work: 1800, total: 8 * 3000,     source: "PDF · с. 12", include: true },
    { id: "PDF-est-plumb-canal",group: "Сантехника · из PDF", name: "Точка канализации",                     qty: 5,     unit: "шт",   mat: 800,  work: 2200, total: 5 * 3000,     source: "PDF · с. 12", include: true },
    { id: "PDF-est-finish",     group: "Отделка · из PDF",    name: "Штукатурка стен",                       qty: 120.96, unit: "м²",  mat: 380,  work: 520,  total: 120.96 * 900, source: "PDF · с. 38", include: true },
  ];

  return {
    fileName: "Проект-перепланировки.pdf",
    pages: 38,
    fileSize: "12.4 МБ",
    overallConfidence: 0.84,
    sheets, tables,
    candidates: { walls: cWalls, openings: cOpenings, rooms: cRooms, annotations: cAnnotations },
    estimateRows,
  };
}

// Convert all 'new' or 'accepted' candidates into real objects on the active level
function commitCandidatesToLevel(currentData, candidates) {
  const stamp = Date.now();
  const newWalls = [];
  const newWindows = [];
  const newDoors = [];
  const newRooms = [];
  const newNotes = [];

  // Walls
  (candidates.walls || []).filter(c => c.status === "new" || c.status === "accepted").forEach((c, i) => {
    newWalls.push({
      id: `W-PDF-${stamp}-${i}`,
      type: c.type,
      x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2,
      layerId: c.type === "external" ? "L-walls-ext" : "L-walls-int",
      sourceLabel: c.sourceLabel || `PDF · с.${c.sourceSheet}`,
      sourceKind: "pdf",
    });
  });

  // Openings — assign to nearest wall (use first matching)
  function findHostWall(p1, p2, walls) {
    for (let idx = 0; idx < walls.length; idx++) {
      const w = walls[idx];
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
      const len = Math.hypot(dx, dy);
      if (len < 0.01) continue;
      // distance from p1 to line
      const cross1 = Math.abs((dy * p1.x - dx * p1.y + w.x2 * w.y1 - w.y2 * w.x1) / len);
      const cross2 = Math.abs((dy * p2.x - dx * p2.y + w.x2 * w.y1 - w.y2 * w.x1) / len);
      if (cross1 < 0.3 && cross2 < 0.3) {
        // check if within bounds
        const isHoriz = Math.abs(dy) < 0.05;
        if (isHoriz) {
          const minX = Math.min(w.x1, w.x2), maxX = Math.max(w.x1, w.x2);
          const px1 = Math.min(p1.x, p2.x), px2 = Math.max(p1.x, p2.x);
          if (px1 >= minX - 0.1 && px2 <= maxX + 0.1) return idx;
        } else {
          const minY = Math.min(w.y1, w.y2), maxY = Math.max(w.y1, w.y2);
          const py1 = Math.min(p1.y, p2.y), py2 = Math.max(p1.y, p2.y);
          if (py1 >= minY - 0.1 && py2 <= maxY + 0.1) return idx;
        }
      }
    }
    return null;
  }

  (candidates.openings || []).filter(c => c.status === "new" || c.status === "accepted").forEach((c, i) => {
    const idx = findHostWall({ x: c.x1, y: c.y1 }, { x: c.x2, y: c.y2 }, newWalls);
    if (idx == null) return;
    const w = newWalls[idx];
    const isHoriz = Math.abs(w.y2 - w.y1) < 0.05;
    const aRaw = isHoriz ? Math.min(c.x1, c.x2) : Math.min(c.y1, c.y2);
    const bRaw = isHoriz ? Math.max(c.x1, c.x2) : Math.max(c.y1, c.y2);
    const obj = { onIdx: idx, a: aRaw, b: bRaw, layerId: "L-openings", sourceLabel: `PDF · с.${c.sourceSheet}`, sourceKind: "pdf" };
    if (c.kind === "window") {
      newWindows.push({ id: `WIN-PDF-${stamp}-${i}`, ...obj });
    } else {
      newDoors.push({ id: `DR-PDF-${stamp}-${i}`, ...obj, swing: c.swing || "in", front: !!c.front });
    }
  });

  // Rooms
  (candidates.rooms || []).filter(c => c.status === "new" || c.status === "accepted").forEach((c, i) => {
    newRooms.push({ id: `R-PDF-${stamp}-${i}`, name: c.name, x: c.x, y: c.y, w: c.w, h: c.h, color: c.color, layerId: "L-rooms", sourceLabel: `PDF · с.${c.sourceSheet}`, sourceKind: "pdf" });
  });

  // Plumb annotations → notes
  (candidates.annotations || []).filter(c => c.status === "new" || c.status === "accepted").forEach((c, i) => {
    if (c.kind === "plumb") {
      newNotes.push({ id: `N-PDF-${stamp}-${i}`, x: c.x, y: c.y, text: c.label, color: "#0891B2", layerId: "L-notes", sourceLabel: `PDF · с.${c.sourceSheet}`, sourceKind: "pdf" });
    } else if (c.kind === "note") {
      newNotes.push({ id: `N-PDF-${stamp}-${i}`, x: c.x, y: c.y, text: c.text, color: c.color || "#B45309", layerId: "L-notes", sourceLabel: `PDF · с.${c.sourceSheet}`, sourceKind: "pdf" });
    }
  });

  return {
    walls: [...(currentData.walls || []), ...newWalls],
    windows: [...(currentData.windows || []), ...newWindows],
    doors: [...(currentData.doors || []), ...newDoors],
    rooms: [...(currentData.rooms || []), ...newRooms],
    notes: [...(currentData.notes || []), ...newNotes],
    counts: { walls: newWalls.length, windows: newWindows.length, doors: newDoors.length, rooms: newRooms.length, notes: newNotes.length },
  };
}

// Empty candidates object — used to initialize state
function emptyCandidates() {
  return { walls: [], openings: [], rooms: [], annotations: [], meta: null };
}

Object.assign(window, {
  PDF_SHEET_TYPES,
  plBuildPdfAnalysisDemo: buildPdfAnalysisDemo,
  plCommitCandidatesToLevel: commitCandidatesToLevel,
  plEmptyCandidates: emptyCandidates,
});
