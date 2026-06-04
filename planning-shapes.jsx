/* global React, window */
// ============================================================
// Planning · SVG shape components (walls, openings, roof elements)
// All coordinates in METERS — SVG viewBox is meters.
// ============================================================

var wallIsH = window.plWallIsH;
var wallLen = window.plWallLen;
var polygonArea = window.plPolygonArea;
var polygonPerimeter = window.plPolygonPerimeter;

// ============================================================
// PlanGrid — adaptive grid with major/minor lines
// gridSize in meters. levelSize describes world extent (w,h).
// ============================================================
function PlanGrid({ gridSize, world, zoom }) {
  const minor = gridSize;
  const major = gridSize * 5;
  // At low zoom, hide minor lines to reduce noise
  const showMinor = zoom * window.PL_PX_PER_M * minor > 8;
  const showMajor = zoom * window.PL_PX_PER_M * major > 18;

  const minorStrokeW = 0.012 / zoom;
  const majorStrokeW = 0.025 / zoom;

  const lines = [];
  if (showMinor) {
    for (let x = 0; x <= world.w; x += minor) {
      const isMajor = Math.abs(x % major) < 0.001;
      if (!isMajor) lines.push(<line key={`mv${x}`} x1={x} y1={0} x2={x} y2={world.h} stroke="#E4E7EC" strokeWidth={minorStrokeW}/>);
    }
    for (let y = 0; y <= world.h; y += minor) {
      const isMajor = Math.abs(y % major) < 0.001;
      if (!isMajor) lines.push(<line key={`mh${y}`} x1={0} y1={y} x2={world.w} y2={y} stroke="#E4E7EC" strokeWidth={minorStrokeW}/>);
    }
  }
  if (showMajor) {
    for (let x = 0; x <= world.w; x += major) {
      lines.push(<line key={`Mv${x}`} x1={x} y1={0} x2={x} y2={world.h} stroke="#C7CCD6" strokeWidth={majorStrokeW}/>);
    }
    for (let y = 0; y <= world.h; y += major) {
      lines.push(<line key={`Mh${y}`} x1={0} y1={y} x2={world.w} y2={y} stroke="#C7CCD6" strokeWidth={majorStrokeW}/>);
    }
  }
  return <g>
    <rect x="0" y="0" width={world.w} height={world.h} fill="#FCFCFD"/>
    {lines}
  </g>;
}

// ============================================================
// Walls
// ============================================================
function WallShape({ wall, selected, onClick, disableSelect }) {
  const t = wall.type === "external" ? 0.36 : 0.16;
  const color = wall.type === "external" ? "var(--wall-external)" : "var(--wall-internal)";
  let rect;
  if (wallIsH(wall)) {
    rect = { x: Math.min(wall.x1, wall.x2) - t/2, y: wall.y1 - t/2, w: Math.abs(wall.x2 - wall.x1) + t, h: t };
  } else {
    rect = { x: wall.x1 - t/2, y: Math.min(wall.y1, wall.y2) - t/2, w: t, h: Math.abs(wall.y2 - wall.y1) + t };
  }
  return (
    <g onClick={(e) => { if (!disableSelect) { e.stopPropagation(); onClick(); } }} style={{ cursor: disableSelect ? "crosshair" : "pointer" }}>
      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={color}/>
      {selected && (
        <rect x={rect.x - 0.05} y={rect.y - 0.05} width={rect.w + 0.1} height={rect.h + 0.1}
          fill="none" stroke="var(--accent)" strokeWidth={0.08} strokeDasharray="0.2 0.1"/>
      )}
    </g>
  );
}

// ============================================================
// Windows
// ============================================================
function WindowShape({ wall, win, selected, onClick, disableSelect }) {
  const t = 0.36;
  let rect;
  if (wallIsH(wall)) {
    rect = { x: win.a, y: wall.y1 - t/2, w: win.b - win.a, h: t };
  } else {
    rect = { x: wall.x1 - t/2, y: win.a, w: t, h: win.b - win.a };
  }
  return (
    <g onClick={(e) => { if (!disableSelect) { e.stopPropagation(); onClick(); } }} style={{ cursor: disableSelect ? "crosshair" : "pointer" }}>
      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill="#FFFFFF"/>
      {wallIsH(wall) ? (
        <>
          <line x1={rect.x} y1={wall.y1 - 0.06} x2={rect.x + rect.w} y2={wall.y1 - 0.06} stroke="var(--window)" strokeWidth={0.04}/>
          <line x1={rect.x} y1={wall.y1} x2={rect.x + rect.w} y2={wall.y1} stroke="var(--window)" strokeWidth={0.06}/>
          <line x1={rect.x} y1={wall.y1 + 0.06} x2={rect.x + rect.w} y2={wall.y1 + 0.06} stroke="var(--window)" strokeWidth={0.04}/>
        </>
      ) : (
        <>
          <line x1={wall.x1 - 0.06} y1={rect.y} x2={wall.x1 - 0.06} y2={rect.y + rect.h} stroke="var(--window)" strokeWidth={0.04}/>
          <line x1={wall.x1} y1={rect.y} x2={wall.x1} y2={rect.y + rect.h} stroke="var(--window)" strokeWidth={0.06}/>
          <line x1={wall.x1 + 0.06} y1={rect.y} x2={wall.x1 + 0.06} y2={rect.y + rect.h} stroke="var(--window)" strokeWidth={0.04}/>
        </>
      )}
      {selected && (
        <rect x={rect.x - 0.1} y={rect.y - 0.1} width={rect.w + 0.2} height={rect.h + 0.2}
          fill="none" stroke="var(--accent)" strokeWidth={0.08} strokeDasharray="0.2 0.1"/>
      )}
    </g>
  );
}

// ============================================================
// Openings (gap in wall, no door)
// ============================================================
function OpeningShape({ wall, opening, selected, onClick, disableSelect }) {
  const t = wall.type === "external" ? 0.36 : 0.16;
  let gap, capA, capB;
  if (wallIsH(wall)) {
    gap = { x: opening.a, y: wall.y1 - t/2, w: opening.b - opening.a, h: t };
    capA = { x1: opening.a, y1: wall.y1 - t/2, x2: opening.a, y2: wall.y1 + t/2 };
    capB = { x1: opening.b, y1: wall.y1 - t/2, x2: opening.b, y2: wall.y1 + t/2 };
  } else {
    gap = { x: wall.x1 - t/2, y: opening.a, w: t, h: opening.b - opening.a };
    capA = { x1: wall.x1 - t/2, y1: opening.a, x2: wall.x1 + t/2, y2: opening.a };
    capB = { x1: wall.x1 - t/2, y1: opening.b, x2: wall.x1 + t/2, y2: opening.b };
  }
  return (
    <g onClick={(e) => { if (!disableSelect) { e.stopPropagation(); onClick(); } }} style={{ cursor: disableSelect ? "crosshair" : "pointer" }}>
      <rect x={gap.x} y={gap.y} width={gap.w} height={gap.h} fill="#FCFCFD"/>
      <line {...capA} stroke="var(--text-muted)" strokeWidth={0.05}/>
      <line {...capB} stroke="var(--text-muted)" strokeWidth={0.05}/>
      {selected && (
        <rect x={gap.x - 0.1} y={gap.y - 0.1} width={gap.w + 0.2} height={gap.h + 0.2}
          fill="none" stroke="var(--accent)" strokeWidth={0.08} strokeDasharray="0.2 0.1"/>
      )}
    </g>
  );
}

// ============================================================
// Doors (incl. gates)
// ============================================================
function DoorShape({ wall, door, selected, onClick, disableSelect }) {
  const t = wall.type === "external" ? 0.36 : 0.16;
  const doorW = door.b - door.a;
  let path = "", gap, hinge, leafPath;
  if (wallIsH(wall)) {
    gap = { x: door.a, y: wall.y1 - t/2, w: doorW, h: t };
    hinge = { x: door.a, y: wall.y1 };
    const dir = wall.y1 < 8 ? 1 : -1;
    path = `M ${door.a} ${wall.y1} L ${door.a + doorW} ${wall.y1} A ${doorW} ${doorW} 0 0 ${dir > 0 ? 1 : 0} ${door.a + doorW} ${wall.y1 + doorW * dir} L ${door.a} ${wall.y1 + doorW * dir}`;
    leafPath = `M ${door.a + doorW} ${wall.y1} L ${door.a + doorW} ${wall.y1 + doorW * dir}`;
  } else {
    gap = { x: wall.x1 - t/2, y: door.a, w: t, h: doorW };
    hinge = { x: wall.x1, y: door.a };
    const dir = wall.x1 < 10 ? 1 : -1;
    path = `M ${wall.x1} ${door.a} L ${wall.x1} ${door.a + doorW} A ${doorW} ${doorW} 0 0 ${dir > 0 ? 0 : 1} ${wall.x1 + doorW * dir} ${door.a + doorW} L ${wall.x1 + doorW * dir} ${door.a}`;
    leafPath = `M ${wall.x1} ${door.a + doorW} L ${wall.x1 + doorW * dir} ${door.a + doorW}`;
  }
  const color = door.gate ? "#7C2D12" : door.front ? "var(--accent)" : "var(--door)";
  return (
    <g onClick={(e) => { if (!disableSelect) { e.stopPropagation(); onClick(); } }} style={{ cursor: disableSelect ? "crosshair" : "pointer" }}>
      <rect x={gap.x} y={gap.y} width={gap.w} height={gap.h} fill="#FCFCFD"/>
      {door.gate && (
        <rect x={gap.x} y={gap.y} width={gap.w} height={gap.h} fill="none" stroke="#7C2D12" strokeWidth={0.06} strokeDasharray="0.2 0.15"/>
      )}
      <path d={path} fill="none" stroke={color} strokeWidth={door.gate ? 0.06 : door.front ? 0.06 : 0.04}/>
      <path d={leafPath} stroke={color} strokeWidth={door.gate ? 0.12 : door.front ? 0.1 : 0.07} strokeLinecap="round"/>
      {selected && <circle cx={hinge.x} cy={hinge.y} r={0.18} fill="none" stroke="var(--accent)" strokeWidth={0.08}/>}
    </g>
  );
}

// ============================================================
// Wall length labels (always shown for walls > 1.5m)
// ============================================================
function WallLengthLabel({ wall, alwaysShow }) {
  const len = wallLen(wall);
  if (!alwaysShow && len < 1.5) return null;
  const mx = (wall.x1 + wall.x2) / 2;
  const my = (wall.y1 + wall.y2) / 2;
  const isH = wallIsH(wall);
  const ext = wall.type === "external";
  let tx, ty, rot = 0;
  if (isH) {
    tx = mx;
    ty = ext ? (wall.y1 < 8 ? my - 0.5 : my + 0.7) : my - 0.25;
  } else {
    tx = ext ? (wall.x1 < 10 ? mx - 0.5 : mx + 0.7) : mx - 0.25;
    ty = my;
    rot = -90;
  }
  return (
    <g transform={`translate(${tx}, ${ty}) rotate(${rot})`} style={{ pointerEvents: "none" }}>
      <rect x={-0.55} y={-0.21} width={1.1} height={0.42} rx="0.08" fill="#fff" opacity={ext ? 0.95 : 0.92} stroke="var(--border)" strokeWidth={0.012}/>
      <text x="0" y="0.07" textAnchor="middle" fontSize="0.3" fontFamily="var(--font-mono)" fill="var(--text)" fontWeight="500">{len.toFixed(1)} м</text>
    </g>
  );
}

// ============================================================
// Room labels with name + area
// ============================================================
function RoomLabel({ room, lockedFloor }) {
  const cx = room.x + room.w / 2;
  const cy = room.y + room.h / 2;
  const area = (room.w * room.h).toFixed(1);
  const minDim = Math.min(room.w, room.h);
  return (
    <g style={{ pointerEvents: "none" }} opacity={lockedFloor ? 0.55 : 1}>
      <text x={cx} y={cy - 0.15} textAnchor="middle"
        fontSize={minDim >= 4 ? "0.6" : minDim >= 2.5 ? "0.45" : "0.32"}
        fontWeight="600" fontFamily="var(--font-display)" fill="var(--text)">
        {room.name}
      </text>
      <text x={cx} y={cy + 0.55} textAnchor="middle"
        fontSize={minDim >= 2.5 ? "0.38" : "0.28"}
        fontFamily="var(--font-mono)" fill="var(--text-muted)">
        {area} м²
      </text>
    </g>
  );
}

// ============================================================
// Auto dimension lines around building extent
// ============================================================
function DimensionLines({ walls }) {
  const externals = walls.filter(w => w.type === "external");
  if (externals.length === 0) return null;
  const xs = externals.flatMap(w => [w.x1, w.x2]);
  const ys = externals.flatMap(w => [w.y1, w.y2]);
  const x1 = Math.min(...xs), x2 = Math.max(...xs);
  const y1 = Math.min(...ys), y2 = Math.max(...ys);
  const y = y2 + 1.2, x = x2 + 1.2;
  return (
    <g style={{ pointerEvents: "none" }}>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="var(--text-muted)" strokeWidth={0.025}/>
      <line x1={x1} y1={y - 0.15} x2={x1} y2={y + 0.15} stroke="var(--text-muted)" strokeWidth={0.025}/>
      <line x1={x2} y1={y - 0.15} x2={x2} y2={y + 0.15} stroke="var(--text-muted)" strokeWidth={0.025}/>
      <text x={(x1 + x2) / 2} y={y + 0.5} textAnchor="middle" fontSize="0.36" fontWeight="600" fontFamily="var(--font-mono)" fill="var(--text-secondary)">
        {(x2 - x1).toFixed(2)} м
      </text>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke="var(--text-muted)" strokeWidth={0.025}/>
      <line x1={x - 0.15} y1={y1} x2={x + 0.15} y2={y1} stroke="var(--text-muted)" strokeWidth={0.025}/>
      <line x1={x - 0.15} y1={y2} x2={x + 0.15} y2={y2} stroke="var(--text-muted)" strokeWidth={0.025}/>
      <text x={x + 0.5} y={(y1 + y2) / 2} textAnchor="middle" fontSize="0.36" fontWeight="600" fontFamily="var(--font-mono)" fill="var(--text-secondary)" transform={`rotate(-90, ${x + 0.5}, ${(y1+y2)/2})`}>
        {(y2 - y1).toFixed(2)} м
      </text>
    </g>
  );
}

// ============================================================
// Compass
// ============================================================
function Compass({ x, y }) {
  return (
    <g transform={`translate(${x}, ${y})`} style={{ pointerEvents: "none" }}>
      <circle r="0.45" fill="#fff" stroke="var(--border-strong)" strokeWidth="0.04"/>
      <text x="0" y="-0.18" textAnchor="middle" fontSize="0.3" fill="var(--text)" fontWeight="600" fontFamily="var(--font-display)">С</text>
      <polygon points="0,-0.05 -0.08,0.15 0.08,0.15" fill="var(--accent)"/>
    </g>
  );
}

// ============================================================
// Empty state hint for canvas
// ============================================================
function EmptyCanvasHint({ mode, levelType, world }) {
  const cx = world.w / 2, cy = world.h / 2;
  const isRoof = levelType === "roof" || levelType === "industrial_roof";
  return (
    <g style={{ pointerEvents: "none" }}>
      <g transform={`translate(${cx}, ${cy})`} opacity={0.65}>
        <rect x={-5.2} y={-1.7} width={10.4} height={3.4} rx={0.25} fill="#fff" stroke="var(--border-strong)" strokeWidth={0.025} strokeDasharray="0.3 0.2"/>
        <text x={0} y={-0.4} textAnchor="middle" fontSize={0.55} fontWeight={600} fontFamily="var(--font-display)" fill="var(--text)">
          {isRoof ? "Кровля пуста — обведите контур" : "Холст пуст — начните рисовать"}
        </text>
        <text x={0} y={0.4} textAnchor="middle" fontSize={0.32} fill="var(--text-secondary)">
          {isRoof
            ? "Выберите «Контур кровли» и обведите границы"
            : "Зажмите мышь и потяните, чтобы провести стену"}
        </text>
        <text x={0} y={1.0} textAnchor="middle" fontSize={0.28} fill="var(--text-muted)">
          или используйте шаблон планировки
        </text>
      </g>
    </g>
  );
}

// ============================================================
// ROOF ELEMENTS
// ============================================================

// Roof contour — outline + faint fill
function RoofContour({ contour, selected, onClick }) {
  if (!contour || contour.length < 3) return null;
  const pts = contour.map(p => `${p.x},${p.y}`).join(" ");
  return (
    <g onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); }} style={{ cursor: "pointer" }}>
      <polygon points={pts} fill="rgba(124,58,237,0.04)" stroke="#0B1220" strokeWidth={0.12} strokeLinejoin="miter"/>
      {selected && (
        <polygon points={pts} fill="none" stroke="var(--accent)" strokeWidth={0.08} strokeDasharray="0.2 0.1"/>
      )}
    </g>
  );
}

// Roof segment fill with label
function RoofSegment({ segment, selected, onClick }) {
  const b = segment.bounds || ("w" in segment ? { x: segment.x, y: segment.y, w: segment.w, h: segment.h } : null);
  if (!b) return null;
  const status = segment.status || "Не обследовано";
  const statusFill = {
    "Готово":            "rgba(21,128,61,0.06)",
    "В работе":          "rgba(234,88,12,0.06)",
    "Требует ремонта":   "rgba(180,83,9,0.07)",
    "Исключить из сметы":"rgba(148,163,184,0.07)",
  }[status] || "rgba(124,58,237,0.03)";
  const statusStroke = {
    "Готово":            "rgba(21,128,61,0.45)",
    "В работе":          "rgba(234,88,12,0.45)",
    "Требует ремонта":   "rgba(180,83,9,0.55)",
    "Исключить из сметы":"rgba(148,163,184,0.4)",
  }[status] || "rgba(124,58,237,0.3)";
  const area = (b.w * b.h).toFixed(1);
  return (
    <g onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); }} style={{ cursor: "pointer" }}>
      <rect x={b.x} y={b.y} width={b.w} height={b.h}
        fill={selected ? "rgba(234,88,12,0.07)" : statusFill}
        stroke={selected ? "var(--accent)" : statusStroke}
        strokeWidth={selected ? 0.09 : 0.045}
        strokeDasharray="0.4 0.2"/>
      <g transform={`translate(${b.x + 0.4}, ${b.y + 0.7})`} style={{ pointerEvents: "none" }}>
        <text fontSize={0.4} fontWeight={600} fontFamily="var(--font-display)" fill="#4A5365">
          {segment.name || segment.id}
        </text>
        <text y={0.55} fontSize={0.32} fontFamily="var(--font-mono)" fill="var(--text-muted)">{area} м²</text>
      </g>
    </g>
  );
}

// Parapet line — drawn slightly inside the contour edge
function ParapetEdge({ contour }) {
  if (!contour || contour.length < 3) return null;
  const pts = [...contour, contour[0]];
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    segs.push(
      <line key={i} x1={pts[i].x} y1={pts[i].y} x2={pts[i+1].x} y2={pts[i+1].y}
        stroke="#7C2D12" strokeWidth={0.15} opacity={0.6}/>
    );
  }
  return <g style={{ pointerEvents: "none" }}>{segs}</g>;
}

// Aerator — circle with technical hatching
function AeratorShape({ aerator, selected, onClick }) {
  const r = 0.35;
  return (
    <g onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); }} style={{ cursor: "pointer" }}
       transform={`translate(${aerator.x}, ${aerator.y})`}>
      <circle r={r} fill="#fff" stroke="#1E3A8A" strokeWidth={0.05}/>
      <circle r={r * 0.55} fill="none" stroke="#1E3A8A" strokeWidth={0.04}/>
      {/* cross pattern */}
      <line x1={-r * 0.85} y1={0} x2={r * 0.85} y2={0} stroke="#1E3A8A" strokeWidth={0.04}/>
      <line x1={0} y1={-r * 0.85} x2={0} y2={r * 0.85} stroke="#1E3A8A" strokeWidth={0.04}/>
      {selected && <circle r={r + 0.15} fill="none" stroke="var(--accent)" strokeWidth={0.08} strokeDasharray="0.15 0.08"/>}
    </g>
  );
}

// Drain — concentric circles with funnel mark
function DrainShape({ drain, selected, onClick }) {
  const r = 0.3;
  return (
    <g onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); }} style={{ cursor: "pointer" }}
       transform={`translate(${drain.x}, ${drain.y})`}>
      <circle r={r} fill="#0891B2" opacity={0.18}/>
      <circle r={r * 0.95} fill="none" stroke="#0891B2" strokeWidth={0.06}/>
      <circle r={r * 0.55} fill="none" stroke="#0891B2" strokeWidth={0.04}/>
      <circle r={0.05} fill="#0891B2"/>
      {selected && <circle r={r + 0.15} fill="none" stroke="var(--accent)" strokeWidth={0.08} strokeDasharray="0.15 0.08"/>}
    </g>
  );
}

// Slope arrow — line from peak to drain with % label
function SlopeArrow({ slope, selected, hover, onClick, zoom = 1 }) {
  const { x1, y1, x2, y2 } = slope;
  const label = slope.label || (slope.percent != null ? `${slope.percent}%` : "");
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return null;
  const ux = dx / len, uy = dy / len;
  const headLen = 0.4;
  const headW = 0.18;
  const hx = x2 - ux * headLen;
  const hy = y2 - uy * headLen;
  const px = -uy * headW, py = ux * headW;
  const headPath = `M ${x2} ${y2} L ${hx + px} ${hy + py} L ${hx - px} ${hy - py} Z`;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const color = selected ? "var(--accent)" : hover ? "#9A3412" : "#7C2D12";
  const showLabel = label && zoom >= 0.4;
  return (
    <g onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); }} style={{ cursor: "pointer" }}>
      <line x1={x1} y1={y1} x2={hx} y2={hy} stroke={color} strokeWidth={selected ? 0.085 : 0.05}/>
      <path d={headPath} fill={color}/>
      {showLabel && (
        <g transform={`translate(${mx}, ${my - 0.3})`}>
          <rect x={-0.42} y={-0.18} width={0.84} height={0.36} rx={0.06} fill="#fff" stroke={color} strokeWidth={0.02}/>
          <text x={0} y={0.07} textAnchor="middle" fontSize={0.26} fontWeight={600} fontFamily="var(--font-mono)" fill={color}>
            {label}
          </text>
        </g>
      )}
    </g>
  );
}

// ============================================================
// Floor overlay — show contour of lower floor as semi-transparent
// ============================================================
function FloorOverlay({ walls }) {
  if (!walls || walls.length === 0) return null;
  return (
    <g style={{ pointerEvents: "none", opacity: 0.18 }}>
      {walls.filter(w => w.type === "external").map((w, i) => {
        const t = 0.36;
        let rect;
        if (wallIsH(w)) {
          rect = { x: Math.min(w.x1, w.x2) - t/2, y: w.y1 - t/2, w: Math.abs(w.x2 - w.x1) + t, h: t };
        } else {
          rect = { x: w.x1 - t/2, y: Math.min(w.y1, w.y2) - t/2, w: t, h: Math.abs(w.y2 - w.y1) + t };
        }
        return <rect key={i} x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill="#1F2937" strokeDasharray="0.3 0.2" stroke="#1F2937" strokeWidth={0.02}/>;
      })}
    </g>
  );
}

Object.assign(window, {
  PlanGrid, WallShape, WindowShape, DoorShape, OpeningShape,
  WallLengthLabel, RoomLabel, DimensionLines, Compass, EmptyCanvasHint,
  RoofContour, RoofSegment, ParapetEdge, AeratorShape, DrainShape, SlopeArrow, FloorOverlay,
});

// ============================================================
// DIMENSION (user-drawn) — line with arrows + label
// ============================================================
function DimensionShape({ dim, selected, hover, onClick }) {
  const dx = dim.x2 - dim.x1, dy = dim.y2 - dim.y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.05) return null;
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux; // perpendicular
  const off = 0.18; // arrow head half-width
  const headLen = 0.32;
  const color = selected ? "var(--accent)" : hover ? "#9A3412" : "#7C2D12";
  const mx = (dim.x1 + dim.x2) / 2, my = (dim.y1 + dim.y2) / 2;
  const precision = dim.precision != null ? dim.precision : 2;
  const text = dim.label || `${len.toFixed(precision)} м`;
  // text rotation: keep upright
  let rotDeg = Math.atan2(dy, dx) * 180 / Math.PI;
  if (rotDeg > 90) rotDeg -= 180;
  if (rotDeg < -90) rotDeg += 180;
  return (
    <g onClick={(e) => { e.stopPropagation(); onClick && onClick(); }} style={{ cursor: "pointer" }}>
      <line x1={dim.x1} y1={dim.y1} x2={dim.x2} y2={dim.y2} stroke={color} strokeWidth={selected ? 0.07 : 0.045}/>
      {/* Short serif marks at endpoints (CAD-style) */}
      <line x1={dim.x1 + px*off} y1={dim.y1 + py*off} x2={dim.x1 - px*off} y2={dim.y1 - py*off} stroke={color} strokeWidth={0.04}/>
      <line x1={dim.x2 + px*off} y1={dim.y2 + py*off} x2={dim.x2 - px*off} y2={dim.y2 - py*off} stroke={color} strokeWidth={0.04}/>
      {/* Arrow heads */}
      <path d={`M ${dim.x1} ${dim.y1} L ${dim.x1 + ux*headLen + px*0.12} ${dim.y1 + uy*headLen + py*0.12} L ${dim.x1 + ux*headLen - px*0.12} ${dim.y1 + uy*headLen - py*0.12} Z`} fill={color}/>
      <path d={`M ${dim.x2} ${dim.y2} L ${dim.x2 - ux*headLen + px*0.12} ${dim.y2 - uy*headLen + py*0.12} L ${dim.x2 - ux*headLen - px*0.12} ${dim.y2 - uy*headLen - py*0.12} Z`} fill={color}/>
      <g transform={`translate(${mx}, ${my}) rotate(${rotDeg}) translate(0, -0.32)`}>
        <rect x={-0.7} y={-0.2} width={1.4} height={0.4} rx={0.06} fill="#fff" stroke={color} strokeWidth={0.02}/>
        <text x={0} y={0.08} textAnchor="middle" fontSize={0.28} fontWeight={600} fontFamily="var(--font-mono)" fill={color}>{text}</text>
      </g>
    </g>
  );
}

// ============================================================
// NOTE — sticky badge
// ============================================================
function NoteShape({ note, selected, hover, onClick, zoom }) {
  const color = note.color || "#B45309";
  const showText = zoom >= 0.5 && note.text;
  const label = (note.text || "").slice(0, 40) || "Заметка";
  return (
    <g onClick={(e) => { e.stopPropagation(); onClick && onClick(); }} style={{ cursor: "pointer" }}
       transform={`translate(${note.x}, ${note.y})`}>
      {/* Pin shape */}
      <circle r={0.35} fill={color}/>
      <circle r={0.35} fill="none" stroke={selected ? "var(--accent)" : "#fff"} strokeWidth={selected ? 0.09 : 0.06}/>
      <text x={0} y={0.12} textAnchor="middle" fontSize={0.36} fontWeight={700} fill="#fff" fontFamily="var(--font-display)">N</text>
      {showText && (
        <g transform="translate(0.55, -0.15)">
          <rect x={0} y={-0.22} width={Math.min(6, Math.max(1.2, label.length * 0.18 + 0.4))} height={0.5} rx={0.08} fill="#FFFBEB" stroke={color} strokeWidth={0.025}/>
          <text x={0.18} y={0.1} fontSize={0.28} fill="#7C2D12" fontFamily="var(--font-sans)">{label}</text>
        </g>
      )}
      {selected && hover && <circle r={0.5} fill="none" stroke="var(--accent)" strokeWidth={0.05} strokeDasharray="0.1 0.08"/>}
    </g>
  );
}

// ============================================================
// PARAPET SEGMENT (custom drawn) — distinct from contour parapet
// ============================================================
function ParapetSegment({ parapet, selected, onClick }) {
  const color = selected ? "var(--accent)" : "#7C2D12";
  const w = selected ? 0.16 : 0.12;
  return (
    <g onClick={(e) => { e.stopPropagation(); onClick && onClick(); }} style={{ cursor: "pointer" }}>
      <line x1={parapet.x1} y1={parapet.y1} x2={parapet.x2} y2={parapet.y2} stroke={color} strokeWidth={w} strokeLinecap="round"/>
      {/* hatching marks for parapet symbol */}
      {(() => {
        const dx = parapet.x2 - parapet.x1, dy = parapet.y2 - parapet.y1;
        const len = Math.hypot(dx, dy);
        if (len < 0.001) return null;
        const ux = dx / len, uy = dy / len;
        const px = -uy * 0.18, py = ux * 0.18;
        const ticks = [];
        const step = 0.6;
        for (let s = 0.2; s < len - 0.05; s += step) {
          const cx = parapet.x1 + ux * s, cy = parapet.y1 + uy * s;
          ticks.push(<line key={s} x1={cx} y1={cy} x2={cx + px} y2={cy + py} stroke={color} strokeWidth={0.035}/>);
        }
        return ticks;
      })()}
    </g>
  );
}

// ============================================================
// JUNCTION (roof primykanie) — dashed line + small T marks
// ============================================================
function JunctionShape({ junction, selected, onClick }) {
  const color = selected ? "var(--accent)" : "#9A3412";
  return (
    <g onClick={(e) => { e.stopPropagation(); onClick && onClick(); }} style={{ cursor: "pointer" }}>
      <line x1={junction.x1} y1={junction.y1} x2={junction.x2} y2={junction.y2} stroke={color} strokeWidth={selected ? 0.11 : 0.075} strokeDasharray="0.3 0.18"/>
      <circle cx={junction.x1} cy={junction.y1} r={0.12} fill="#fff" stroke={color} strokeWidth={0.04}/>
      <circle cx={junction.x2} cy={junction.y2} r={0.12} fill="#fff" stroke={color} strokeWidth={0.04}/>
    </g>
  );
}

// ============================================================
// ENGOUT — engineering rooftop outlet/duct
// ============================================================
function EngoutShape({ engout, selected, onClick }) {
  const color = selected ? "var(--accent)" : "#4A5365";
  const isShaft = engout.engoutType === "Вентиляционная шахта" || engout.engoutType === "Шахта";
  const isPipe  = engout.engoutType === "Труба";
  const sz = isShaft ? 0.5 : 0.36;
  return (
    <g onClick={(e) => { e.stopPropagation(); onClick && onClick(); }} style={{ cursor: "pointer" }}
       transform={`translate(${engout.x}, ${engout.y})`}>
      {isPipe ? (
        <>
          <circle r={sz} fill="#fff" stroke={color} strokeWidth={0.06}/>
          <circle r={sz * 0.5} fill={color} opacity={0.45}/>
        </>
      ) : (
        <>
          <rect x={-sz} y={-sz} width={sz*2} height={sz*2} fill="#fff" stroke={color} strokeWidth={0.06}/>
          <line x1={-sz} y1={-sz} x2={sz} y2={sz} stroke={color} strokeWidth={0.04}/>
          <line x1={sz} y1={-sz} x2={-sz} y2={sz} stroke={color} strokeWidth={0.04}/>
        </>
      )}
      {selected && (
        isPipe
          ? <circle r={sz + 0.15} fill="none" stroke="var(--accent)" strokeWidth={0.07} strokeDasharray="0.15 0.08"/>
          : <rect x={-sz - 0.15} y={-sz - 0.15} width={sz*2 + 0.3} height={sz*2 + 0.3} fill="none" stroke="var(--accent)" strokeWidth={0.07} strokeDasharray="0.15 0.08"/>
      )}
    </g>
  );
}

// ============================================================
// Resize handles for rectangular objects (rooms, segments)
// ============================================================
function ResizeHandles({ bounds, scale, onHandle }) {
  if (!bounds) return null;
  const r = 7 / scale;
  const { x, y, w, h } = bounds;
  const mid = (a, b) => (a + b) / 2;
  const handles = [
    { key: "nw", x: x,         y: y,         cursor: "nwse-resize" },
    { key: "ne", x: x + w,     y: y,         cursor: "nesw-resize" },
    { key: "sw", x: x,         y: y + h,     cursor: "nesw-resize" },
    { key: "se", x: x + w,     y: y + h,     cursor: "nwse-resize" },
    { key: "n",  x: mid(x, x+w), y: y,       cursor: "ns-resize"   },
    { key: "s",  x: mid(x, x+w), y: y + h,   cursor: "ns-resize"   },
    { key: "w",  x: x,         y: mid(y, y+h), cursor: "ew-resize" },
    { key: "e",  x: x + w,     y: mid(y, y+h), cursor: "ew-resize" },
  ];
  return (
    <g>
      {handles.map(h => (
        <g key={h.key} transform={`translate(${h.x}, ${h.y})`} style={{ cursor: h.cursor }}
           onPointerDown={(e) => { e.stopPropagation(); onHandle && onHandle(h.key, e); }}>
          <circle r={r * 1.6} fill="rgba(234,88,12,0.18)"/>
          <circle r={r} fill="#fff" stroke="var(--accent)" strokeWidth={2.5 / scale}/>
        </g>
      ))}
    </g>
  );
}

// Endpoint handles for 2-point objects (dimensions, parapets, junctions, slopes)
function EndpointHandles({ p1, p2, scale, onHandle }) {
  const r = 6 / scale;
  return (
    <g>
      <g transform={`translate(${p1.x}, ${p1.y})`} style={{ cursor: "grab" }}
         onPointerDown={(e) => { e.stopPropagation(); onHandle && onHandle("a", e); }}>
        <circle r={r * 1.7} fill="rgba(234,88,12,0.18)"/>
        <circle r={r} fill="#fff" stroke="var(--accent)" strokeWidth={2.5 / scale}/>
      </g>
      <g transform={`translate(${p2.x}, ${p2.y})`} style={{ cursor: "grab" }}
         onPointerDown={(e) => { e.stopPropagation(); onHandle && onHandle("b", e); }}>
        <circle r={r * 1.7} fill="rgba(234,88,12,0.18)"/>
        <circle r={r} fill="#fff" stroke="var(--accent)" strokeWidth={2.5 / scale}/>
      </g>
    </g>
  );
}

// Multi-select / locked badges overlay
function SelectionRect({ bounds, scale, kind = "selected" }) {
  if (!bounds) return null;
  const stroke = kind === "locked" ? "#94A3B8" : kind === "warn" ? "#B45309" : kind === "hover" ? "#94A3B8" : "var(--accent)";
  const dash = kind === "locked" ? `${0.18} ${0.12}` : `${0.22} ${0.12}`;
  return (
    <rect x={bounds.x - 0.08} y={bounds.y - 0.08} width={bounds.w + 0.16} height={bounds.h + 0.16}
      fill="none" stroke={stroke} strokeWidth={2 / scale} strokeDasharray={dash} style={{ pointerEvents: "none" }}/>
  );
}

Object.assign(window, {
  DimensionShape, NoteShape,
  ParapetSegment, JunctionShape, EngoutShape,
  ResizeHandles, EndpointHandles, SelectionRect,
});

// ============================================================
// BACKGROUND IMAGE — underlay drawing rendered between grid and rooms.
// Locked underlays do not capture pointer events; unlocked ones do.
// ============================================================
function BackgroundImage({ bg, selected, hover, onClick, layerOpacity = 1, hideContent = false, zoom = 1 }) {
  if (!bg || !bg.visible) return null;
  const opacity = (bg.opacity != null ? bg.opacity : 0.6) * layerOpacity;
  const interactive = !bg.locked && !!onClick;
  const stroke = selected ? "var(--accent)" : hover ? "rgba(124,58,237,0.6)" : (bg.locked ? "#94A3B8" : "#7C3AED");
  const sw = (selected ? 2 : 1.2) / zoom;
  return (
    <g
      transform={bg.rotation ? `rotate(${bg.rotation} ${bg.x + bg.width / 2} ${bg.y + bg.height / 2})` : undefined}
      style={{ cursor: interactive ? "move" : "default", pointerEvents: interactive ? "auto" : "none" }}
      onPointerDown={interactive ? (e) => { e.stopPropagation(); onClick && onClick(e, bg); } : undefined}
    >
      {!hideContent && (
        <image
          href={bg.src} xlinkHref={bg.src}
          x={bg.x} y={bg.y} width={bg.width} height={bg.height}
          opacity={opacity}
          preserveAspectRatio="none"
          style={{ pointerEvents: interactive ? "auto" : "none" }}
        />
      )}
      <rect
        x={bg.x} y={bg.y} width={bg.width} height={bg.height}
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeDasharray={selected || (!bg.locked) ? `${8/zoom} ${4/zoom}` : `${3/zoom} ${4/zoom}`}
        opacity={selected ? 0.85 : 0.5}
        style={{ pointerEvents: interactive ? "auto" : "none" }}
      />
      {/* Lock badge */}
      {bg.locked && zoom > 0.4 && (
        <g transform={`translate(${bg.x + 0.2} ${bg.y + 0.2})`} style={{ pointerEvents: "none" }}>
          <rect x={0} y={0} width={1.4} height={0.55} rx={0.1} fill="rgba(11,18,32,0.62)"/>
          <text x={0.16} y={0.4} fill="#fff" style={{ fontSize: 0.32 / 1, fontFamily: "var(--font-sans)" }}>
            🔒 {bg.scaleCalibrated ? "масштаб" : "без масштаба"}
          </text>
        </g>
      )}
    </g>
  );
}

// Background corner resize handles — visible when selected & not locked.
function BackgroundHandles({ bg, scale, onCorner, onRotate }) {
  if (!bg || bg.locked) return null;
  const r = 7 / scale;
  const cx = bg.x + bg.width / 2;
  const cy = bg.y + bg.height / 2;
  const handles = [
    { id: "nw", x: bg.x,             y: bg.y              },
    { id: "ne", x: bg.x + bg.width,  y: bg.y              },
    { id: "se", x: bg.x + bg.width,  y: bg.y + bg.height  },
    { id: "sw", x: bg.x,             y: bg.y + bg.height  },
  ];
  return (
    <g style={{ pointerEvents: "auto" }}>
      {handles.map(h => (
        <rect key={h.id} x={h.x - r} y={h.y - r} width={r * 2} height={r * 2}
          fill="#fff" stroke="var(--accent)" strokeWidth={1.5 / scale}
          style={{ cursor: (h.id === "nw" || h.id === "se") ? "nwse-resize" : "nesw-resize" }}
          onPointerDown={(e) => { e.stopPropagation(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} onCorner && onCorner(h.id, e); }}
        />
      ))}
      {onRotate && (
        <g transform={`translate(${cx} ${bg.y - 1.2/scale * 30})`}>
          <line x1={0} y1={0} x2={0} y2={1.2/scale * 30} stroke="var(--accent)" strokeWidth={1/scale}/>
          <circle r={r} fill="#fff" stroke="var(--accent)" strokeWidth={1.5/scale} style={{ cursor: "crosshair" }}
            onPointerDown={(e) => { e.stopPropagation(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} onRotate(e); }}/>
        </g>
      )}
    </g>
  );
}

// Calibration line — shown after calibration finishes, with real length label.
// Interactive: click to edit length; endpoints can be dragged when onStartEndpointDrag is provided.
function CalibrationLine({ line, zoom = 1, color = "#C2410C", onClickLabel, onStartEndpointDrag, selected = false }) {
  if (!line) return null;
  const cx = (line.x1 + line.x2) / 2;
  const cy = (line.y1 + line.y2) / 2;
  const len = line.realLength != null ? line.realLength : Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
  const fs = 0.32;
  const dotR = (selected ? 5 : 3.5) / zoom;
  const sw = (selected ? 1.6 : 1.1) / zoom;
  const dash = `${5/zoom} ${3.5/zoom}`;
  const labelW = 1.6, labelH = 0.62;
  return (
    <g>
      {/* Hitline (invisible, wider) for easier clicking */}
      <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
        stroke="transparent" strokeWidth={Math.max(0.5, 12/zoom)}
        style={{ cursor: onClickLabel ? "pointer" : "default" }}
        onClick={(e) => { if (onClickLabel) { e.stopPropagation(); onClickLabel(); } }}/>
      {/* Visible dashed line */}
      <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
        stroke={color} strokeWidth={sw} strokeDasharray={dash} opacity={selected ? 0.95 : 0.7}
        style={{ pointerEvents: "none" }}/>
      {/* Endpoints — small filled rings, larger hit zone */}
      {[{ key: "a", x: line.x1, y: line.y1 }, { key: "b", x: line.x2, y: line.y2 }].map(p => (
        <g key={p.key} style={{ cursor: onStartEndpointDrag ? "grab" : "default" }}
          onPointerDown={onStartEndpointDrag ? (e) => { e.stopPropagation(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} onStartEndpointDrag(p.key, { x: p.x, y: p.y }); } : undefined}>
          <circle cx={p.x} cy={p.y} r={dotR + 5/zoom} fill="transparent"/>
          <circle cx={p.x} cy={p.y} r={dotR} fill="#fff" stroke={color} strokeWidth={1.6 / zoom}/>
        </g>
      ))}
      {/* Length pill */}
      <g transform={`translate(${cx} ${cy})`} style={{ cursor: onClickLabel ? "pointer" : "default", pointerEvents: onClickLabel ? "auto" : "none" }}
        onClick={(e) => { if (onClickLabel) { e.stopPropagation(); onClickLabel(); } }}>
        <rect x={-labelW/2} y={-labelH/2} width={labelW} height={labelH} rx={0.14}
          fill="#FFFFFF" stroke={color} strokeWidth={1.1 / zoom} opacity={0.96}/>
        <text x={0} y={0.04} textAnchor="middle" dominantBaseline="middle"
          fill={color}
          style={{ fontSize: fs, fontFamily: "var(--font-mono, monospace)", fontWeight: 700 }}>
          {(typeof len === "number" ? len.toFixed(len >= 10 ? 1 : 2) : "—")} м
        </text>
      </g>
    </g>
  );
}

// Calibration pending preview — between 1st click and 2nd click
function CalibrationPreview({ p1, cursor, zoom = 1 }) {
  if (!p1) return null;
  const color = "#C2410C";
  const r = 4 / zoom;
  return (
    <g style={{ pointerEvents: "none" }}>
      <circle cx={p1.x} cy={p1.y} r={r + 3/zoom} fill={color} opacity={0.18}/>
      <circle cx={p1.x} cy={p1.y} r={r} fill="#fff" stroke={color} strokeWidth={1.6 / zoom}/>
      {cursor && cursor.x != null && (
        <>
          <line x1={p1.x} y1={p1.y} x2={cursor.x} y2={cursor.y}
            stroke={color} strokeWidth={1.4 / zoom} strokeDasharray={`${5/zoom} ${3.5/zoom}`} opacity={0.85}/>
          <circle cx={cursor.x} cy={cursor.y} r={r + 3/zoom} fill={color} opacity={0.15}/>
          <circle cx={cursor.x} cy={cursor.y} r={r} fill="#fff" stroke={color} strokeWidth={1.4 / zoom} opacity={0.85}/>
        </>
      )}
    </g>
  );
}

Object.assign(window, {
  BackgroundImage, BackgroundHandles, CalibrationLine, CalibrationPreview,
});

// ============================================================
// AI-CANDIDATE shapes — dashed, semi-transparent preview overlays
// for walls / openings / rooms / plumb / notes proposed by PDF analysis.
// ============================================================

// Threshold for "low confidence" — drawn amber instead of purple.
const LOW_CONF = 0.78;

function CandidateWall({ c, zoom = 1, selected, onClick }) {
  if (!c) return null;
  const lowConf = c.confidence < LOW_CONF;
  const rejected = c.status === "rejected";
  const accepted = c.status === "accepted";
  const baseColor = rejected ? "#94A3B8" : lowConf ? "#EA580C" : (c.type === "external" ? "#1E40AF" : "#7C3AED");
  const sw = (c.type === "external" ? 3.5 : 2.5) / zoom;
  const dash = `${10/zoom} ${6/zoom}`;
  const opacity = rejected ? 0.35 : accepted ? 0.95 : 0.75;
  return (
    <g style={{ cursor: onClick ? "pointer" : "default" }}
      onPointerDown={onClick ? (e) => { e.stopPropagation(); onClick(c, e); } : undefined}>
      {/* Hit area */}
      <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
        stroke="transparent" strokeWidth={Math.max(0.4, 10/zoom)} pointerEvents="stroke"/>
      <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
        stroke={baseColor} strokeWidth={sw} strokeDasharray={dash} opacity={opacity}
        strokeLinecap="round" pointerEvents="none"/>
      {selected && (
        <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
          stroke="var(--accent)" strokeWidth={sw + 2/zoom} strokeDasharray={dash} opacity={0.5}
          strokeLinecap="round" pointerEvents="none"/>
      )}
    </g>
  );
}

function CandidateOpening({ c, zoom = 1, selected, onClick }) {
  if (!c) return null;
  const lowConf = c.confidence < LOW_CONF;
  const rejected = c.status === "rejected";
  const color = rejected ? "#94A3B8" : lowConf ? "#EA580C" : c.kind === "door" ? "#0F766E" : "#2563EB";
  const opacity = rejected ? 0.3 : 0.7;
  const r = 0.35;
  const cx = (c.x1 + c.x2) / 2;
  const cy = (c.y1 + c.y2) / 2;
  return (
    <g style={{ cursor: onClick ? "pointer" : "default" }}
      onPointerDown={onClick ? (e) => { e.stopPropagation(); onClick(c, e); } : undefined}>
      <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
        stroke={color} strokeWidth={3/zoom} opacity={opacity} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={r}
        fill="#fff" stroke={color} strokeWidth={1.5/zoom} strokeDasharray={`${3/zoom} ${2/zoom}`}
        opacity={opacity + 0.1}/>
      <text x={cx} y={cy + 0.08} textAnchor="middle" dominantBaseline="middle"
        fill={color} style={{ fontSize: 0.28, fontWeight: 700, pointerEvents: "none" }}>
        {c.kind === "door" ? "Д" : "О"}
      </text>
      {selected && (
        <circle cx={cx} cy={cy} r={r + 0.18} fill="none" stroke="var(--accent)" strokeWidth={1.5/zoom} opacity={0.6}/>
      )}
    </g>
  );
}

function CandidateRoom({ c, zoom = 1, selected, onClick }) {
  if (!c) return null;
  const rejected = c.status === "rejected";
  const lowConf = c.confidence < LOW_CONF;
  const fill = rejected ? "rgba(148,163,184,0.08)" : lowConf ? "rgba(234,88,12,0.08)" : "rgba(124,58,237,0.07)";
  const stroke = rejected ? "#94A3B8" : lowConf ? "#EA580C" : "#7C3AED";
  return (
    <g style={{ cursor: onClick ? "pointer" : "default" }}
      onPointerDown={onClick ? (e) => { e.stopPropagation(); onClick(c, e); } : undefined}>
      <rect x={c.x} y={c.y} width={c.w} height={c.h}
        fill={fill} stroke={stroke} strokeWidth={1.5/zoom} strokeDasharray={`${6/zoom} ${4/zoom}`}
        opacity={rejected ? 0.5 : 1}/>
      {!rejected && (
        <text x={c.x + c.w/2} y={c.y + c.h/2} textAnchor="middle" dominantBaseline="middle"
          fill={stroke} style={{ fontSize: 0.32, fontWeight: 600, pointerEvents: "none" }}>
          {c.name} · {(c.w * c.h).toFixed(1)} м²
        </text>
      )}
      {selected && (
        <rect x={c.x - 0.15} y={c.y - 0.15} width={c.w + 0.3} height={c.h + 0.3}
          fill="none" stroke="var(--accent)" strokeWidth={1.5/zoom} strokeDasharray={`${6/zoom} ${4/zoom}`} opacity={0.55}/>
      )}
    </g>
  );
}

function CandidatePlumb({ c, zoom = 1, selected, onClick }) {
  if (!c) return null;
  const rejected = c.status === "rejected";
  const color = rejected ? "#94A3B8" : "#0891B2";
  return (
    <g style={{ cursor: onClick ? "pointer" : "default" }}
      onPointerDown={onClick ? (e) => { e.stopPropagation(); onClick(c, e); } : undefined}>
      <circle cx={c.x} cy={c.y} r={0.3} fill="#fff" stroke={color} strokeWidth={1.5/zoom} strokeDasharray={`${3/zoom} ${2/zoom}`} opacity={rejected ? 0.4 : 0.9}/>
      <text x={c.x} y={c.y - 0.55} textAnchor="middle"
        fill={color} style={{ fontSize: 0.28, fontWeight: 600, pointerEvents: "none" }} opacity={rejected ? 0.4 : 1}>
        {c.label}
      </text>
    </g>
  );
}

Object.assign(window, { CandidateWall, CandidateOpening, CandidateRoom, CandidatePlumb });
