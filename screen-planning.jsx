/* global React, window, I */
// ============================================================
// Planning · main screen orchestration (CAD-lite core)
// Transform-based viewport with per-level viewState { panX, panY, zoom }
// Zoom-to-cursor (Ctrl/Cmd+wheel), pan with MMB/RMB/Space/Hand
// Undo/redo, autosave, helpers, fit-to-object/selection/world
// ============================================================
var { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } = React;

var PX_PER_M    = window.PL_PX_PER_M;
var MIN_ZOOM    = window.PL_MIN_ZOOM;
var MAX_ZOOM    = window.PL_MAX_ZOOM;
var GRID_SIZES  = window.PL_GRID_SIZES;
var MODES       = window.PL_MODES;
var LEVEL_TYPES = window.PL_LEVEL_TYPES;
var TEMPLATES   = window.PL_TEMPLATES;
var TOOLSETS    = window.PL_TOOLSETS;
var PRICE       = window.PL_PRICE;
var ROOM_COLORS = window.PL_ROOM_COLORS;

var wallLen = window.plWallLen;
var wallIsH = window.plWallIsH;
var snapToGrid = window.plSnapToGrid;
var axisLock   = window.plAxisLock;
var findNearestWall = window.plFindNearestWall;
var formatRu   = window.plFormatRu;
var polygonArea = window.plPolygonArea;
var polygonPerimeter = window.plPolygonPerimeter;
var instantiateTemplate = window.plInstantiateTemplate;
var emptyLevel = window.plEmptyLevel;
var clampZoom  = window.plClampZoom;
var screenToWorld = window.plScreenToWorld;
var fitBoundsToView = window.plFitBoundsToView;
var getLevelBounds = window.plGetLevelBounds;
var getObjectBounds = window.plGetObjectBounds;
var getVisibleGridStep = window.plGetVisibleGridStep;
var getEstimateDraft = window.plGetEstimateDraft;
var getValidationWarnings = window.plGetValidationWarnings;
var wallAxisBounds = window.plWallAxisBounds;
var clampOpeningOnWall = window.plClampOpeningOnWall;
var objectKind = window.plObjectKind;
var classifyObject = window.plClassifyObject;
var iterAllObjects = window.plIterAllObjects;
var findObjectById = window.plFindObjectById;
var defaultLayersForType = window.plDefaultLayersForType;
var unionBounds = window.plUnionBounds;
var LAYER_OF = window.PL_LAYER_OF;

const LS_KEY    = "stroika.planning.project.v2";
const LS_KEY_V1 = "stroika.planning.project.v1";

// Layer id for any given object/kind, with default fallback
function layerOf(obj, kind) {
  if (obj && obj.layerId) return obj.layerId;
  return LAYER_OF[kind] || null;
}

// Migrate legacy project (v1) into v2 shape — ensures every level has layers,
// dimensions, notes, roof.parapets/junctions/engouts.
function migrateProject(p) {
  if (!p || !p.levels || !p.levelsData) return p;
  const levelsData = {};
  for (const lvl of p.levels) {
    const cur = p.levelsData[lvl.id] || {};
    const data = {
      walls: (cur.walls || []).map(w => ({ layerId: w.type === "external" ? "L-walls-ext" : "L-walls-int", ...w })),
      windows: (cur.windows || []).map(o => ({ layerId: "L-openings", ...o })),
      doors: (cur.doors || []).map(o => ({ layerId: "L-openings", ...o })),
      openings: (cur.openings || []).map(o => ({ layerId: "L-openings", ...o })),
      rooms: (cur.rooms || []).map(r => ({ layerId: "L-rooms", geometryType: r.geometryType || "rect", ...r })),
      dimensions: (cur.dimensions || []).map(d => ({ layerId: "L-dims", precision: 2, ...d })),
      notes: (cur.notes || []).map(n => ({ layerId: "L-notes", color: "#B45309", ...n })),
      backgrounds: (cur.backgrounds || []).map(b => ({
        layerId: "L-bgs",
        opacity: 0.6, locked: true, visible: true, rotation: 0,
        scaleCalibrated: false, pixelsPerMeter: null, calibrationLine: null,
        ...b,
      })),
      layers: (() => {
        const def = defaultLayersForType(lvl.type);
        const existing = cur.layers && cur.layers.length ? cur.layers : def;
        // Ensure new L-bgs layer is present in older saves
        if (!existing.find(l => l.id === "L-bgs")) {
          return [def[0], ...existing];
        }
        return existing;
      })(),
      roof: cur.roof ? {
        ...cur.roof,
        aerators: (cur.roof.aerators || []).map(a => ({ layerId: "L-aerators", ...a })),
        drains:   (cur.roof.drains   || []).map(d => ({ layerId: "L-drains", ...d })),
        slopes:   (cur.roof.slopes   || []).map(s => ({ layerId: "L-slopes", percent: s.percent != null ? s.percent : (parseFloat((s.label || "1.5").toString().replace("%", "")) || 1.5), ...s })),
        segments: (cur.roof.segments || []).map(s => ({
          layerId: "L-segments",
          ...s,
          x: s.x != null ? s.x : s.bounds?.x,
          y: s.y != null ? s.y : s.bounds?.y,
          w: s.w != null ? s.w : s.bounds?.w,
          h: s.h != null ? s.h : s.bounds?.h,
        })),
        parapets:  cur.roof.parapets || [],
        junctions: cur.roof.junctions || [],
        engouts:   cur.roof.engouts || [],
      } : null,
    };
    levelsData[lvl.id] = data;
  }
  return { ...p, levelsData };
}

// ============================================================
// Initial viewState — sane default, will be refit on mount
// ============================================================
function defaultViewState() {
  return { panX: 80, panY: 80, zoom: 0.6 };
}

// ============================================================
// Empty project
// ============================================================
function newEmptyProject(world) {
  const lvl = emptyLevel("L-1", "1 этаж", "floor", world);
  return {
    levels: [{ id: lvl.id, name: lvl.name, type: lvl.type, world: lvl.world }],
    activeLevelId: lvl.id,
    levelsData: { [lvl.id]: {
      walls: lvl.walls, windows: lvl.windows, doors: lvl.doors, openings: lvl.openings, rooms: lvl.rooms,
      dimensions: lvl.dimensions || [], notes: lvl.notes || [],
      backgrounds: lvl.backgrounds || [],
      layers: lvl.layers, roof: lvl.roof,
    } },
    levelsView: { [lvl.id]: defaultViewState() },
    world: world,
  };
}

// ============================================================
// Stats by level
// ============================================================
function computeStats(levelData, levelType) {
  const isRoof = levelType === "roof" || levelType === "industrial_roof";
  if (isRoof && levelData.roof) {
    const roof = levelData.roof;
    const roofArea = roof.contour && roof.contour.length >= 3 ? polygonArea(roof.contour) : 0;
    const roofPerimeter = roof.contour && roof.contour.length >= 3 ? polygonPerimeter(roof.contour) : 0;
    const aeratorCount = (roof.aerators || []).length;
    const drainCount = (roof.drains || []).length;
    const matCost = roofArea * PRICE.roofPerM2.mat + roofPerimeter * PRICE.parapetPerM.mat + aeratorCount * PRICE.aerator.mat + drainCount * PRICE.drain.mat;
    const workCost = roofArea * PRICE.roofPerM2.work + roofPerimeter * PRICE.parapetPerM.work + aeratorCount * PRICE.aerator.work + drainCount * PRICE.drain.work;
    const cost = matCost + workCost;
    const margin = cost * PRICE.margin;
    return { roofArea, roofPerimeter, aeratorCount, drainCount, totalArea: roofArea, perimeter: roofPerimeter, extLen: 0, intLen: 0, winCount: 0, doorCount: 0, matCost, workCost, cost, margin, total: cost + margin };
  }
  const { walls, windows, doors, rooms } = levelData;
  const externals = walls.filter(w => w.type === "external");
  const internals = walls.filter(w => w.type === "internal");
  const extLen = externals.reduce((s, w) => s + wallLen(w), 0);
  const intLen = internals.reduce((s, w) => s + wallLen(w), 0);
  const totalArea = rooms.reduce((s, r) => s + r.w * r.h, 0);
  const winCount = windows.length;
  const doorCount = doors.length;
  const matCost = extLen * PRICE.externalWall.mat + intLen * PRICE.internalWall.mat + winCount * PRICE.window.mat + doorCount * PRICE.door.mat + totalArea * (PRICE.floorPerM2.mat + PRICE.ceilingPerM2.mat);
  const workCost = extLen * PRICE.externalWall.work + intLen * PRICE.internalWall.work + winCount * PRICE.window.work + doorCount * PRICE.door.work + totalArea * (PRICE.floorPerM2.work + PRICE.ceilingPerM2.work);
  const cost = matCost + workCost;
  const margin = cost * PRICE.margin;
  return { externals, internals, extLen, intLen, totalArea, perimeter: extLen, winCount, doorCount, matCost, workCost, cost, margin, total: cost + margin };
}

// ============================================================
// Load / save autosave
// ============================================================
function loadFromStorage() {
  try {
    let s = localStorage.getItem(LS_KEY);
    if (!s) {
      // Fallback to v1
      s = localStorage.getItem(LS_KEY_V1);
      if (!s) return null;
    }
    const p = JSON.parse(s);
    if (!p || !p.levels || !p.levelsData) return null;
    return migrateProject(p);
  } catch { return null; }
}
function saveToStorage(project) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(project)); return true; } catch { return false; }
}

// ============================================================
// PlanningScreen — top-level
// ============================================================
function PlanningScreen({ onNav }) {
  // -------- history (undo/redo) --------
  // history of project snapshots; index points to current
  const [project, setProjectRaw] = useState(() => loadFromStorage() || newEmptyProject(window.PL_DEFAULT_WORLD));
  const historyRef = useRef({ past: [], future: [] });
  const skipHistoryRef = useRef(false);
  const setProject = useCallback((updater, opts = {}) => {
    setProjectRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!opts.skipHistory && !skipHistoryRef.current) {
        historyRef.current.past.push(prev);
        if (historyRef.current.past.length > 80) historyRef.current.past.shift();
        historyRef.current.future = [];
      }
      return next;
    });
  }, []);
  // Push a manual snapshot of current state to history — used by drag handlers
  // to commit pre-drag state before applying skip-history mutations.
  const pushHistoryNow = useCallback(() => {
    setProjectRaw(prev => {
      historyRef.current.past.push(prev);
      if (historyRef.current.past.length > 80) historyRef.current.past.shift();
      historyRef.current.future = [];
      return prev;
    });
  }, []);
  function doUndo() {
    setProjectRaw(prev => {
      if (historyRef.current.past.length === 0) return prev;
      const last = historyRef.current.past.pop();
      historyRef.current.future.push(prev);
      return last;
    });
  }
  function doRedo() {
    setProjectRaw(prev => {
      if (historyRef.current.future.length === 0) return prev;
      const next = historyRef.current.future.pop();
      historyRef.current.past.push(prev);
      return next;
    });
  }
  const [_, force] = useState(0);
  const bumpUI = () => force(x => x + 1);

  // -------- UI state --------
  const [view, setView] = useState("canvas");
  const [mode, setMode] = useState("plan");
  const [tool, setTool] = useState("wall");
  const [selectedIds, setSelectedIds] = useState([]);
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : (selectedIds[0] || null);
  const setSelectedId = (id) => setSelectedIds(id == null ? [] : [id]);
  const toggleSelection = (id, additive) => {
    setSelectedIds(prev => {
      if (!id) return [];
      if (!additive) return [id];
      if (prev.includes(id)) return prev.filter(x => x !== id);
      return [...prev, id];
    });
  };
  const [gridSize, setGridSize] = useState(1);
  const [showFloorOverlay] = useState(true);
  const [calculated, setCalculated] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [hoverPoint, setHoverPoint] = useState(null);
  const [hoverObjectId, setHoverObjectId] = useState(null);
  const [snappedCursor, setSnappedCursor] = useState(null);
  const [wallDrag, setWallDrag] = useState(null);
  const [roomStart, setRoomStart] = useState(null);
  const [contourPts, setContourPts] = useState([]);
  // 2-point tools temp state: { x1, y1 }
  const [linePending, setLinePending] = useState(null);
  // Segment draw — drag from corner to corner
  const [segDrag, setSegDrag] = useState(null);
  // Generic move-drag: pointer drag for windows/doors/notes/aerators/etc.
  // { kind, id, start: {x,y}, snapshot: obj }
  const [moveDrag, setMoveDrag] = useState(null);
  // Resize-handle drag for rooms / segments
  // { kind, id, handle, startBounds, snapshot }
  const [resizeDrag, setResizeDrag] = useState(null);
  // Endpoint drag for line objects (dim, parapet, junction, slope)
  // { kind, id, end: "a"|"b", snapshot }
  const [endpointDrag, setEndpointDrag] = useState(null);
  // Roof contour vertex drag: { idx, snapshot: [contour points] }
  const [contourVertexDrag, setContourVertexDrag] = useState(null);
  // Last "Check roof" verdict — shown as a callout in dashboard
  const [roofCheckRunAt, setRoofCheckRunAt] = useState(null);
  const [inspectorTab, setInspectorTab] = useState("params");
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [altDown, setAltDown] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [handleDrag, setHandleDrag] = useState(null);
  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const [demoModeOpen, setDemoModeOpen] = useState(false);
  const [scenarioHintId, setScenarioHintId] = useState(null);
  const [estimateScope, setEstimateScope] = useState("level"); // 'level' | 'project'
  // Background / underlay
  const [bgDrag, setBgDrag] = useState(null);       // { id, mode: 'move'|'resize', corner, snapshot, anchor }
  const [calibrationMode, setCalibrationMode] = useState(null); // { bgId } when active
  const [calibrationPending, setCalibrationPending] = useState(null); // { bgId, p1 }
  const [calibrationModal, setCalibrationModal] = useState(null);     // { bgId, p1, p2, measured }
  const [calibrationDrag, setCalibrationDrag] = useState(null);       // { bgId, endpoint, snapshot }
  const importFileRef = useRef(null);
  const importTargetRef = useRef(null);
  // Result Center / KP / Export
  const [resultCenterOpen, setResultCenterOpen] = useState(false);
  const [kpModalOpen, setKpModalOpen] = useState(false);
  const [kpPreviewKp, setKpPreviewKp] = useState(null);
  const [exportVariant, setExportVariant] = useState(null);
  const [lastProposalId, setLastProposalId] = useState(null);
  const [lastExportAt, setLastExportAt] = useState(null);
  // Per-row overrides (price changes, include toggles) — keyed by row id
  const [rowOverrides, setRowOverrides] = useState({});
  // PDF Analysis
  const [pdfAnalysis, setPdfAnalysis] = useState(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [candidates, setCandidates] = useState({ walls: [], openings: [], rooms: [], annotations: [] });
  const wrapperRef = useRef(null);
  const containerSize = useRef({ w: 800, h: 600 });

  // -------- derived: active level --------
  const level = project.levels.find(l => l.id === project.activeLevelId) || project.levels[0];
  const data = project.levelsData[level.id] || { walls: [], windows: [], doors: [], openings: [], rooms: [], dimensions: [], notes: [], layers: defaultLayersForType(level.type), roof: null };
  const layers = data.layers && data.layers.length ? data.layers : defaultLayersForType(level.type);
  const layerById = useMemo(() => Object.fromEntries(layers.map(l => [l.id, l])), [layers]);
  const isLayerLocked = (lid) => { const l = layerById[lid]; return !!(l && l.locked); };
  const isLayerHidden = (lid) => { const l = layerById[lid]; return !!(l && l.visible === false); };
  const world = level.world || project.world;
  const isRoofLevel = level.type === "roof" || level.type === "industrial_roof";
  const viewState = (project.levelsView && project.levelsView[level.id]) || defaultViewState();

  function setViewState(updater, skipHistory = true) {
    setProject(p => {
      const lv = (p.levelsView && p.levelsView[p.activeLevelId]) || defaultViewState();
      const next = typeof updater === "function" ? updater(lv) : updater;
      return { ...p, levelsView: { ...(p.levelsView || {}), [p.activeLevelId]: next } };
    }, { skipHistory });
  }

  // Auto-switch mode based on level type
  useEffect(() => {
    if (isRoofLevel && mode === "plan") setMode("roof");
    if (!isRoofLevel && mode === "roof") setMode("plan");
    // eslint-disable-next-line
  }, [project.activeLevelId]);

  // Default tool when mode changes
  useEffect(() => {
    const ts = TOOLSETS[mode] || TOOLSETS.plan;
    const allowed = ts.filter(x => !x.sep).map(x => x.id);
    if (!allowed.includes(tool)) setTool(allowed[0]);
    // eslint-disable-next-line
  }, [mode]);

  // -------- Level-data setters (history-aware) --------
  function updateLevelData(patch, opts) {
    setProject(p => ({
      ...p,
      levelsData: { ...p.levelsData, [p.activeLevelId]: { ...p.levelsData[p.activeLevelId], ...patch } },
    }), opts);
  }
  function makeSetter(key) {
    return (next, opts) => setProject(p => {
      const cur = p.levelsData[p.activeLevelId] || { walls: [], windows: [], doors: [], openings: [], rooms: [], dimensions: [], notes: [], roof: null };
      const newVal = typeof next === "function" ? next(cur[key]) : next;
      return { ...p, levelsData: { ...p.levelsData, [p.activeLevelId]: { ...cur, [key]: newVal } } };
    }, opts);
  }
  const setWalls      = useCallback(makeSetter("walls"),      []);
  const setWindows    = useCallback(makeSetter("windows"),    []);
  const setDoors      = useCallback(makeSetter("doors"),      []);
  const setOpenings   = useCallback(makeSetter("openings"),   []);
  const setRooms      = useCallback(makeSetter("rooms"),      []);
  const setDimensions = useCallback(makeSetter("dimensions"), []);
  const setNotes      = useCallback(makeSetter("notes"),      []);
  const setLayers     = useCallback(makeSetter("layers"),     []);
  const setRoof     = useCallback((updater, opts) => {
    setProject(p => {
      const cur = p.levelsData[p.activeLevelId] || {};
      const curRoof = cur.roof || { contour: [], parapetHeight: 0.5, slope: 1.5, material: "—", aerators: [], drains: [], slopes: [], segments: [], parapets: [], junctions: [], engouts: [] };
      const newRoof = typeof updater === "function" ? updater(curRoof) : updater;
      return { ...p, levelsData: { ...p.levelsData, [p.activeLevelId]: { ...cur, roof: newRoof } } };
    }, opts);
  }, []);

  // -------- tool flags --------
  const isWallTool = tool === "wall" || tool === "partition";
  const isRoomTool = tool === "room" || tool === "zone";
  const isPlaceTool = tool === "window" || tool === "door" || tool === "opening";
  const isRoofPointTool = tool === "aerator" || tool === "drain" || tool === "engout";
  const isRoofContourTool = tool === "roof_contour";
  const isSegmentTool = tool === "roof_segment";
  const isSlopeTool = tool === "slope";
  // 2-click line tools
  const isLineTool = tool === "parapet" || tool === "junction" || tool === "dim" || tool === "slope";
  const isNoteTool = tool === "note";
  const isPanTool = tool === "hand";
  const isPanMode = isPanTool || spaceDown;
  const isDrawing = isWallTool || isRoomTool || isPlaceTool || isRoofPointTool || isRoofContourTool || isSegmentTool || isLineTool || isNoteTool;

  // -------- selection --------
  const selected = useMemo(() => {
    if (!selectedId) return null;
    const found = findObjectById(data, selectedId);
    return found ? found.obj : null;
  }, [selectedId, data]);
  const selectedObjects = useMemo(() => {
    const out = [];
    for (const id of selectedIds) {
      const f = findObjectById(data, id);
      if (f) out.push(f);
    }
    return out;
  }, [selectedIds, data]);
  const selectionBounds = useMemo(() => {
    const list = selectedObjects.map(s => getObjectBounds(s.obj));
    return unionBounds(list);
  }, [selectedObjects]);

  // -------- stats / warnings / estimate --------
  const stats = useMemo(() => computeStats(data, level.type), [data, level.type]);
  const warnings = useMemo(() => {
    const base = getValidationWarnings(data, level.type);
    if (window.plGetBackgroundsWarnings) {
      const otherCount = (data.walls?.length || 0) + (data.rooms?.length || 0) + ((data.roof?.contour?.length || 0) >= 3 ? 1 : 0);
      return [...base, ...window.plGetBackgroundsWarnings(data.backgrounds || [], otherCount)];
    }
    return base;
  }, [data, level.type]);
  const estimateDraft = useMemo(() => getEstimateDraft(data, level.type), [data, level.type]);

  // -------- Keyboard --------
  useEffect(() => {
    const isField = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    const down = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) doRedo(); else doUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); doRedo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (saveToStorage(project)) { setSavedAt(new Date()); window.showToast({ title: "Проект сохранён" }); } return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        // select all visible + unlocked objects on this level
        const all = iterAllObjects(data)
          .filter(({ obj, kind }) => {
            const lid = layerOf(obj, kind);
            const l = layerById[lid];
            return !(l && (l.visible === false || l.locked));
          })
          .map(({ obj }) => obj.id);
        setSelectedIds(all);
        return;
      }
      if (isField(e.target)) return;
      if (e.code === "Space") { e.preventDefault(); setSpaceDown(true); return; }
      if (e.key === "Alt" || e.altKey) { setAltDown(true); }
      if (e.key === "Escape") {
        if (calibrationMode) { cancelCalibration(); return; }
        if (bgDrag) { setBgDrag(null); return; }
        setWallDrag(null); setRoomStart(null); setContourPts([]);
        setLinePending(null); setSegDrag(null);
        setMoveDrag(null); setResizeDrag(null); setEndpointDrag(null);
        setSelectedIds([]); setHandleDrag(null);
        if (tool !== "select" && tool !== "hand") setTool("select");
        return;
      }
      if (e.key === "f" && selectedId) { fitToSelection(); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0) { e.preventDefault(); handleDeleteSelected(); return; }
      const ts = TOOLSETS[mode] || TOOLSETS.plan;
      for (const t of ts) {
        if (!t.sep && t.kbd && t.kbd.toLowerCase() === e.key.toLowerCase()) {
          setTool(t.id); setWallDrag(null); setRoomStart(null); setContourPts([]); setLinePending(null); setSegDrag(null);
          return;
        }
      }
    };
    const up = (e) => {
      if (e.code === "Space") setSpaceDown(false);
      if (e.key === "Alt" || !e.altKey) setAltDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
    // eslint-disable-next-line
  }, [mode, selectedIds, data, layerById, project, tool]);

  useEffect(() => { setWallDrag(null); setRoomStart(null); setContourPts([]); }, [tool]);

  // -------- Autosave --------
  useEffect(() => {
    const t = setTimeout(() => {
      if (saveToStorage(project)) setSavedAt(new Date());
    }, 800);
    return () => clearTimeout(t);
  }, [project]);

  // -------- Container resize / initial fit --------
  const initialFitDoneRef = useRef(false);
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const prevW = containerSize.current.w;
      containerSize.current = { w: r.width, h: r.height };
      // If first time we know real size, auto-fit current level
      if (!initialFitDoneRef.current && r.width > 100 && r.height > 100) {
        initialFitDoneRef.current = true;
        const lv = project.levelsView && project.levelsView[project.activeLevelId];
        const isDefault = !lv || (Math.abs(lv.panX - 80) < 1 && Math.abs(lv.panY - 80) < 1 && Math.abs(lv.zoom - 0.6) < 0.001);
        if (isDefault) {
          const b = getLevelBounds(data);
          // Empty level — start with a comfortable 30×20 m visible area instead of zooming out to whole world
          const fitB = b || { x: 0, y: 0, w: Math.min(30, world.w), h: Math.min(20, world.h) };
          const next = fitBoundsToView(fitB, r.width, r.height, 60);
          if (next) setViewState(next, true);
        }
      }
      if (Math.abs(prevW - r.width) > 0.5) bumpUI();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line
  }, []);

  // Auto-fit when switching levels (always if user explicitly switches)
  useEffect(() => {
    setTimeout(() => fitToObject(true), 30);
    // eslint-disable-next-line
  }, [project.activeLevelId]);

  // -------- Fit helpers --------
  function fitToBounds(bounds, padding = 80) {
    const sz = containerSize.current;
    const next = fitBoundsToView(bounds, sz.w, sz.h, padding);
    if (next) setViewState(next, true);
  }
  function fitToWorld() {
    fitToBounds({ x: 0, y: 0, w: world.w, h: world.h }, 40);
  }
  function fitToObject(quiet) {
    const b = getLevelBounds(data);
    if (b) fitToBounds(b, 80);
    else fitToBounds({ x: 0, y: 0, w: Math.min(30, world.w), h: Math.min(20, world.h) }, 60);
    if (!quiet) window.showToast({ title: "Показать объект", body: b ? "Подгонка по габаритам построенных элементов" : "На уровне нет элементов — показан стартовый участок", kind: "info" });
  }
  function fitToSelection() {
    if (!selected) { window.showToast({ title: "Сначала выберите элемент", kind: "info" }); return; }
    const b = getObjectBounds(selected);
    if (!b) return;
    // Pad selected nicely
    fitToBounds({ x: b.x - 1, y: b.y - 1, w: b.w + 2, h: b.h + 2 }, 80);
  }
  function setZoom100() {
    const sz = containerSize.current;
    const z = 1;
    // Keep world center fixed
    const cx = sz.w / 2, cy = sz.h / 2;
    const wp = screenToWorld(cx, cy, viewState);
    setViewState({
      zoom: z,
      panX: cx - wp.x * PX_PER_M * z,
      panY: cy - wp.y * PX_PER_M * z,
    }, true);
  }
  function zoomAtPoint(scaleBy, sx, sy) {
    const newZoom = clampZoom(viewState.zoom * scaleBy);
    const wp = screenToWorld(sx, sy, viewState);
    setViewState({
      zoom: newZoom,
      panX: sx - wp.x * PX_PER_M * newZoom,
      panY: sy - wp.y * PX_PER_M * newZoom,
    }, true);
  }
  function zoomFromCenter(scaleBy) {
    const sz = containerSize.current;
    zoomAtPoint(scaleBy, sz.w / 2, sz.h / 2);
  }
  function panBy(dx, dy) {
    setViewState(v => ({ ...v, panX: v.panX + dx, panY: v.panY + dy }), true);
  }

  // -------- Canvas actions --------
  function handleCanvasClick(point) {
    if (calibrationMode) { handleCalibrationCanvasClick(point); return; }
    if (tool === "select") return;
    setActiveTemplateId(null);
    if (isWallTool) return;

    if (isRoomTool) {
      const snapped = altDown ? point : { x: snapToGrid(point.x, gridSize), y: snapToGrid(point.y, gridSize) };
      if (!roomStart) { setRoomStart(snapped); return; }
      const x = Math.min(roomStart.x, snapped.x), y = Math.min(roomStart.y, snapped.y);
      const w = Math.abs(snapped.x - roomStart.x), h = Math.abs(snapped.y - roomStart.y);
      setRoomStart(null);
      if (w < 0.5 || h < 0.5) { window.showToast({ title: "Слишком маленькая комната", kind: "info" }); return; }
      const idx = data.rooms.length;
      setRooms(rs => [...rs, { id: `R-${Date.now()}`, name: tool === "zone" ? `Зона ${idx+1}` : `Помещение ${idx+1}`, x, y, w, h, color: ROOM_COLORS[idx % ROOM_COLORS.length], geometryType: "rect", layerId: "L-rooms", roomType: "Жилая", height: 2.8 }]);
      window.showToast({ title: tool === "zone" ? "Зона добавлена" : "Комната добавлена", body: `${w.toFixed(1)} × ${h.toFixed(1)} м` });
      return;
    }

    if (isPlaceTool) {
      const hit = findNearestWall(data.walls, point, 0.7);
      if (!hit) { window.showToast({ title: "Кликните по стене", body: "Окна и двери ставятся на стены", kind: "info" }); return; }
      const size = tool === "window" ? 1.5 : tool === "door" ? 0.9 : 1.0;
      const half = size / 2;
      const { wall, t } = hit;
      let a, b;
      if (wallIsH(wall)) {
        const click = wall.x1 + t * (wall.x2 - wall.x1);
        const sx = altDown ? click : snapToGrid(click, gridSize);
        const minX = Math.min(wall.x1, wall.x2), maxX = Math.max(wall.x1, wall.x2);
        a = Math.max(minX + 0.2, sx - half); b = Math.min(maxX - 0.2, a + size);
      } else {
        const click = wall.y1 + t * (wall.y2 - wall.y1);
        const sy = altDown ? click : snapToGrid(click, gridSize);
        const minY = Math.min(wall.y1, wall.y2), maxY = Math.max(wall.y1, wall.y2);
        a = Math.max(minY + 0.2, sy - half); b = Math.min(maxY - 0.2, a + size);
      }
      if (b - a < 0.4) { window.showToast({ title: "Стена слишком короткая", kind: "info" }); return; }
      const stamp = Date.now();
      if (tool === "window") setWindows(ws => [...ws, { id: `WN-${stamp}`, on: wall.id, a, b, layerId: "L-openings" }]);
      else if (tool === "door") setDoors(ds => [...ds, { id: `D-${stamp}`, on: wall.id, a, b, swing: "in", layerId: "L-openings" }]);
      else setOpenings(os => [...os, { id: `O-${stamp}`, on: wall.id, a, b, layerId: "L-openings" }]);
      window.showToast({ title: tool === "window" ? "Окно добавлено" : tool === "door" ? "Дверь добавлена" : "Проём добавлен" });
      return;
    }

    if (tool === "aerator" || tool === "drain") {
      const snapped = altDown ? point : { x: snapToGrid(point.x, gridSize), y: snapToGrid(point.y, gridSize) };
      const stamp = Date.now();
      if (tool === "aerator") setRoof(r => ({ ...r, aerators: [...(r.aerators || []), { id: `AER-${stamp}`, x: snapped.x, y: snapped.y, layerId: "L-aerators" }] }));
      else setRoof(r => ({ ...r, drains: [...(r.drains || []), { id: `DRN-${stamp}`, x: snapped.x, y: snapped.y, layerId: "L-drains" }] }));
      window.showToast({ title: tool === "aerator" ? "Аэратор добавлен" : "Воронка добавлена" });
      return;
    }

    if (tool === "engout") {
      const snapped = altDown ? point : { x: snapToGrid(point.x, gridSize), y: snapToGrid(point.y, gridSize) };
      const stamp = Date.now();
      setRoof(r => ({ ...r, engouts: [...(r.engouts || []), { id: `EGO-${stamp}`, x: snapped.x, y: snapped.y, engoutType: "Вентиляционная шахта", width: 1, height: 1, layerId: "L-engouts" }] }));
      window.showToast({ title: "Инж. выход добавлен" });
      return;
    }

    if (tool === "note") {
      const snapped = altDown ? point : { x: snapToGrid(point.x, gridSize), y: snapToGrid(point.y, gridSize) };
      const stamp = Date.now();
      const note = { id: `NOTE-${stamp}`, x: snapped.x, y: snapped.y, text: "Новая заметка", color: "#B45309", author: "Я", createdAt: new Date().toISOString(), layerId: "L-notes" };
      setNotes(ns => [...ns, note]);
      setSelectedIds([note.id]);
      setTool("select");
      window.showToast({ title: "Заметка добавлена", body: "Отредактируйте текст в инспекторе" });
      return;
    }

    // 2-click line tools: dim / parapet / junction / slope
    if (isLineTool) {
      const snapped = altDown ? point : { x: snapToGrid(point.x, gridSize), y: snapToGrid(point.y, gridSize) };
      if (!linePending) { setLinePending(snapped); return; }
      const dx = snapped.x - linePending.x, dy = snapped.y - linePending.y;
      const len = Math.hypot(dx, dy);
      setLinePending(null);
      if (len < 0.2) return;
      const stamp = Date.now();
      if (tool === "dim") {
        const dim = { id: `DIM-${stamp}`, x1: linePending.x, y1: linePending.y, x2: snapped.x, y2: snapped.y, precision: 2, layerId: "L-dims", includeInExport: true };
        setDimensions(ds => [...ds, dim]);
        window.showToast({ title: "Размер добавлен", body: `${len.toFixed(2)} м` });
      } else if (tool === "parapet") {
        const par = { id: `PRP-${stamp}`, type: "parapet", x1: linePending.x, y1: linePending.y, x2: snapped.x, y2: snapped.y, length: len, height: 0.5, material: "Парапет металлический", nodeType: "стандарт", includeInEstimate: true, layerId: "L-parapets" };
        setRoof(r => ({ ...r, parapets: [...(r.parapets || []), par] }));
        window.showToast({ title: "Парапет добавлен", body: `${len.toFixed(2)} м` });
      } else if (tool === "junction") {
        const j = { id: `JCT-${stamp}`, type: "junction", x1: linePending.x, y1: linePending.y, x2: snapped.x, y2: snapped.y, length: len, junctionType: "к стене", height: 0.3, material: "Узел примыкания", comment: "", includeInEstimate: true, layerId: "L-junctions" };
        setRoof(r => ({ ...r, junctions: [...(r.junctions || []), j] }));
        window.showToast({ title: "Примыкание добавлено", body: `${len.toFixed(2)} м` });
      } else if (tool === "slope") {
        const s = { id: `SLP-${stamp}`, x1: linePending.x, y1: linePending.y, x2: snapped.x, y2: snapped.y, percent: 1.5, label: "1.5%", layerId: "L-slopes" };
        setRoof(r => ({ ...r, slopes: [...(r.slopes || []), s] }));
        window.showToast({ title: "Уклон добавлен" });
      }
      return;
    }

    if (isRoofContourTool) {
      const snapped = altDown ? point : { x: snapToGrid(point.x, gridSize), y: snapToGrid(point.y, gridSize) };
      if (contourPts.length >= 3) {
        const first = contourPts[0];
        if (Math.hypot(first.x - snapped.x, first.y - snapped.y) < 0.6) {
          setRoof(r => ({ ...r, contour: contourPts }));
          setContourPts([]);
          window.showToast({ title: "Контур кровли создан", body: `${contourPts.length} углов · ${polygonArea(contourPts).toFixed(1)} м²` });
          return;
        }
      }
      setContourPts(pts => [...pts, snapped]);
      return;
    }
  }

  function handleWallDragStart(point) {
    if (!isWallTool) return;
    const snapped = { x: snapToGrid(point.x, gridSize), y: snapToGrid(point.y, gridSize) };
    setWallDrag({ start: snapped, end: snapped });
    setActiveTemplateId(null);
  }
  function handleWallDragMove(point) {
    if (!wallDrag) return;
    setWallDrag(prev => prev ? { ...prev, end: { x: snapToGrid(point.x, gridSize), y: snapToGrid(point.y, gridSize) } } : null);
  }
  function handleWallDragEnd(point) {
    if (!wallDrag) return;
    const snapped = { x: snapToGrid(point.x, gridSize), y: snapToGrid(point.y, gridSize) };
    const end = axisLock(wallDrag.start, snapped);
    const len = Math.hypot(end.x - wallDrag.start.x, end.y - wallDrag.start.y);
    setWallDrag(null);
    if (len < 0.4) return;
    const newWall = { id: `W-${Date.now()}-${Math.floor(Math.random()*99)}`, type: tool === "wall" ? "external" : "internal", x1: wallDrag.start.x, y1: wallDrag.start.y, x2: end.x, y2: end.y };
    setWalls(ws => [...ws, newWall]);
  }

  function handleCanvasHover(point) {
    setHoverPoint(point);
    if (calibrationMode) {
      setSnappedCursor(altDown ? { x: point.x, y: point.y } : { x: snapToGrid(point.x, gridSize), y: snapToGrid(point.y, gridSize) });
      return;
    }
    if (isWallTool || isRoomTool || isRoofPointTool || isRoofContourTool) {
      setSnappedCursor({ x: snapToGrid(point.x, gridSize), y: snapToGrid(point.y, gridSize) });
    } else if (isPlaceTool) {
      const hit = findNearestWall(data.walls, point, 0.7);
      setSnappedCursor(hit ? { onWall: true, wall: hit.wall, t: hit.t } : { onWall: false, x: point.x, y: point.y });
    } else {
      setSnappedCursor(null);
    }
  }

  function handleDeleteSelected() {
    if (selectedIds.length === 0) return;
    const ids = new Set(selectedIds);
    // Check locked layer
    const blocked = selectedObjects.filter(({ obj, kind }) => isLayerLocked(layerOf(obj, kind))).length;
    if (blocked === selectedIds.length) { window.showToast({ title: "Все выбранные на заблокированных слоях", kind: "info" }); return; }
    const isAllowed = (obj, kind) => !isLayerLocked(layerOf(obj, kind));
    setProject(p => {
      const cur = p.levelsData[p.activeLevelId];
      const next = {
        ...cur,
        walls:    (cur.walls    || []).filter(w => !ids.has(w.id) || !isAllowed(w, "wall_external")),
        windows:  (cur.windows  || []).filter(w => !ids.has(w.id) || !isAllowed(w, "window")),
        doors:    (cur.doors    || []).filter(d => !ids.has(d.id) || !isAllowed(d, "door")),
        openings: (cur.openings || []).filter(o => !ids.has(o.id) || !isAllowed(o, "opening")),
        rooms:    (cur.rooms    || []).filter(r => !ids.has(r.id) || !isAllowed(r, "room")),
        dimensions: (cur.dimensions || []).filter(d => !ids.has(d.id) || !isAllowed(d, "dimension")),
        notes:    (cur.notes || []).filter(n => !ids.has(n.id) || !isAllowed(n, "note")),
        roof: cur.roof ? {
          ...cur.roof,
          aerators:  (cur.roof.aerators  || []).filter(o => !ids.has(o.id) || !isAllowed(o, "aerator")),
          drains:    (cur.roof.drains    || []).filter(o => !ids.has(o.id) || !isAllowed(o, "drain")),
          slopes:    (cur.roof.slopes    || []).filter(o => !ids.has(o.id) || !isAllowed(o, "slope")),
          segments:  (cur.roof.segments  || []).filter(o => !ids.has(o.id) || !isAllowed(o, "segment")),
          parapets:  (cur.roof.parapets  || []).filter(o => !ids.has(o.id) || !isAllowed(o, "parapet")),
          junctions: (cur.roof.junctions || []).filter(o => !ids.has(o.id) || !isAllowed(o, "junction")),
          engouts:   (cur.roof.engouts   || []).filter(o => !ids.has(o.id) || !isAllowed(o, "engout")),
        } : null,
      };
      return { ...p, levelsData: { ...p.levelsData, [p.activeLevelId]: next } };
    });
    setSelectedIds([]);
    window.showToast({ title: ids.size === 1 ? "Элемент удалён" : `${ids.size} элементов удалено`, kind: "info" });
  }

  // -------- Wall endpoint drag (handles) --------
  function handleWallHandleDragStart(wallId, end) {
    pushHistoryNow();
    setHandleDrag({ wallId, end });
  }
  function handleWallHandleDragMove(point) {
    if (!handleDrag) return;
    const snapped = { x: snapToGrid(point.x, gridSize), y: snapToGrid(point.y, gridSize) };
    setWalls(ws => ws.map(w => {
      if (w.id !== handleDrag.wallId) return w;
      const isH = wallIsH(w);
      // Maintain axis-aligned: if it was horizontal, keep y of the moving end equal to other end's y; else x.
      if (isH) {
        if (handleDrag.end === "start") return { ...w, x1: snapped.x, y1: w.y2 };
        else return { ...w, x2: snapped.x, y2: w.y1 };
      } else {
        if (handleDrag.end === "start") return { ...w, y1: snapped.y, x1: w.x2 };
        else return { ...w, y2: snapped.y, x2: w.x1 };
      }
    }), { skipHistory: true });
  }
  function handleWallHandleDragEnd() {
    if (!handleDrag) return;
    setHandleDrag(null);
  }

  // -------- Generic patching by id, kind --------
  function patchObjectById(id, patch, opts) {
    setProject(p => {
      const cur = p.levelsData[p.activeLevelId];
      const apply = arr => (arr || []).map(o => o.id === id ? { ...o, ...patch } : o);
      const next = {
        ...cur,
        walls: apply(cur.walls), windows: apply(cur.windows), doors: apply(cur.doors),
        openings: apply(cur.openings), rooms: apply(cur.rooms),
        dimensions: apply(cur.dimensions), notes: apply(cur.notes),
        roof: cur.roof ? {
          ...cur.roof,
          aerators: apply(cur.roof.aerators), drains: apply(cur.roof.drains),
          slopes: apply(cur.roof.slopes), segments: apply(cur.roof.segments),
          parapets: apply(cur.roof.parapets), junctions: apply(cur.roof.junctions), engouts: apply(cur.roof.engouts),
        } : null,
      };
      return { ...p, levelsData: { ...p.levelsData, [p.activeLevelId]: next } };
    }, opts);
  }

  // ===== Move drag: window/door/opening along wall, aerator/drain/engout/note free =====
  function startMoveDrag(id, kind, startWorld) {
    const found = findObjectById(data, id);
    if (!found) return;
    if (isLayerLocked(layerOf(found.obj, kind))) return;
    pushHistoryNow();
    setMoveDrag({ id, kind, start: startWorld, snapshot: JSON.parse(JSON.stringify(found.obj)) });
  }
  function applyMoveDrag(point) {
    if (!moveDrag) return;
    const dx = point.x - moveDrag.start.x;
    const dy = point.y - moveDrag.start.y;
    const snap = (v) => altDown ? v : snapToGrid(v, gridSize);
    const kind = moveDrag.kind;
    if (kind === "window" || kind === "door" || kind === "opening") {
      // slide along wall
      const wall = data.walls.find(w => w.id === moveDrag.snapshot.on);
      if (!wall) return;
      const isH = wallIsH(wall);
      const orig = moveDrag.snapshot;
      const width = orig.b - orig.a;
      let centerWorld = (orig.a + orig.b) / 2 + (isH ? dx : dy);
      let snapped = altDown ? centerWorld : snapToGrid(centerWorld, gridSize);
      let a = snapped - width / 2, b = snapped + width / 2;
      const { a: lo, b: hi } = wallAxisBounds(wall);
      const margin = 0.05;
      if (a < lo + margin) { a = lo + margin; b = a + width; }
      if (b > hi - margin) { b = hi - margin; a = b - width; }
      patchObjectById(orig.id, { a, b }, { skipHistory: true });
    } else if (kind === "note" || kind === "aerator" || kind === "drain" || kind === "engout") {
      const orig = moveDrag.snapshot;
      const nx = snap(orig.x + dx), ny = snap(orig.y + dy);
      patchObjectById(orig.id, { x: nx, y: ny }, { skipHistory: true });
    } else if (kind === "segment") {
      const orig = moveDrag.snapshot;
      const nx = snap(orig.x + dx), ny = snap(orig.y + dy);
      patchObjectById(orig.id, { x: nx, y: ny }, { skipHistory: true });
    } else if (kind === "room") {
      const orig = moveDrag.snapshot;
      const nx = snap(orig.x + dx), ny = snap(orig.y + dy);
      patchObjectById(orig.id, { x: nx, y: ny }, { skipHistory: true });
    } else if (kind === "parapet" || kind === "junction" || kind === "slope" || kind === "dimension") {
      const orig = moveDrag.snapshot;
      const ndx = snap(orig.x1 + dx) - orig.x1;
      const ndy = snap(orig.y1 + dy) - orig.y1;
      patchObjectById(orig.id, { x1: orig.x1 + ndx, y1: orig.y1 + ndy, x2: orig.x2 + ndx, y2: orig.y2 + ndy }, { skipHistory: true });
    }
  }
  function endMoveDrag() {
    if (!moveDrag) return;
    setMoveDrag(null);
  }

  // ===== Resize drag: rooms / segments via 8 handles =====
  function startResizeDrag(id, kind, handle, startWorld) {
    const found = findObjectById(data, id);
    if (!found) return;
    if (isLayerLocked(layerOf(found.obj, kind))) return;
    pushHistoryNow();
    setResizeDrag({ id, kind, handle, start: startWorld, snapshot: JSON.parse(JSON.stringify(found.obj)) });
  }
  function applyResizeDrag(point) {
    if (!resizeDrag) return;
    const orig = resizeDrag.snapshot;
    const snap = (v) => altDown ? v : snapToGrid(v, gridSize);
    let x = orig.x, y = orig.y, w = orig.w, h = orig.h;
    const handle = resizeDrag.handle;
    if (handle.includes("w")) { const nx = snap(point.x); w = w + (x - nx); x = nx; }
    if (handle.includes("e")) { const nx = snap(point.x); w = nx - x; }
    if (handle.includes("n")) { const ny = snap(point.y); h = h + (y - ny); y = ny; }
    if (handle.includes("s")) { const ny = snap(point.y); h = ny - y; }
    if (w < 0.3) { x = orig.x + orig.w - 0.3; w = 0.3; }
    if (h < 0.3) { y = orig.y + orig.h - 0.3; h = 0.3; }
    patchObjectById(orig.id, { x, y, w, h }, { skipHistory: true });
  }
  function endResizeDrag() {
    if (!resizeDrag) return;
    setResizeDrag(null);
  }

  // ===== Endpoint drag: line objects (dim/parapet/junction/slope) =====
  function startEndpointDrag(id, kind, end, startWorld) {
    const found = findObjectById(data, id);
    if (!found) return;
    if (isLayerLocked(layerOf(found.obj, kind))) return;
    pushHistoryNow();
    setEndpointDrag({ id, kind, end, start: startWorld, snapshot: JSON.parse(JSON.stringify(found.obj)) });
  }
  function applyEndpointDrag(point) {
    if (!endpointDrag) return;
    const orig = endpointDrag.snapshot;
    const snap = (v) => altDown ? v : snapToGrid(v, gridSize);
    const np = { x: snap(point.x), y: snap(point.y) };
    const patch = endpointDrag.end === "a"
      ? { x1: np.x, y1: np.y }
      : { x2: np.x, y2: np.y };
    if (endpointDrag.kind === "parapet" || endpointDrag.kind === "junction") {
      const x1 = endpointDrag.end === "a" ? np.x : orig.x1;
      const y1 = endpointDrag.end === "a" ? np.y : orig.y1;
      const x2 = endpointDrag.end === "b" ? np.x : orig.x2;
      const y2 = endpointDrag.end === "b" ? np.y : orig.y2;
      patch.length = Math.hypot(x2 - x1, y2 - y1);
    }
    patchObjectById(orig.id, patch, { skipHistory: true });
  }
  function endEndpointDrag() {
    if (!endpointDrag) return;
    setEndpointDrag(null);
  }

  // ===== Segment-draw (drag from corner to corner) =====
  function startSegmentDraw(startWorld) {
    const snapped = altDown ? startWorld : { x: snapToGrid(startWorld.x, gridSize), y: snapToGrid(startWorld.y, gridSize) };
    setSegDrag({ start: snapped, end: snapped });
  }
  function moveSegmentDraw(point) {
    if (!segDrag) return;
    const snapped = altDown ? point : { x: snapToGrid(point.x, gridSize), y: snapToGrid(point.y, gridSize) };
    setSegDrag(prev => prev ? { ...prev, end: snapped } : null);
  }
  function endSegmentDraw() {
    if (!segDrag) return;
    const { start, end } = segDrag;
    setSegDrag(null);
    const x = Math.min(start.x, end.x), y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x), h = Math.abs(end.y - start.y);
    if (w < 0.5 || h < 0.5) return;
    const stamp = Date.now();
    const idx = (data.roof?.segments || []).length + 1;
    const seg = {
      id: `SEG-${stamp}`, name: `Секция ${idx} · ${(w*h).toFixed(0)} м²`,
      x, y, w, h, area: w * h,
      material: data.roof?.material || "ПВХ-мембрана",
      status: "Не обследовано", slope: data.roof?.slope || 1.5,
      comment: "", includeInEstimate: true, layerId: "L-segments",
    };
    setRoof(r => ({ ...r, segments: [...(r.segments || []), seg] }));
    window.showToast({ title: "Сегмент добавлен", body: `${(w*h).toFixed(1)} м²` });
  }

  // ===== Add parapet by contour =====
  function handleAddParapetByContour() {
    const c = data.roof?.contour;
    if (!c || c.length < 3) { window.showToast({ title: "Сначала обведите контур кровли", kind: "info" }); return; }
    const stamp = Date.now();
    const parapets = window.plBuildParapetsFromContour(c, stamp, { height: data.roof?.parapetHeight || 0.5 });
    setRoof(r => ({ ...r, parapets: [...(r.parapets || []), ...parapets] }));
    window.showToast({ title: "Парапет создан по контуру", body: `${parapets.length} сторон` });
  }

  // ===== Contour vertex drag =====
  function startContourVertexDrag(idx) {
    const c = data.roof?.contour;
    if (!c || !c[idx]) return;
    pushHistoryNow();
    setContourVertexDrag({ idx, snapshot: JSON.parse(JSON.stringify(c)) });
  }
  function applyContourVertexDrag(point) {
    if (!contourVertexDrag) return;
    const snap = (v) => altDown ? v : snapToGrid(v, gridSize);
    let np = { x: snap(point.x), y: snap(point.y) };
    // Shift = axis-aligned with previous vertex
    if (typeof window !== "undefined" && window.event && window.event.shiftKey) {
      const prev = contourVertexDrag.snapshot[(contourVertexDrag.idx - 1 + contourVertexDrag.snapshot.length) % contourVertexDrag.snapshot.length];
      np = axisLock(prev, np);
    }
    setRoof(r => {
      const c = [...(r.contour || [])];
      c[contourVertexDrag.idx] = np;
      return { ...r, contour: c };
    }, { skipHistory: true });
  }
  function endContourVertexDrag() {
    if (!contourVertexDrag) return;
    setContourVertexDrag(null);
  }

  // ===== Create rectangular roof (preset / custom) =====
  function handleCreateRectRoof(w, h, withParapet = true) {
    const stamp = Date.now();
    const contour = window.plMakeRectRoofContour(w, h, { padX: 4, padY: 4 });
    // Replace contour
    setRoof(r => {
      const next = { ...r, contour };
      if (withParapet) {
        next.parapets = window.plBuildParapetsFromContour(contour, stamp, { height: r.parapetHeight || 0.5 });
      }
      return next;
    });
    // Choose grid + auto-fit
    setGridSize(w >= 30 ? 10 : 5);
    setTimeout(() => {
      const b = { x: 0, y: 0, w: w + 8, h: h + 8 };
      const sz = containerSize.current;
      const next = fitBoundsToView(b, sz.w, sz.h, 80);
      if (next) setViewState(next, true);
    }, 30);
    window.showToast({ title: "Прямоугольная кровля создана", body: `${w} × ${h} м · ${(w*h).toFixed(0)} м²` });
  }

  // ===== Apply demo industrial roof to active level =====
  function handleApplyDemoRoof() {
    // Make sure the level is industrial_roof
    const demo = window.plMakeDemoIndustrialRoof(Date.now());
    setProject(p => {
      const levels = p.levels.map(l => l.id === p.activeLevelId ? { ...l, type: "industrial_roof", name: l.name || "Пром. кровля", world: { w: 60, h: 70 } } : l);
      const cur = p.levelsData[p.activeLevelId] || {};
      const nextLevel = { ...cur, roof: demo, layers: defaultLayersForType("industrial_roof") };
      return { ...p, levels, levelsData: { ...p.levelsData, [p.activeLevelId]: nextLevel } };
    });
    setMode("roof");
    setGridSize(10);
    setSelectedIds([]);
    setTimeout(() => fitToObject(true), 60);
    window.showToast({ title: "Демо: Кровля 2000 м²", body: "Загружен показательный объект с warnings и сметой" });
  }

  // ===== Check roof — switch inspector to "warns" + mark verdict =====
  function handleCheckRoof() {
    setRoofCheckRunAt(new Date());
    setInspectorTab("warns");
    window.showToast({
      title: warnings.length === 0 ? "Кровля проверена — без замечаний" : `Найдено замечаний: ${warnings.length}`,
      body: warnings.length === 0 ? "Готова к черновому расчёту" : "Откройте вкладку «Замечания»",
      kind: warnings.some(w => w.level === "error") ? "info" : "info",
    });
  }

  // Quick-select-and-fit: used from segment list / warnings
  function selectAndFit(id) {
    if (!id) return;
    setSelectedIds([id]);
    setTimeout(() => {
      const f = findObjectById(data, id);
      if (!f) return;
      const b = getObjectBounds(f.obj);
      if (b) {
        fitToBounds({ x: b.x - 1.5, y: b.y - 1.5, w: b.w + 3, h: b.h + 3 }, 80);
      }
    }, 30);
  }

  // Create a new roof level using current level's external wall bounds.
  function handleCreateRoofFromContour(overhang = 0.5) {
    const bounds = window.plGetExternalBounds(data);
    if (!bounds || bounds.w < 0.5 || bounds.h < 0.5) {
      window.showToast({ title: "Внешний контур не найден", body: "Создайте внешние стены или используйте «Прямоугольная кровля»", kind: "info" });
      return;
    }
    const stamp = Date.now();
    const id = `L-R-${stamp}`;
    const lvlWorld = level.world || project.world;
    const roofLvl = window.plBuildRoofLevelFromBounds(bounds, overhang, { stamp, levelId: id, name: "Кровля", world: lvlWorld });
    setProject(p => ({
      ...p,
      levels: [...p.levels, { id, name: roofLvl.name, type: "roof", world: lvlWorld }],
      levelsData: { ...p.levelsData, [id]: {
        walls: roofLvl.walls, windows: roofLvl.windows, doors: roofLvl.doors, openings: roofLvl.openings,
        rooms: roofLvl.rooms, dimensions: roofLvl.dimensions, notes: roofLvl.notes,
        layers: roofLvl.layers, roof: roofLvl.roof,
      }},
      levelsView: { ...(p.levelsView || {}), [id]: defaultViewState() },
      activeLevelId: id,
    }));
    setMode("roof");
    setGridSize(1);
    setInspectorTab("params");
    setTimeout(() => fitToObject(true), 60);
    window.showToast({ title: "Кровля создана по габаритам этажа", body: `${(bounds.w + overhang * 2).toFixed(1)} × ${(bounds.h + overhang * 2).toFixed(1)} м · свес ${overhang} м`, kind: "info" });
  }

  // Project-wide check — collect warnings across all levels, switch to warns tab
  function handleCheckProject() {
    let total = 0;
    for (const lvl of project.levels) {
      const d = project.levelsData[lvl.id];
      if (!d) continue;
      total += getValidationWarnings(d, lvl.type).length;
    }
    setInspectorTab("warns");
    window.showToast({
      title: total === 0 ? "Проект проверен — без замечаний" : `Найдено замечаний: ${total}`,
      body: total === 0 ? "Готов к черновому расчёту" : "Откройте вкладку «Замечания»",
      kind: "info",
    });
  }
  function handleShowProjectEstimate() {
    setEstimateScope("project");
    setInspectorTab("calc");
  }

  // ===== RESULT CENTER + KP + EXPORT =====
  // Compute "all rows" with row overrides applied
  const allRowsRaw = useMemo(() => {
    if (estimateScope === "project") {
      return window.plGetProjectEstimateRows(project) || [];
    }
    return (estimateDraft || []).map(r => ({ ...r, levelName: level.name, levelId: level.id, levelType: level.type }));
  }, [estimateScope, project, estimateDraft, level.id, level.name, level.type]);

  const allRows = useMemo(() => {
    return allRowsRaw.map(r => {
      const ov = rowOverrides[r.id];
      if (!ov) return r;
      const next = { ...r };
      if (ov.unitPrice != null) {
        const mw = (next.mat + next.work) || 1;
        const ratio = ov.unitPrice / mw;
        next.mat = Math.round(next.mat * ratio);
        next.work = Math.round(next.work * ratio);
        next.total = (next.mat + next.work) * next.qty;
      }
      if (ov.include != null) next.include = ov.include;
      return next;
    });
  }, [allRowsRaw, rowOverrides]);

  const projectStats = useMemo(() => window.plGetProjectStats ? window.plGetProjectStats(project) : null, [project]);

  // Saved status flags
  const projectStatus = useMemo(() => {
    const hasWarn = warnings.some(w => w.level === "warn");
    const hasErr  = warnings.some(w => w.level === "error");
    return window.plGetProjectStatus({
      hasWarnings: hasWarn, hasErrors: hasErr,
      calculated: calculated || allRows.length > 0,
      hasProposal: !!lastProposalId,
      exported: !!lastExportAt,
    });
  }, [warnings, calculated, allRows.length, lastProposalId, lastExportAt]);

  function openResultCenter() {
    setResultCenterOpen(true);
    setCalculated(true);
  }
  function handleUpdateRowPrice(rowId, unitPrice) {
    setRowOverrides(ov => ({ ...ov, [rowId]: { ...(ov[rowId] || {}), unitPrice } }));
  }
  function handleToggleRowInclude(rowId) {
    setRowOverrides(ov => {
      const cur = ov[rowId] || {};
      const wasIncl = cur.include != null ? cur.include : true;
      return { ...ov, [rowId]: { ...cur, include: !wasIncl } };
    });
  }
  function handleOpenKpModal() {
    setKpModalOpen(true);
  }
  function handleGenerateKp(kp) {
    const total = allRows.filter(r => r.include !== false).reduce((s, r) => s + r.total, 0);
    const fullKp = {
      ...kp,
      total: Math.round(total),
      rowsSnapshot: allRows.map(r => ({
        id: r.id, group: r.group, name: r.name, qty: r.qty, unit: r.unit,
        mat: r.mat, work: r.work, total: r.total, include: r.include !== false, levelName: r.levelName,
      })),
    };
    window.plSaveGeneratedProposal(fullKp);
    setLastProposalId(fullKp.id);
    setKpModalOpen(false);
    setKpPreviewKp(fullKp);
    // Also save the estimate snapshot
    const estimate = {
      id: "EST-" + Date.now().toString(36).slice(-6).toUpperCase(),
      project: project.name,
      total: Math.round(total),
      status: "Готово к КП",
      statusColor: "success",
      createdAt: new Date().toISOString(),
      source: "Планировка",
      levelId: project.activeLevelId,
      proposalId: fullKp.id,
      rows: fullKp.rowsSnapshot,
    };
    window.plSaveGeneratedEstimate(estimate);
    window.showToast({ title: "КП сформировано", body: `${fullKp.id} · ₽ ${total.toLocaleString("ru-RU")}` });
  }
  function handleOpenProposalPreview(proposalId) {
    const list = window.plLoadGeneratedProposals() || [];
    const kp = list.find(k => k.id === proposalId);
    if (kp) setKpPreviewKp(kp);
  }
  function handleOpenExport(variant) {
    setExportVariant(variant);
    setLastExportAt(new Date());
  }
  function handlePrintKp() {
    document.body.classList.add("printing");
    document.body.dataset.printVariant = "proposal";
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove("printing");
        delete document.body.dataset.printVariant;
        setLastExportAt(new Date());
      }, 200);
    }, 50);
  }
  function handleCopyKpText() {
    if (!kpPreviewKp) return;
    const total = (kpPreviewKp.rowsSnapshot || []).reduce((s, r) => s + (r.include !== false ? r.total : 0), 0);
    const text = [
      `КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ ${kpPreviewKp.id}`,
      `Клиент: ${kpPreviewKp.client}`,
      `Объект: ${kpPreviewKp.object}`,
      `Дата: ${new Date(kpPreviewKp.createdAt).toLocaleDateString("ru-RU")}`,
      `Действует до: ${new Date(kpPreviewKp.validUntil).toLocaleDateString("ru-RU")}`,
      ``,
      `СОСТАВ РАБОТ`,
      ...(kpPreviewKp.rowsSnapshot || []).filter(r => r.include !== false).map(r =>
        `· ${r.name} — ${r.qty} ${r.unit} × ₽${Math.round((r.mat + r.work))} = ₽${Math.round(r.total).toLocaleString("ru-RU")}`),
      ``,
      `ИТОГО: ₽ ${Math.round(total).toLocaleString("ru-RU")}`,
      ``,
      `Условия оплаты: ${kpPreviewKp.payment}`,
      `Гарантия: ${kpPreviewKp.warranty}`,
      ``,
      `Расчёт предварительный. Финальную проверку выполняет специалист.`,
    ].join("\n");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      window.showToast({ title: "Текст КП скопирован", body: "Можно вставить в письмо или мессенджер." });
    } else {
      window.showToast({ title: "Скопировать не удалось", body: "Используйте кнопку «Печать / PDF».", kind: "info" });
    }
  }
  function handleSavedExportKp() {
    if (!kpPreviewKp) return;
    const total = (kpPreviewKp.rowsSnapshot || []).reduce((s, r) => s + (r.include !== false ? r.total : 0), 0);
    const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${kpPreviewKp.id} — ${kpPreviewKp.object || kpPreviewKp.project}</title></head><body><h1>КП ${kpPreviewKp.id}</h1><p>Клиент: ${kpPreviewKp.client}</p><p>Объект: ${kpPreviewKp.object}</p><p>Итого: ₽ ${Math.round(total).toLocaleString("ru-RU")}</p><p>${kpPreviewKp.payment}</p></body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kpPreviewKp.id}-${kpPreviewKp.object || "proposal"}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setLastExportAt(new Date());
    window.showToast({ title: "HTML сохранён", body: "Можно открыть и распечатать в браузере." });
  }

  // ===== PDF analysis / candidates =====
  function handleUpdateCandidate(id, group, patch) {
    setCandidates(c => ({
      ...c,
      [group]: (c[group] || []).map(x => x.id === id ? { ...x, ...patch } : x),
    }));
  }
  function handleAcceptAllCandidates() {
    setCandidates(c => {
      const next = {};
      for (const k of ["walls", "openings", "rooms", "annotations"]) {
        next[k] = (c[k] || []).map(x => ({ ...x, status: "accepted" }));
      }
      return next;
    });
    window.showToast({ title: "Все кандидаты приняты" });
  }
  function handleRejectAllCandidates() {
    setCandidates(c => {
      const next = {};
      for (const k of ["walls", "openings", "rooms", "annotations"]) {
        next[k] = (c[k] || []).map(x => ({ ...x, status: "rejected" }));
      }
      return next;
    });
  }
  function handleCommitCandidates() {
    pushHistoryNow();
    const merged = window.plCommitCandidatesToLevel(data, candidates);
    setProject(p => {
      const cur = p.levelsData[p.activeLevelId];
      const next = { ...cur,
        walls: merged.walls,
        windows: merged.windows,
        doors: merged.doors,
        rooms: merged.rooms,
        notes: merged.notes,
      };
      return { ...p, levelsData: { ...p.levelsData, [p.activeLevelId]: next } };
    }, { skipHistory: true });
    // Clear candidates after commit
    setCandidates({ walls: [], openings: [], rooms: [], annotations: [] });
    setPdfModalOpen(false);
    setTimeout(() => fitToObject(true), 60);
    const c = merged.counts;
    window.showToast({
      title: "Кандидаты конвертированы в объекты",
      body: `${c.walls} стен · ${c.windows + c.doors} проёмов · ${c.rooms} помещений · ${c.notes} аннотаций`,
    });
  }
  function handleJumpToCandidate(c) {
    if (c.x != null) {
      fitToBounds({ x: c.x - 1, y: c.y - 1, w: (c.w || 1) + 2, h: (c.h || 1) + 2 }, 100);
    } else if (c.x1 != null) {
      const minX = Math.min(c.x1, c.x2), maxX = Math.max(c.x1, c.x2);
      const minY = Math.min(c.y1, c.y2), maxY = Math.max(c.y1, c.y2);
      fitToBounds({ x: minX - 2, y: minY - 2, w: Math.max(1, maxX - minX) + 4, h: Math.max(1, maxY - minY) + 4 }, 100);
    }
    setPdfModalOpen(false);
    // Re-open after a moment so user sees the spot
    setTimeout(() => setPdfModalOpen(true), 1200);
  }
  function handleUsePdfAsBackground() {
    // Mock: create a placeholder underlay using demo background art
    const src = window.plMakeDemoBackgroundSrc();
    addBackground({ name: pdfAnalysis?.fileName || "PDF.pdf", src, imgWidth: 600, imgHeight: 480, defaultWorldWidth: 12 });
    setPdfModalOpen(false);
    setScenarioHintId("import_drawing");
  }
  // Demo Mode entry — load PDF demo without a real file
  function handleLoadPdfDemo() {
    const analysis = window.plBuildPdfAnalysisDemo();
    setPdfAnalysis(analysis);
    setCandidates(analysis.candidates);
    setPdfModalOpen(true);
    setScenarioHintId("pdf_takeoff");
  }

  // ===== BACKGROUNDS / underlays =====
  // Compute the world coords at the center of the current viewport — used
  // to place a freshly imported underlay at a sensible location.
  function getViewportCenterWorld() {
    const sz = containerSize.current;
    const cx = (sz.w / 2 - viewState.panX) / (PX_PER_M * viewState.zoom);
    const cy = (sz.h / 2 - viewState.panY) / (PX_PER_M * viewState.zoom);
    return { x: cx, y: cy };
  }

  function handleOpenImport(opts = {}) {
    importTargetRef.current = opts.autoCalibrate ? "open-calibrate" : null;
    if (importFileRef.current) {
      importFileRef.current.value = "";
      importFileRef.current.click();
    }
  }

  function handleImportFile(file) {
    if (!file) return;
    if (/^application\/pdf/i.test(file.type)) {
      // Mock-launch PDF analysis: open modal with demo data, named after file
      const analysis = window.plBuildPdfAnalysisDemo();
      analysis.fileName = file.name;
      analysis.fileSize = (file.size / (1024 * 1024)).toFixed(1) + " МБ";
      setPdfAnalysis(analysis);
      setCandidates(analysis.candidates);
      setPdfModalOpen(true);
      window.showToast({ title: "PDF загружен", body: `Анализ ${analysis.sheets.length} листов запущен`, kind: "info" });
      return;
    }
    if (!/^image\/(png|jpeg|jpg|webp)/i.test(file.type)) {
      window.showToast({ title: "Неподдерживаемый формат", body: "Загрузите PNG, JPG или WebP.", kind: "info" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target.result;
      const img = new Image();
      img.onload = () => {
        addBackground({ name: file.name, src, imgWidth: img.naturalWidth, imgHeight: img.naturalHeight });
      };
      img.onerror = () => window.showToast({ title: "Не удалось прочитать изображение", kind: "info" });
      img.src = src;
    };
    reader.onerror = () => window.showToast({ title: "Ошибка чтения файла", kind: "info" });
    reader.readAsDataURL(file);
  }

  function addBackground({ name, src, imgWidth, imgHeight, defaultWorldWidth }) {
    const viewCenter = getViewportCenterWorld();
    const bg = window.plBuildBackground({
      name, src, imgWidth, imgHeight,
      defaultWorldWidth: defaultWorldWidth || 12,
      viewCenter,
      opacity: 0.6, locked: true, visible: true,
    });
    setProject(p => {
      const cur = p.levelsData[p.activeLevelId] || {};
      const backgrounds = [...(cur.backgrounds || []), bg];
      return { ...p, levelsData: { ...p.levelsData, [p.activeLevelId]: { ...cur, backgrounds } } };
    });
    setInspectorTab("params");
    window.showToast({ title: "Подложка загружена", body: "Задайте масштаб по известному отрезку." });
    if (importTargetRef.current === "open-calibrate") {
      importTargetRef.current = null;
      setTimeout(() => startCalibration(bg.id), 200);
    }
  }

  function patchBackground(bgId, patch, opts = {}) {
    setProject(p => {
      const cur = p.levelsData[p.activeLevelId];
      const backgrounds = (cur.backgrounds || []).map(b => b.id === bgId ? { ...b, ...patch } : b);
      return { ...p, levelsData: { ...p.levelsData, [p.activeLevelId]: { ...cur, backgrounds } } };
    }, opts);
  }
  function deleteBackground(bgId) {
    setProject(p => {
      const cur = p.levelsData[p.activeLevelId];
      const backgrounds = (cur.backgrounds || []).filter(b => b.id !== bgId);
      return { ...p, levelsData: { ...p.levelsData, [p.activeLevelId]: { ...cur, backgrounds } } };
    });
    setSelectedIds(ids => ids.filter(x => x !== bgId));
    window.showToast({ title: "Подложка удалена" });
  }

  // Calibration flow: pressing the button starts mode. First canvas click sets p1.
  // Second click opens the modal asking for real length.
  function startCalibration(bgId) {
    const bg = (data.backgrounds || []).find(b => b.id === bgId);
    if (!bg) return;
    setCalibrationMode({ bgId });
    setCalibrationPending(null);
    window.showToast({ title: "Калибровка масштаба", body: "Кликните на чертеже начало и конец известного отрезка.", kind: "info" });
  }
  function cancelCalibration() {
    setCalibrationMode(null);
    setCalibrationPending(null);
    setCalibrationModal(null);
  }
  function applyCalibrationLength(realLengthMeters) {
    if (!calibrationModal) return;
    const { bgId, p1, p2 } = calibrationModal;
    const bg = (data.backgrounds || []).find(b => b.id === bgId);
    if (!bg) { cancelCalibration(); return; }
    pushHistoryNow();
    const updated = window.plCalibrateBackground(bg, p1, p2, realLengthMeters);
    patchBackground(bgId, updated, { skipHistory: true });
    cancelCalibration();
    window.showToast({ title: "Масштаб задан", body: `Отрезок ${realLengthMeters} м · ${updated.naturalWidth ? `${(updated.naturalWidth / updated.width).toFixed(0)} px/м` : ""}` });
  }
  // Click the existing calibration line to re-edit the real length.
  function handleCalibrationLineClick(bgId) {
    const bg = (data.backgrounds || []).find(b => b.id === bgId);
    if (!bg || !bg.calibrationLine) return;
    const cl = bg.calibrationLine;
    const measured = Math.hypot(cl.x2 - cl.x1, cl.y2 - cl.y1);
    setCalibrationModal({ bgId, p1: { x: cl.x1, y: cl.y1 }, p2: { x: cl.x2, y: cl.y2 }, measured, editing: true });
  }
  // Drag a calibration-line endpoint to update its position (without changing scale).
  function startCalibrationEndpointDrag(bgId, endpoint, snapshot) {
    pushHistoryNow();
    setCalibrationDrag({ bgId, endpoint, snapshot });
  }
  function applyCalibrationEndpointDrag(point) {
    if (!calibrationDrag) return;
    const { bgId, endpoint } = calibrationDrag;
    const bg = (data.backgrounds || []).find(b => b.id === bgId);
    if (!bg || !bg.calibrationLine) return;
    const cl = { ...bg.calibrationLine };
    if (endpoint === "a") { cl.x1 = point.x; cl.y1 = point.y; }
    else                  { cl.x2 = point.x; cl.y2 = point.y; }
    // Note: we keep realLength stable — user only repositions the line.
    // Compute new "measured" derived from line length for display, but real-length stays.
    patchBackground(bgId, { calibrationLine: cl }, { skipHistory: true });
  }
  function endCalibrationEndpointDrag() {
    setCalibrationDrag(null);
  }
  // Called by canvas onClick when calibrationMode is active
  function handleCalibrationCanvasClick(pt) {
    if (!calibrationMode) return;
    if (!calibrationPending) {
      setCalibrationPending({ bgId: calibrationMode.bgId, p1: pt });
    } else {
      const p1 = calibrationPending.p1;
      const measured = Math.hypot(pt.x - p1.x, pt.y - p1.y);
      if (measured < 0.05) {
        window.showToast({ title: "Слишком короткий отрезок", body: "Попробуйте ещё раз.", kind: "info" });
        return;
      }
      setCalibrationModal({ bgId: calibrationMode.bgId, p1, p2: pt, measured });
      setCalibrationPending(null);
    }
  }

  // Demo background — drops a sample plan into the active level
  function handleLoadDemoBackground() {
    const src = window.plMakeDemoBackgroundSrc();
    addBackground({ name: "Демо-план 12×9 м.svg", src, imgWidth: 600, imgHeight: 480, defaultWorldWidth: 12 });
    // Auto-calibrate: place a faux calibration line along the 12m label
    setTimeout(() => {
      setProject(p => {
        const cur = p.levelsData[p.activeLevelId];
        const list = cur.backgrounds || [];
        const last = list[list.length - 1];
        if (!last) return p;
        // The demo SVG was sized to be exactly 12m wide. Calibrate left→right of image.
        const p1 = { x: last.x + last.width * 0.1, y: last.y + last.height * 0.916 };
        const p2 = { x: last.x + last.width * 0.9, y: last.y + last.height * 0.916 };
        const updated = window.plCalibrateBackground(last, p1, p2, 12 * 0.8);
        const backgrounds = list.map(b => b.id === last.id ? updated : b);
        return { ...p, levelsData: { ...p.levelsData, [p.activeLevelId]: { ...cur, backgrounds } } };
      });
      setScenarioHintId("import_drawing");
    }, 250);
  }

  // ===== Background drag (move) =====
  function startBackgroundMoveDrag(bgId, anchor) {
    const bg = (data.backgrounds || []).find(b => b.id === bgId);
    if (!bg || bg.locked) return;
    pushHistoryNow();
    setBgDrag({ id: bgId, mode: "move", anchor, snapshot: { x: bg.x, y: bg.y } });
    setSelectedIds([bgId]);
  }
  function applyBackgroundDrag(pt) {
    if (!bgDrag) return;
    const bg = (data.backgrounds || []).find(b => b.id === bgDrag.id);
    if (!bg) return;
    if (bgDrag.mode === "move") {
      const dx = pt.x - bgDrag.anchor.x;
      const dy = pt.y - bgDrag.anchor.y;
      patchBackground(bgDrag.id, { x: bgDrag.snapshot.x + dx, y: bgDrag.snapshot.y + dy }, { skipHistory: true });
    } else if (bgDrag.mode === "resize") {
      const corner = bgDrag.corner;
      const s = bgDrag.snapshot;
      let nx = s.x, ny = s.y, nw = s.width, nh = s.height;
      // Anchor opposite corner
      const ar = s.width / s.height;
      if (corner === "se") {
        nw = Math.max(0.2, pt.x - s.x);
        nh = bgDrag.lockAspect ? nw / ar : Math.max(0.2, pt.y - s.y);
      } else if (corner === "ne") {
        nw = Math.max(0.2, pt.x - s.x);
        nh = bgDrag.lockAspect ? nw / ar : Math.max(0.2, (s.y + s.height) - pt.y);
        ny = bgDrag.lockAspect ? s.y + s.height - nh : pt.y;
      } else if (corner === "sw") {
        nw = Math.max(0.2, (s.x + s.width) - pt.x);
        nh = bgDrag.lockAspect ? nw / ar : Math.max(0.2, pt.y - s.y);
        nx = bgDrag.lockAspect ? s.x + s.width - nw : pt.x;
      } else if (corner === "nw") {
        nw = Math.max(0.2, (s.x + s.width) - pt.x);
        nh = bgDrag.lockAspect ? nw / ar : Math.max(0.2, (s.y + s.height) - pt.y);
        nx = bgDrag.lockAspect ? s.x + s.width - nw : pt.x;
        ny = bgDrag.lockAspect ? s.y + s.height - nh : pt.y;
      }
      patchBackground(bgDrag.id, { x: nx, y: ny, width: nw, height: nh }, { skipHistory: true });
    }
  }
  function endBackgroundDrag() { if (bgDrag) setBgDrag(null); }

  function startBackgroundResizeDrag(bgId, corner) {
    const bg = (data.backgrounds || []).find(b => b.id === bgId);
    if (!bg || bg.locked) return;
    pushHistoryNow();
    setBgDrag({ id: bgId, mode: "resize", corner, lockAspect: true, snapshot: { x: bg.x, y: bg.y, width: bg.width, height: bg.height } });
  }
  function handleBackgroundClick(e, bg) {
    // Unlocked underlay clicked — select & start move drag
    const pt = (() => {
      // We can't easily get world coords here without svgEventToWorld.
      // Defer to canvas pointer-handler-level drag start.
      return null;
    })();
    setSelectedIds([bg.id]);
  }
  function handleFitToBackgrounds() {
    const b = window.plGetBackgroundsBounds(data.backgrounds || []);
    if (b) fitToBounds({ x: b.x - 1, y: b.y - 1, w: b.w + 2, h: b.h + 2 }, 80);
  }

  // ===== Selection click handler — supports shift+click multi-select =====
  function handleObjectClick(obj, kind, e) {
    if (!obj) return;
    const lid = layerOf(obj, kind);
    if (isLayerLocked(lid)) return;
    if (isLayerHidden(lid)) return;
    const additive = e && (e.shiftKey || e.metaKey || e.ctrlKey);
    toggleSelection(obj.id, additive);
  }

  // -------- Inspector actions on selected element --------
  function updateSelectedWallLen(newLen) {
    const w = selected;
    if (!w || !("x1" in w)) return;
    const isH = wallIsH(w);
    setWalls(ws => ws.map(x => {
      if (x.id !== w.id) return x;
      const dirX = isH ? Math.sign(w.x2 - w.x1) || 1 : 0;
      const dirY = isH ? 0 : Math.sign(w.y2 - w.y1) || 1;
      const len = Math.max(0.4, +newLen);
      return { ...x, x2: w.x1 + dirX * len, y2: w.y1 + dirY * len };
    }));
  }
  function updateSelectedWallType(type) {
    setWalls(ws => ws.map(x => x.id === selected.id ? { ...x, type } : x));
  }
  function updateSelectedRoom(patch) {
    setRooms(rs => rs.map(x => x.id === selected.id ? { ...x, ...patch } : x));
  }
  function updateSelectedWindow(patch) {
    setWindows(ws => ws.map(x => x.id === selected.id ? { ...x, ...patch } : x));
  }
  function updateSelectedDoor(patch) {
    setDoors(ds => ds.map(x => x.id === selected.id ? { ...x, ...patch } : x));
  }

  // -------- Mode-level actions --------
  function handleCalculate() {
    setCalculated(true); setShowResult(true);
    window.showToast({ title: "Смета успешно рассчитана", body: `Итого: ₽ ${formatRu(stats.total)}` });
  }
  function handleClear() {
    if (!window.confirm("Очистить уровень? Действие нельзя отменить.")) return;
    updateLevelData({
      walls: [], windows: [], doors: [], openings: [], rooms: [],
      dimensions: [], notes: [],
      roof: data.roof ? { ...data.roof, contour: [], aerators: [], drains: [], slopes: [], segments: [], parapets: [], junctions: [], engouts: [] } : null
    });
    setSelectedIds([]); setActiveTemplateId(null);
    window.showToast({ title: "Уровень очищен", kind: "info" });
  }
  function handleResetProject() {
    if (!window.confirm("Сбросить проект полностью? Все уровни будут удалены.")) return;
    historyRef.current = { past: [], future: [] };
    const p = newEmptyProject(window.PL_DEFAULT_WORLD);
    setProjectRaw(p);
    setSelectedId(null); setShowResult(false); setCalculated(false); setActiveTemplateId(null); setView("canvas"); setMode("plan"); setTool("wall");
    window.showToast({ title: "Проект сброшен", kind: "info" });
  }
  function handleBlankCanvas() { handleResetProject(); }
  // Used by Quick Start "Empty" — no confirm
  function handleResetProjectQuiet() {
    historyRef.current = { past: [], future: [] };
    const p = newEmptyProject(window.PL_DEFAULT_WORLD);
    setProjectRaw(p);
    setSelectedIds([]); setShowResult(false); setCalculated(false); setActiveTemplateId(null);
    setView("canvas"); setMode("plan"); setTool("wall");
    window.showToast({ title: "Пустой проект создан", kind: "info" });
  }
  function handleApplyTemplate(tpl, opts = {}) {
    const inst = instantiateTemplate(tpl);
    const levels = inst.levels.map(l => ({ id: l.id, name: l.name, type: l.type, world: l.world }));
    const levelsData = {}; const levelsView = {};
    for (const l of inst.levels) {
      levelsData[l.id] = { walls: l.walls, windows: l.windows, doors: l.doors, openings: l.openings, rooms: l.rooms, dimensions: l.dimensions || [], notes: l.notes || [], layers: l.layers || defaultLayersForType(l.type), roof: l.roof };
      levelsView[l.id] = defaultViewState();
    }
    setProject({ levels, activeLevelId: levels[0].id, levelsData, levelsView, world: inst.world });
    setSelectedId(null); setActiveTemplateId(tpl.id);
    setView("canvas"); setShowResult(false); setCalculated(false);
    const firstType = levels[0].type;
    setMode((firstType === "roof" || firstType === "industrial_roof") ? "roof" : "plan");
    // Auto-set grid for roof types: industrial → 10m, residential roof → 5m
    if (firstType === "industrial_roof") setGridSize(10);
    else if (firstType === "roof") setGridSize(5);
    else setGridSize(1);
    // Default inspector tab → params (roof dashboard for roof levels)
    setInspectorTab("params");
    // Auto-fit using FRESH data (not via closure on stale `data`)
    setTimeout(() => {
      const sz = containerSize.current;
      const freshData = levelsData[levels[0].id];
      const b = getLevelBounds(freshData) || { x: 0, y: 0, w: inst.world.w, h: inst.world.h };
      const next = fitBoundsToView(b, sz.w, sz.h, 80);
      if (next) {
        setProject(p => ({
          ...p,
          levelsView: { ...(p.levelsView || {}), [p.activeLevelId]: next },
        }), { skipHistory: true });
      }
    }, 80);
    window.showToast({ title: `Шаблон применён: ${tpl.name}`, body: `${levels.length} уровень(ей) · ${tpl.area} м²` });
    if (opts.scenarioTip) setScenarioHintId(opts.scenarioTip);
  }
  function handleSwitchLevel(id) { setSelectedId(null); setProject(p => ({ ...p, activeLevelId: id })); }
  function handleAddLevel(type) {
    const id = `L-${Date.now()}`;
    const name = type === "garage" ? "Гараж" : type === "roof" ? "Кровля" : type === "industrial_roof" ? "Пром. кровля" : type === "attic" ? "Мансарда" : `${project.levels.length + 1} этаж`;
    const newL = emptyLevel(id, name, type, world);
    setProject(p => ({
      ...p,
      levels: [...p.levels, { id, name, type, world: newL.world }],
      levelsData: { ...p.levelsData, [id]: { walls: newL.walls, windows: newL.windows, doors: newL.doors, openings: newL.openings, rooms: newL.rooms, dimensions: newL.dimensions || [], notes: newL.notes || [], layers: newL.layers || defaultLayersForType(type), roof: newL.roof } },
      levelsView: { ...(p.levelsView || {}), [id]: defaultViewState() },
      activeLevelId: id,
    }));
    window.showToast({ title: `${name} создан`, body: "Уровень добавлен в проект" });
  }
  function handleDuplicateLevel() {
    const id = `L-${Date.now()}`;
    const name = `${level.name} (копия)`;
    setProject(p => ({
      ...p,
      levels: [...p.levels, { id, name, type: level.type, world: level.world }],
      levelsData: { ...p.levelsData, [id]: JSON.parse(JSON.stringify(data)) },
      levelsView: { ...(p.levelsView || {}), [id]: defaultViewState() },
      activeLevelId: id,
    }));
    window.showToast({ title: "Этаж скопирован", body: name });
  }
  function handleUpdateLevel(patch) {
    setProject(p => ({ ...p, levels: p.levels.map(l => l.id === p.activeLevelId ? { ...l, ...patch } : l) }));
  }

  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;

  return (
    <div className="plan-layout">
      <window.PlanToolbar
        mode={mode} tool={tool} setTool={setTool}
        onClear={handleClear} onDelete={handleDeleteSelected} onResetProject={handleResetProject}
        hasSelection={!!selectedId}
      />

      <div className="plan-center">
        <ModeTabs
          mode={mode} setMode={setMode}
          onUndo={doUndo} onRedo={doRedo} canUndo={canUndo} canRedo={canRedo}
          onSave={() => { if (saveToStorage(project)) { setSavedAt(new Date()); window.showToast({ title: "Проект сохранён" }); } }}
          onExport={() => window.showToast({ title: "PDF готов к скачиванию" })}
          savedAt={savedAt}
          onQuickStart={() => setQuickStartOpen(true)}
          onDemoMode={() => setDemoModeOpen(true)}
          onImport={() => handleOpenImport()}
        />

        <LevelTabs
          levels={project.levels} activeId={project.activeLevelId}
          onSwitch={handleSwitchLevel} onAdd={handleAddLevel} onDuplicate={handleDuplicateLevel}
        />

        <div className="plan-subbar">
          <div className="plan-tab-group">
            <button className={`plan-tab ${view === "canvas" ? "active" : ""}`} onClick={() => setView("canvas")}>
              <I.Ruler size={13}/> Холст
            </button>
            <button className={`plan-tab ${view === "templates" ? "active" : ""}`} onClick={() => setView("templates")}>
              <I.Building size={13}/> Шаблоны <span className="plan-tab-count">{TEMPLATES.length}</span>
            </button>
          </div>
          <div className="hstack" style={{ gap: 4 }}>
            <div className="grid-selector">
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Сетка</span>
              {GRID_SIZES.map(g => (
                <button key={g} className={`grid-btn ${gridSize === g ? "active" : ""}`} onClick={() => setGridSize(g)}>
                  {g < 1 ? `${g} м` : `${g} м`}
                </button>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => fitToObject(false)} title="Подогнать под габариты построенных элементов">
              <I.Fit size={13}/> Объект
            </button>
            <button className="btn btn-ghost btn-sm" onClick={fitToWorld} title="Показать весь холст">
              <I.Map size={13}/> Холст
            </button>
            <button className="btn btn-ghost btn-sm" onClick={fitToSelection} disabled={!selected} title="Показать выбранное">
              <I.Cursor size={13}/> Выбор
            </button>
            <button className="btn btn-ghost btn-sm" onClick={setZoom100} title="Реальный масштаб 1:1">100%</button>
          </div>
        </div>

        {view === "canvas" ? (
          <div className="plan-canvas-wrap" ref={wrapperRef} onContextMenu={(e) => e.preventDefault()}>
            <PlanCanvas
              containerSize={containerSize.current}
              viewState={viewState}
              gridSize={gridSize}
              mode={mode} tool={tool}
              level={level} data={data} world={world}
              layers={layers}
              isWallTool={isWallTool} isRoomTool={isRoomTool} isPlaceTool={isPlaceTool}
              isRoofPointTool={isRoofPointTool} isRoofContourTool={isRoofContourTool}
              isSegmentTool={isSegmentTool} isLineTool={isLineTool} isNoteTool={isNoteTool}
              isDrawing={isDrawing} isPanMode={isPanMode}
              wallDrag={wallDrag} roomStart={roomStart} contourPts={contourPts}
              linePending={linePending} segDrag={segDrag}
              snappedCursor={snappedCursor}
              selectedIds={selectedIds}
              hoverObjectId={hoverObjectId}
              setHoverObjectId={setHoverObjectId}
              handleDrag={handleDrag}
              moveDrag={moveDrag} resizeDrag={resizeDrag} endpointDrag={endpointDrag}
              showFloorOverlay={showFloorOverlay}
              previousLevelData={getPrevFloorData(project)}
              onObjectClick={handleObjectClick}
              onSelectNone={() => setSelectedIds([])}
              onHover={handleCanvasHover}
              onCanvasClick={handleCanvasClick}
              onWallDragStart={handleWallDragStart}
              onWallDragMove={handleWallDragMove}
              onWallDragEnd={handleWallDragEnd}
              onPan={panBy}
              onZoomAtPoint={zoomAtPoint}
              onWallHandleDragStart={handleWallHandleDragStart}
              onWallHandleDragMove={handleWallHandleDragMove}
              onWallHandleDragEnd={handleWallHandleDragEnd}
              onStartMoveDrag={startMoveDrag}
              onApplyMoveDrag={applyMoveDrag}
              onEndMoveDrag={endMoveDrag}
              onStartResizeDrag={startResizeDrag}
              onApplyResizeDrag={applyResizeDrag}
              onEndResizeDrag={endResizeDrag}
              onStartEndpointDrag={startEndpointDrag}
              onApplyEndpointDrag={applyEndpointDrag}
              onEndEndpointDrag={endEndpointDrag}
              onStartSegmentDraw={startSegmentDraw}
              onMoveSegmentDraw={moveSegmentDraw}
              onEndSegmentDraw={endSegmentDraw}
              contourVertexDrag={contourVertexDrag}
              onStartContourVertexDrag={startContourVertexDrag}
              onApplyContourVertexDrag={applyContourVertexDrag}
              onEndContourVertexDrag={endContourVertexDrag}
              bgDrag={bgDrag}
              onStartBgMove={startBackgroundMoveDrag}
              onApplyBgDrag={applyBackgroundDrag}
              onEndBgDrag={endBackgroundDrag}
              onStartBgResize={startBackgroundResizeDrag}
              onPatchBackground={patchBackground}
              calibrationMode={calibrationMode}
              calibrationPending={calibrationPending}
              calibrationDrag={calibrationDrag}
              onClickCalibrationLine={handleCalibrationLineClick}
              onStartCalibrationEndpointDrag={startCalibrationEndpointDrag}
              onApplyCalibrationDrag={applyCalibrationEndpointDrag}
              onEndCalibrationDrag={endCalibrationEndpointDrag}
              pdfCandidates={candidates}
            />

            <Rulers viewState={viewState} containerSize={containerSize.current} gridSize={gridSize} hoverPoint={hoverPoint}/>

            {isDrawing && tool !== "select" && tool !== "hand" && (
              <div className="drawing-hint">
                <I.Info size={13}/>
                {isWallTool && (wallDrag
                  ? <>Тяните и отпустите кнопку. <b>Esc</b> — отмена</>
                  : <>Зажмите мышь и потяните, чтобы нарисовать {tool === "wall" ? "стену" : "перегородку"}.</>)}
                {isRoomTool && (roomStart
                  ? <>Кликните противоположный угол. <b>Esc</b> — отмена</>
                  : <>Кликните первый угол {tool === "zone" ? "зоны" : "комнаты"}, потом второй.</>)}
                {tool === "window" && <>Кликните по стене, чтобы поставить окно (1,5 м).</>}
                {tool === "door" && <>Кликните по стене, чтобы поставить дверь (0,9 м).</>}
                {tool === "opening" && <>Кликните по стене, чтобы поставить проём.</>}
                {tool === "aerator" && <>Кликните, чтобы поставить аэратор Ø110.</>}
                {tool === "drain" && <>Кликните, чтобы поставить воронку.</>}
                {isRoofContourTool && (contourPts.length === 0
                  ? <>Кликните, чтобы поставить первый угол кровли.</>
                  : contourPts.length < 3
                  ? <>Поставлено: {contourPts.length}. Минимум 3 угла.</>
                  : <>{contourPts.length} углов. Кликните рядом с началом, чтобы замкнуть.</>)}
              </div>
            )}

            <MiniMap
              world={world} viewState={viewState} containerSize={containerSize.current} data={data}
              onPanCenterTo={(x, y) => {
                const sz = containerSize.current;
                setViewState(v => ({ ...v, panX: sz.w / 2 - x * PX_PER_M * v.zoom, panY: sz.h / 2 - y * PX_PER_M * v.zoom }), true);
              }}
              onFit={() => fitToObject(true)}
            />

            <CanvasZoom
              viewState={viewState}
              onZoomIn={() => zoomFromCenter(1.25)}
              onZoomOut={() => zoomFromCenter(0.8)}
              onFitObject={() => fitToObject(false)}
              onFitWorld={fitToWorld}
              onFitSelection={fitToSelection}
              hasSelection={!!selected}
              on100={setZoom100}
            />

            <CanvasLegend mode={mode}/>

            {warnings.length > 0 && (
              <WarningsOverlay warnings={warnings} onJump={(id) => selectAndFit(id)}/>
            )}

            {scenarioHintId && (
              <window.ScenarioHint scenarioId={scenarioHintId} onDismiss={() => setScenarioHintId(null)}/>
            )}

            {calibrationMode && (
              <div className="calib-banner">
                <I.Ruler size={14}/>
                <span style={{ flex: 1 }}>
                  <b>Калибровка масштаба.</b>{" "}
                  {calibrationPending ? "Кликните вторую точку отрезка." : "Кликните начало отрезка с известной длиной."}
                </span>
                <button className="calib-banner-cancel" onClick={cancelCalibration}>
                  <I.Close size={12}/> Отмена
                </button>
              </div>
            )}
          </div>
        ) : (
          <window.TemplatesGallery
            activeId={activeTemplateId}
            onApply={handleApplyTemplate}
            onBlank={handleBlankCanvas}
          />
        )}

        <StatusBar
          mode={mode} tool={tool} level={level} stats={stats}
          gridSize={gridSize} viewState={viewState} hoverPoint={hoverPoint}
          selected={selected} warnings={warnings} selectedIds={selectedIds}
          visibleGridStep={getVisibleGridStep(viewState.zoom)} savedAt={savedAt}
          backgrounds={data.backgrounds || []}
        />
      </div>

      <window.PlanInspector
        tab={inspectorTab} setTab={setInspectorTab}
        selected={selected} walls={data.walls} stats={stats}
        mode={mode} level={level}
        selectedIds={selectedIds} selectedObjects={selectedObjects}
        layers={layers} setLayers={setLayers}
        onLayerToggle={(lid, patch) => setLayers(ls => ls.map(l => l.id === lid ? { ...l, ...patch } : l))}
        data={data}
        calculated={calculated} showResult={showResult}
        onCalculate={handleCalculate} onOpenKp={() => onNav("kp")}
        onDismissResult={() => setShowResult(false)}
        onUpdateLevel={handleUpdateLevel}
        onUpdateWallLen={updateSelectedWallLen}
        onUpdateWallType={updateSelectedWallType}
        onUpdateRoom={updateSelectedRoom}
        onUpdateWindow={updateSelectedWindow}
        onUpdateDoor={updateSelectedDoor}
        onPatchObject={patchObjectById}
        onDeleteSelected={handleDeleteSelected}
        onAddParapetByContour={handleAddParapetByContour}
        onCreateRectRoof={handleCreateRectRoof}
        onApplyDemoRoof={handleApplyDemoRoof}
        onCheckRoof={handleCheckRoof}
        onSelectAndFit={selectAndFit}
        roofCheckRunAt={roofCheckRunAt}
        onDuplicateSelected={() => {
          if (selectedIds.length === 0) return;
          const stamp = Date.now();
          // For each selected, create a copy with new id
          for (const id of selectedIds) {
            const f = findObjectById(data, id);
            if (!f) continue;
            const copy = JSON.parse(JSON.stringify(f.obj));
            copy.id = `${f.obj.id.replace(/-(\d+)$/, "")}-${stamp}-${Math.floor(Math.random()*99)}`;
            // shift point objects to avoid overlap
            if ("x" in copy && "w" in copy) { copy.x += 0.5; copy.y += 0.5; }
            else if ("x" in copy) { copy.x += 0.5; copy.y += 0.5; }
            else if ("x1" in copy) { copy.x1 += 0.5; copy.y1 += 0.5; copy.x2 += 0.5; copy.y2 += 0.5; }
            // route to right collection
            const k = f.kind;
            if (k === "wall_external" || k === "wall_internal") setWalls(ws => [...ws, copy]);
            else if (k === "window") setWindows(ws => [...ws, copy]);
            else if (k === "door") setDoors(ds => [...ds, copy]);
            else if (k === "opening") setOpenings(os => [...os, copy]);
            else if (k === "room") setRooms(rs => [...rs, copy]);
            else if (k === "dimension") setDimensions(ds => [...ds, copy]);
            else if (k === "note") setNotes(ns => [...ns, copy]);
            else if (k === "aerator") setRoof(r => ({ ...r, aerators: [...(r.aerators || []), copy] }));
            else if (k === "drain")   setRoof(r => ({ ...r, drains:   [...(r.drains   || []), copy] }));
            else if (k === "segment") setRoof(r => ({ ...r, segments: [...(r.segments || []), copy] }));
            else if (k === "slope")   setRoof(r => ({ ...r, slopes:   [...(r.slopes   || []), copy] }));
            else if (k === "parapet") setRoof(r => ({ ...r, parapets: [...(r.parapets || []), copy] }));
            else if (k === "junction")setRoof(r => ({ ...r, junctions:[...(r.junctions|| []), copy] }));
            else if (k === "engout")  setRoof(r => ({ ...r, engouts:  [...(r.engouts  || []), copy] }));
          }
          window.showToast({ title: `Дублировано: ${selectedIds.length}` });
        }}
        estimateDraft={estimateDraft}
        warnings={warnings}
        project={project}
        estimateScope={estimateScope}
        setEstimateScope={setEstimateScope}
        onSwitchLevel={handleSwitchLevel}
        onCreateRoofFromContour={handleCreateRoofFromContour}
        onCheckProject={handleCheckProject}
        onShowProjectEstimate={handleShowProjectEstimate}
        onOpenResultCenter={openResultCenter}
        onOpenKpModal={handleOpenKpModal}
        onOpenExport={handleOpenExport}
        lastProposalId={lastProposalId}
        projectStatus={projectStatus}
        backgrounds={data.backgrounds || []}
        onPatchBackground={patchBackground}
        onDeleteBackground={deleteBackground}
        onStartCalibration={startCalibration}
        onFitToBackgrounds={handleFitToBackgrounds}
        onOpenImport={() => handleOpenImport()}
        onSetTool={setTool}
        onLoadPdfDemo={handleLoadPdfDemo}
      />

      {window.QuickStartModal && (
        <window.QuickStartModal
          open={quickStartOpen}
          onClose={() => setQuickStartOpen(false)}
          onApplyTpl={(tpl, opts) => handleApplyTemplate(tpl, opts)}
          onApplyEmpty={() => handleResetProjectQuiet()}
          onPickFile={() => { setQuickStartOpen(false); setTimeout(() => handleOpenImport({ autoCalibrate: true }), 100); }}
          onLoadDemoBg={() => { setQuickStartOpen(false); setTimeout(() => handleLoadDemoBackground(), 100); }}
        />
      )}
      {window.DemoModeModal && (
        <window.DemoModeModal
          open={demoModeOpen}
          onClose={() => setDemoModeOpen(false)}
          onApplyTpl={(tpl, opts) => handleApplyTemplate(tpl, opts)}
          onLoadDemoBg={() => { setDemoModeOpen(false); setTimeout(() => handleLoadDemoBackground(), 100); }}
          onLoadPdfDemo={() => { setDemoModeOpen(false); setTimeout(() => handleLoadPdfDemo(), 100); }}
        />
      )}
      {calibrationModal && window.CalibrationModal && (
        <window.CalibrationModal
          measured={calibrationModal.measured}
          editing={calibrationModal.editing}
          onConfirm={(L) => applyCalibrationLength(L)}
          onCancel={cancelCalibration}
        />
      )}
      <input ref={importFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/jpg,application/pdf"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files && e.target.files[0]; handleImportFile(f); }}
      />

      {window.ResultCenterModal && (
        <window.ResultCenterModal
          open={resultCenterOpen}
          onClose={() => setResultCenterOpen(false)}
          project={project}
          projectStats={projectStats}
          allRows={allRows}
          status={projectStatus}
          warnings={warnings}
          scope={estimateScope}
          setScope={setEstimateScope}
          lastProposalId={lastProposalId}
          lastExportAt={lastExportAt}
          onOpenKpModal={handleOpenKpModal}
          onOpenExport={handleOpenExport}
          onOpenProposalPreview={handleOpenProposalPreview}
          onUpdateRowPrice={handleUpdateRowPrice}
          onToggleRowInclude={handleToggleRowInclude}
        />
      )}
      {window.KpGenerationModal && (
        <window.KpGenerationModal
          open={kpModalOpen}
          onClose={() => setKpModalOpen(false)}
          project={project}
          defaultTotal={allRows.filter(r => r.include !== false).reduce((s, r) => s + r.total, 0)}
          scope={estimateScope}
          onGenerate={handleGenerateKp}
        />
      )}
      {window.KpPreviewModal && (
        <window.KpPreviewModal
          open={!!kpPreviewKp}
          onClose={() => setKpPreviewKp(null)}
          kp={kpPreviewKp}
          project={project}
          allRows={kpPreviewKp?.rowsSnapshot || allRows}
          onPrint={handlePrintKp}
          onSavedExport={handleSavedExportKp}
          onCopyText={handleCopyKpText}
        />
      )}
      {window.ExportModal && (
        <window.ExportModal
          open={!!exportVariant}
          onClose={() => setExportVariant(null)}
          variant={exportVariant}
          project={project}
          allRows={allRows}
          stats={projectStats}
          kp={kpPreviewKp || (lastProposalId ? (window.plLoadGeneratedProposals() || []).find(k => k.id === lastProposalId) : null)}
        />
      )}
      {window.PdfAnalysisModal && (
        <window.PdfAnalysisModal
          open={pdfModalOpen}
          onClose={() => setPdfModalOpen(false)}
          analysis={pdfAnalysis}
          candidates={candidates}
          onUpdateCandidate={handleUpdateCandidate}
          onAcceptAll={handleAcceptAllCandidates}
          onRejectAll={handleRejectAllCandidates}
          onCommit={handleCommitCandidates}
          onJumpToCandidate={handleJumpToCandidate}
          onUseAsBackground={handleUsePdfAsBackground}
        />
      )}
    </div>
  );
}

// ============================================================
// ModeTabs
// ============================================================
function ModeTabs({ mode, setMode, onUndo, onRedo, canUndo, canRedo, onSave, onExport, onImport, savedAt, onQuickStart, onDemoMode }) {
  return (
    <div className="mode-tabs">
      <div className="mode-tab-group">
        {MODES.map(m => {
          const Icn = I[m.icon] || I.Ruler;
          return (
            <button key={m.id} className={`mode-tab ${mode === m.id ? "active" : ""}`} onClick={() => setMode(m.id)}>
              <Icn size={14}/>{m.label}
            </button>
          );
        })}
      </div>
      <div className="mode-actions">
        {onQuickStart && (
          <button className="btn btn-accent btn-sm" onClick={onQuickStart} title="Быстрый старт — мастер сценариев">
            <I.Plus size={13}/> Новый объект
          </button>
        )}
        {onDemoMode && (
          <button className="btn btn-ghost btn-sm" onClick={onDemoMode} title="Готовые демо для продаж">
            <I.Sparkles size={13}/> Демо
          </button>
        )}
        {savedAt && <span className="saved-pill"><I.Check size={11}/> Сохранено {formatTime(savedAt)}</span>}
        <button className="icon-btn" title="Отменить (Ctrl+Z)" onClick={onUndo} disabled={!canUndo} style={{ opacity: canUndo ? 1 : 0.35 }}><I.Undo size={15}/></button>
        <button className="icon-btn" title="Повторить (Ctrl+Shift+Z)" style={{ transform: "scaleX(-1)", opacity: canRedo ? 1 : 0.35 }} onClick={onRedo} disabled={!canRedo}><I.Undo size={15}/></button>
        <button className="icon-btn" title="Сохранить" onClick={onSave}><I.Save size={15}/></button>
        <button className="icon-btn" title="Импорт чертежа · PNG / JPG" onClick={onImport}><I.Upload size={15}/></button>
        <button className="icon-btn" title="Экспорт PDF" onClick={onExport}><I.Download size={15}/></button>
      </div>
    </div>
  );
}
function formatTime(d) {
  if (!d) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// ============================================================
// LevelTabs
// ============================================================
function LevelTabs({ levels, activeId, onSwitch, onAdd, onDuplicate }) {
  const [addOpen, setAddOpen] = useState(false);
  return (
    <div className="level-tabs">
      <div className="level-tab-group">
        {levels.map(l => {
          const lt = LEVEL_TYPES[l.type] || LEVEL_TYPES.floor;
          const Icn = I[lt.iconName] || I.House;
          return (
            <button key={l.id} className={`level-tab ${activeId === l.id ? "active" : ""}`} onClick={() => onSwitch(l.id)}>
              <Icn size={12}/>{l.name}
            </button>
          );
        })}
        <div style={{ position: "relative" }}>
          <button className="level-tab level-tab-add" onClick={() => setAddOpen(o => !o)}>
            <I.Plus size={12}/> Добавить
          </button>
          {addOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 1 }} onClick={() => setAddOpen(false)}/>
              <div className="level-add-menu">
                {[["floor","Этаж"],["attic","Мансарда"],["garage","Гараж"],["roof","Кровля"],["industrial_roof","Пром. кровля"]].map(([t, label]) => {
                  const lt = LEVEL_TYPES[t]; const Icn = I[lt.iconName] || I.House;
                  return <button key={t} onClick={() => { onAdd(t); setAddOpen(false); }}><Icn size={13}/> {label}</button>;
                })}
                <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }}/>
                <button onClick={() => { onDuplicate(); setAddOpen(false); }}><I.Copy size={13}/> Дублировать активный</button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="hstack" style={{ fontSize: 11.5, color: "var(--text-muted)", gap: 14 }}>
        <span><I.Eye size={11}/> Показ нижнего этажа</span>
      </div>
    </div>
  );
}

window.PlanningScreen = PlanningScreen;
window.formatRu = formatRu;
window._plPxPerM = PX_PER_M; // for child components

// ============================================================
// PlanCanvas — transform-based viewport
// SVG fills the wrapper; world is rendered through a <g transform="translate(panX,panY) scale(PX_PER_M*zoom)">
// ============================================================
function PlanCanvas({ containerSize, viewState, gridSize, mode, tool, level, data, world, layers,
  isWallTool, isRoomTool, isPlaceTool, isRoofPointTool, isRoofContourTool,
  isSegmentTool, isLineTool, isNoteTool,
  isDrawing, isPanMode, wallDrag, roomStart, contourPts, linePending, segDrag,
  snappedCursor, selectedIds, hoverObjectId, setHoverObjectId, handleDrag,
  moveDrag, resizeDrag, endpointDrag,
  showFloorOverlay, previousLevelData,
  onObjectClick, onSelectNone, onHover, onCanvasClick,
  onWallDragStart, onWallDragMove, onWallDragEnd,
  onPan, onZoomAtPoint, onWallHandleDragStart, onWallHandleDragMove, onWallHandleDragEnd,
  onStartMoveDrag, onApplyMoveDrag, onEndMoveDrag,
  onStartResizeDrag, onApplyResizeDrag, onEndResizeDrag,
  onStartEndpointDrag, onApplyEndpointDrag, onEndEndpointDrag,
  onStartSegmentDraw, onMoveSegmentDraw, onEndSegmentDraw,
  contourVertexDrag, onStartContourVertexDrag, onApplyContourVertexDrag, onEndContourVertexDrag,
  // Backgrounds / underlays
  bgDrag, onStartBgMove, onApplyBgDrag, onEndBgDrag, onStartBgResize, onPatchBackground,
  // Calibration
  calibrationMode, calibrationPending, calibrationDrag,
  onClickCalibrationLine, onStartCalibrationEndpointDrag, onApplyCalibrationDrag, onEndCalibrationDrag,
  // PDF candidates
  pdfCandidates,
}) {

  const svgRef = useRef(null);
  const panRef = useRef(null);
  const isRoofLevel = level.type === "roof" || level.type === "industrial_roof";
  const W = containerSize.w || 800;
  const H = containerSize.h || 600;
  const scale = PX_PER_M * viewState.zoom;
  const selectedSet = useMemo(() => new Set(selectedIds || []), [selectedIds]);
  const layerById = useMemo(() => Object.fromEntries((layers || []).map(l => [l.id, l])), [layers]);
  const isHidden = (lid) => { const l = layerById[lid]; return !!(l && l.visible === false); };
  const isLocked = (lid) => { const l = layerById[lid]; return !!(l && l.locked); };
  const layerOpacity = (lid) => { const l = layerById[lid]; return l && l.opacity != null ? l.opacity : 1; };
  const visibleAll = (lid) => !isHidden(lid);

  function svgEventToWorld(e) {
    const r = svgRef.current.getBoundingClientRect();
    return screenToWorld(e.clientX - r.left, e.clientY - r.top, viewState);
  }
  function svgEventToScreenLocal(e) {
    const r = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  const anyDrag = !!(moveDrag || resizeDrag || endpointDrag || segDrag || handleDrag || contourVertexDrag || bgDrag || calibrationDrag);
  const cursor = anyDrag ? "grabbing"
    : isPanMode ? (panRef.current ? "grabbing" : "grab")
    : calibrationMode ? "crosshair"
    : tool === "select" ? "default" : "crosshair";

  // Adaptive grid step
  const autoGrid = getVisibleGridStep(viewState.zoom);
  const renderGridSize = Math.max(gridSize, autoGrid);

  // helper for placing handlers on objects
  function objectHandlers(obj, kind) {
    const lid = layerOf(obj, kind);
    const locked = isLocked(lid);
    const onPointerDown = locked ? undefined : (e) => {
      if (tool !== "select" || isDrawing || isPanMode) return;
      if (e.button !== 0) return;
      e.stopPropagation();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
      onObjectClick(obj, kind, e);
      onStartMoveDrag(obj.id, kind, svgEventToWorld(e));
    };
    const onPointerEnter = () => setHoverObjectId(obj.id);
    const onPointerLeave = () => setHoverObjectId(null);
    return { onPointerDown, onPointerEnter, onPointerLeave, style: { cursor: locked ? "not-allowed" : "pointer", opacity: layerOpacity(lid) } };
  }

  return (
    <svg
      ref={svgRef}
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: "block", touchAction: "none", cursor, background: "#FCFCFD", userSelect: "none" }}
      onContextMenu={(e) => e.preventDefault()}
      onWheel={(e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const local = svgEventToScreenLocal(e);
          const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
          onZoomAtPoint(factor, local.x, local.y);
        } else {
          e.preventDefault();
          onPan(-e.deltaX, -e.deltaY);
        }
      }}
      onPointerDown={(e) => {
        if (e.button === 1 || e.button === 2) {
          e.preventDefault();
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
          panRef.current = { x: e.clientX, y: e.clientY, button: e.button };
          return;
        }
        if (isPanMode) {
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
          panRef.current = { x: e.clientX, y: e.clientY, button: 0 };
          return;
        }
        if (isWallTool) {
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
          onWallDragStart(svgEventToWorld(e));
          return;
        }
        if (isSegmentTool) {
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
          onStartSegmentDraw(svgEventToWorld(e));
          return;
        }
      }}
      onPointerMove={(e) => {
        if (panRef.current) {
          const dx = e.clientX - panRef.current.x;
          const dy = e.clientY - panRef.current.y;
          panRef.current = { ...panRef.current, x: e.clientX, y: e.clientY };
          onPan(dx, dy);
          return;
        }
        if (handleDrag) { onWallHandleDragMove(svgEventToWorld(e)); return; }
        if (contourVertexDrag) { onApplyContourVertexDrag(svgEventToWorld(e)); return; }
        if (bgDrag) { onApplyBgDrag(svgEventToWorld(e)); return; }
        if (calibrationDrag) { onApplyCalibrationDrag(svgEventToWorld(e)); return; }
        if (moveDrag) { onApplyMoveDrag(svgEventToWorld(e)); return; }
        if (resizeDrag) { onApplyResizeDrag(svgEventToWorld(e)); return; }
        if (endpointDrag) { onApplyEndpointDrag(svgEventToWorld(e)); return; }
        if (segDrag) { onMoveSegmentDraw(svgEventToWorld(e)); }
        const pt = svgEventToWorld(e);
        if (wallDrag) onWallDragMove(pt);
        onHover(pt);
      }}
      onPointerUp={(e) => {
        if (panRef.current) {
          panRef.current = null;
          try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
          return;
        }
        if (handleDrag) { onWallHandleDragEnd(); try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} return; }
        if (contourVertexDrag) { onEndContourVertexDrag(); try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} return; }
        if (bgDrag) { onEndBgDrag(); try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} return; }
        if (calibrationDrag) { onEndCalibrationDrag(); try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} return; }
        if (moveDrag)    { onEndMoveDrag();    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} return; }
        if (resizeDrag)  { onEndResizeDrag();  try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} return; }
        if (endpointDrag){ onEndEndpointDrag();try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} return; }
        if (segDrag)     { onEndSegmentDraw(); try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} return; }
        if (wallDrag) {
          onWallDragEnd(svgEventToWorld(e));
          try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
        }
      }}
      onClick={(e) => {
        if (isPanMode || isWallTool || handleDrag || moveDrag || resizeDrag || endpointDrag || segDrag || contourVertexDrag || bgDrag) return;
        if (e.button !== 0) return;
        const pt = svgEventToWorld(e);
        if (calibrationMode) { onCanvasClick(pt); return; }
        if (isDrawing) onCanvasClick(pt);
        else if (e.target === e.currentTarget || e.target.dataset.bg === "1") onSelectNone();
      }}
    >
      <rect data-bg="1" x={0} y={0} width={W} height={H} fill="#F7F8FA"/>

      <g transform={`translate(${viewState.panX} ${viewState.panY}) scale(${scale})`}>
        <rect x={0} y={0} width={world.w} height={world.h} fill="#FCFCFD" stroke="#E4E7EC" strokeWidth={2 / scale}/>

        <window.PlanGrid gridSize={renderGridSize} world={world} zoom={viewState.zoom}/>
        <OriginMarker zoom={viewState.zoom}/>

        {/* Backgrounds / underlays — rendered above grid, below building objects */}
        {visibleAll("L-bgs") && (data.backgrounds || []).map(bg => {
          if (!bg.visible) return null;
          const sel = selectedSet.has(bg.id);
          const hov = hoverObjectId === bg.id;
          const lop = layerOpacity("L-bgs");
          const layerLocked = isLocked("L-bgs");
          const effectivelyLocked = bg.locked || layerLocked;
          return (
            <g key={bg.id}>
              <window.BackgroundImage
                bg={{ ...bg, locked: effectivelyLocked }}
                selected={sel} hover={hov}
                layerOpacity={lop}
                zoom={viewState.zoom}
                onClick={(e, b) => {
                  // Click on unlocked underlay → select + begin move drag
                  const pt = svgEventToWorld(e);
                  onStartBgMove && onStartBgMove(b.id, pt);
                }}
              />
              {bg.calibrationLine && <window.CalibrationLine
                line={bg.calibrationLine} zoom={viewState.zoom}
                selected={sel}
                onClickLabel={() => onClickCalibrationLine && onClickCalibrationLine(bg.id)}
                onStartEndpointDrag={(end, snapshot) => onStartCalibrationEndpointDrag && onStartCalibrationEndpointDrag(bg.id, end, snapshot)}
              />}
              {sel && !effectivelyLocked && (
                <window.BackgroundHandles
                  bg={bg} scale={scale}
                  onCorner={(corner) => onStartBgResize && onStartBgResize(bg.id, corner)}
                />
              )}
            </g>
          );
        })}

        {/* Calibration preview — visible only while calibrating */}
        {calibrationMode && (
          <window.CalibrationPreview p1={calibrationPending?.p1} cursor={snappedCursor} zoom={viewState.zoom}/>
        )}

        {/* AI candidates overlay — pre-trace preview from PDF analysis */}
        {visibleAll("L-candidates") && pdfCandidates && (
          <g style={{ opacity: layerOpacity("L-candidates") }}>
            {(pdfCandidates.rooms || []).map(c => c.status !== "rejected" && (
              <window.CandidateRoom key={c.id} c={c} zoom={viewState.zoom}/>
            ))}
            {(pdfCandidates.walls || []).map(c => (
              <window.CandidateWall key={c.id} c={c} zoom={viewState.zoom}/>
            ))}
            {(pdfCandidates.openings || []).map(c => (
              <window.CandidateOpening key={c.id} c={c} zoom={viewState.zoom}/>
            ))}
            {(pdfCandidates.annotations || []).filter(c => c.kind === "plumb").map(c => (
              <window.CandidatePlumb key={c.id} c={c} zoom={viewState.zoom}/>
            ))}
          </g>
        )}

        {data.walls.length === 0 && data.rooms.length === 0 && (!data.roof?.contour?.length) && !wallDrag && contourPts.length === 0 && (
          <window.EmptyCanvasHint mode={mode} levelType={level.type} world={world}/>
        )}

        {showFloorOverlay && previousLevelData && level.type === "floor" && (
          <window.FloorOverlay walls={previousLevelData.walls}/>
        )}

        {/* Rooms */}
        {visibleAll("L-rooms") && data.rooms.map(r => {
          const lid = layerOf(r, "room");
          if (isHidden(lid)) return null;
          const sel = selectedSet.has(r.id);
          const hov = hoverObjectId === r.id;
          const op = layerOpacity(lid);
          return (
            <g key={r.id} {...objectHandlers(r, "room")} style={{ ...objectHandlers(r, "room").style, opacity: op }}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={r.color}
                stroke={sel ? "var(--accent)" : hov ? "rgba(234,88,12,0.45)" : "none"}
                strokeWidth={2 / scale}
                strokeDasharray={`${8/scale} ${5/scale}`}/>
              <window.RoomLabel room={r}/>
            </g>
          );
        })}

        {/* Roof contour + segments + parapet edges */}
        {isRoofLevel && data.roof?.contour?.length >= 3 && (
          <>
            {visibleAll("L-contour") && <window.RoofContour contour={data.roof.contour}/>}
            {visibleAll("L-parapets") && (data.roof.parapets || []).length === 0 && <window.ParapetEdge contour={data.roof.contour}/>}
            {visibleAll("L-segments") && (data.roof.segments || []).map(s => {
              const lid = layerOf(s, "segment");
              if (isHidden(lid)) return null;
              const op = layerOpacity(lid);
              return (
                <g key={s.id} {...objectHandlers(s, "segment")} style={{ ...objectHandlers(s, "segment").style, opacity: op }}>
                  <window.RoofSegment segment={s} selected={selectedSet.has(s.id)}/>
                </g>
              );
            })}
          </>
        )}

        {/* Wall length labels */}
        {viewState.zoom >= 0.25 && visibleAll("L-walls-ext") && data.walls.map(w => <window.WallLengthLabel key={`L-${w.id}`} wall={w}/>)}

        {/* Walls */}
        {data.walls.map(w => {
          const kind = w.type === "external" ? "wall_external" : "wall_internal";
          const lid = layerOf(w, kind);
          if (isHidden(lid)) return null;
          const op = layerOpacity(lid);
          return (
            <g key={w.id} style={{ opacity: op }}>
              <window.WallShape wall={w} selected={selectedSet.has(w.id)}
                onClick={(e) => onObjectClick(w, kind, e)} disableSelect={isDrawing || isPanMode || isLocked(lid)}/>
            </g>
          );
        })}

        {/* Windows */}
        {visibleAll("L-openings") && data.windows.map(win => {
          const wall = data.walls.find(w => w.id === win.on);
          if (!wall) return null;
          const lid = layerOf(win, "window");
          if (isHidden(lid)) return null;
          const op = layerOpacity(lid);
          return (
            <g key={win.id} style={{ opacity: op }} {...objectHandlers(win, "window")}>
              <window.WindowShape wall={wall} win={win} selected={selectedSet.has(win.id)}
                onClick={() => {}} disableSelect={isDrawing || isPanMode || isLocked(lid)}/>
            </g>
          );
        })}

        {/* Doors */}
        {visibleAll("L-openings") && data.doors.map(d => {
          const wall = data.walls.find(w => w.id === d.on);
          if (!wall) return null;
          const lid = layerOf(d, "door");
          if (isHidden(lid)) return null;
          const op = layerOpacity(lid);
          return (
            <g key={d.id} style={{ opacity: op }} {...objectHandlers(d, "door")}>
              <window.DoorShape wall={wall} door={d} selected={selectedSet.has(d.id)}
                onClick={() => {}} disableSelect={isDrawing || isPanMode || isLocked(lid)}/>
            </g>
          );
        })}

        {/* Openings */}
        {visibleAll("L-openings") && data.openings.map(op => {
          const wall = data.walls.find(w => w.id === op.on);
          if (!wall) return null;
          const lid = layerOf(op, "opening");
          if (isHidden(lid)) return null;
          return (
            <g key={op.id} style={{ opacity: layerOpacity(lid) }} {...objectHandlers(op, "opening")}>
              <window.OpeningShape wall={wall} opening={op} selected={selectedSet.has(op.id)}
                onClick={() => {}} disableSelect={isDrawing || isPanMode || isLocked(lid)}/>
            </g>
          );
        })}

        {/* Roof elements: parapets, junctions, engouts, slopes, drains, aerators */}
        {isRoofLevel && data.roof && (
          <>
            {visibleAll("L-parapets") && (data.roof.parapets || []).map(p => {
              const lid = layerOf(p, "parapet");
              if (isHidden(lid)) return null;
              return (
                <g key={p.id} style={{ opacity: layerOpacity(lid) }} {...objectHandlers(p, "parapet")}>
                  <window.ParapetSegment parapet={p} selected={selectedSet.has(p.id)}/>
                </g>
              );
            })}
            {visibleAll("L-junctions") && (data.roof.junctions || []).map(j => {
              const lid = layerOf(j, "junction");
              if (isHidden(lid)) return null;
              return (
                <g key={j.id} style={{ opacity: layerOpacity(lid) }} {...objectHandlers(j, "junction")}>
                  <window.JunctionShape junction={j} selected={selectedSet.has(j.id)}/>
                </g>
              );
            })}
            {visibleAll("L-slopes") && (data.roof.slopes || []).map(s => {
              const lid = layerOf(s, "slope");
              if (isHidden(lid)) return null;
              return (
                <g key={s.id} style={{ opacity: layerOpacity(lid) }} {...objectHandlers(s, "slope")}>
                  <window.SlopeArrow slope={s} selected={selectedSet.has(s.id)} hover={hoverObjectId === s.id} zoom={viewState.zoom}/>
                </g>
              );
            })}
            {visibleAll("L-drains") && (data.roof.drains || []).map(d => {
              const lid = layerOf(d, "drain");
              if (isHidden(lid)) return null;
              return (
                <g key={d.id} style={{ opacity: layerOpacity(lid) }} {...objectHandlers(d, "drain")}>
                  <window.DrainShape drain={d} selected={selectedSet.has(d.id)}/>
                </g>
              );
            })}
            {visibleAll("L-aerators") && (data.roof.aerators || []).map(a => {
              const lid = layerOf(a, "aerator");
              if (isHidden(lid)) return null;
              return (
                <g key={a.id} style={{ opacity: layerOpacity(lid) }} {...objectHandlers(a, "aerator")}>
                  <window.AeratorShape aerator={a} selected={selectedSet.has(a.id)}/>
                </g>
              );
            })}
            {visibleAll("L-engouts") && (data.roof.engouts || []).map(e => {
              const lid = layerOf(e, "engout");
              if (isHidden(lid)) return null;
              return (
                <g key={e.id} style={{ opacity: layerOpacity(lid) }} {...objectHandlers(e, "engout")}>
                  <window.EngoutShape engout={e} selected={selectedSet.has(e.id)}/>
                </g>
              );
            })}
          </>
        )}

        {/* Dimensions */}
        {visibleAll("L-dims") && (data.dimensions || []).map(d => {
          const lid = layerOf(d, "dimension");
          if (isHidden(lid)) return null;
          return (
            <g key={d.id} style={{ opacity: layerOpacity(lid) }} {...objectHandlers(d, "dimension")}>
              <window.DimensionShape dim={d} selected={selectedSet.has(d.id)} hover={hoverObjectId === d.id}/>
            </g>
          );
        })}

        {/* Notes */}
        {visibleAll("L-notes") && (data.notes || []).map(n => {
          const lid = layerOf(n, "note");
          if (isHidden(lid)) return null;
          return (
            <g key={n.id} style={{ opacity: layerOpacity(lid) }} {...objectHandlers(n, "note")}>
              <window.NoteShape note={n} selected={selectedSet.has(n.id)} hover={hoverObjectId === n.id} zoom={viewState.zoom}/>
            </g>
          );
        })}

        {/* Wall drag preview */}
        {isWallTool && wallDrag && (() => {
          const dragPreviewEnd = axisLock(wallDrag.start, wallDrag.end);
          return (
            <g style={{ pointerEvents: "none" }}>
              <line x1={wallDrag.start.x} y1={wallDrag.start.y} x2={dragPreviewEnd.x} y2={dragPreviewEnd.y}
                stroke={tool === "wall" ? "var(--wall-external)" : "var(--wall-internal)"}
                strokeWidth={tool === "wall" ? 0.36 : 0.16} opacity={0.5}/>
              <line x1={wallDrag.start.x} y1={wallDrag.start.y} x2={dragPreviewEnd.x} y2={dragPreviewEnd.y}
                stroke="var(--accent)" strokeWidth={2 / scale} strokeDasharray={`${10/scale} ${6/scale}`}/>
              {(() => {
                const mx = (wallDrag.start.x + dragPreviewEnd.x) / 2;
                const my = (wallDrag.start.y + dragPreviewEnd.y) / 2;
                const len = Math.hypot(dragPreviewEnd.x - wallDrag.start.x, dragPreviewEnd.y - wallDrag.start.y);
                if (len < 0.2) return null;
                return (
                  <g transform={`translate(${mx}, ${my - 0.55})`}>
                    <rect x={-0.6} y={-0.22} width={1.2} height={0.44} rx={0.08} fill="var(--accent)"/>
                    <text x={0} y={0.08} textAnchor="middle" fontSize={0.3} fontFamily="var(--font-mono)" fill="#fff" fontWeight={600}>{len.toFixed(2)} м</text>
                  </g>
                );
              })()}
              <circle cx={wallDrag.start.x} cy={wallDrag.start.y} r={6/scale} fill="var(--accent)" stroke="#fff" strokeWidth={2/scale}/>
              <circle cx={dragPreviewEnd.x} cy={dragPreviewEnd.y} r={6/scale} fill="var(--accent)" stroke="#fff" strokeWidth={2/scale}/>
            </g>
          );
        })()}

        {/* Room drag preview */}
        {isRoomTool && roomStart && snappedCursor && snappedCursor.x !== undefined && (
          <g style={{ pointerEvents: "none" }}>
            <rect x={Math.min(roomStart.x, snappedCursor.x)} y={Math.min(roomStart.y, snappedCursor.y)}
              width={Math.abs(snappedCursor.x - roomStart.x)} height={Math.abs(snappedCursor.y - roomStart.y)}
              fill="rgba(234,88,12,0.08)" stroke="var(--accent)" strokeWidth={2/scale} strokeDasharray={`${10/scale} ${6/scale}`}/>
          </g>
        )}

        {/* Segment drag preview */}
        {isSegmentTool && segDrag && (
          <g style={{ pointerEvents: "none" }}>
            <rect x={Math.min(segDrag.start.x, segDrag.end.x)} y={Math.min(segDrag.start.y, segDrag.end.y)}
              width={Math.abs(segDrag.end.x - segDrag.start.x)} height={Math.abs(segDrag.end.y - segDrag.start.y)}
              fill="rgba(124,58,237,0.08)" stroke="var(--accent)" strokeWidth={2/scale} strokeDasharray={`${10/scale} ${6/scale}`}/>
          </g>
        )}

        {/* Line tool pending preview (dim/parapet/junction/slope) */}
        {isLineTool && linePending && snappedCursor && snappedCursor.x !== undefined && (
          <g style={{ pointerEvents: "none" }}>
            <line x1={linePending.x} y1={linePending.y} x2={snappedCursor.x} y2={snappedCursor.y}
              stroke="var(--accent)" strokeWidth={2/scale} strokeDasharray={`${8/scale} ${5/scale}`} opacity={0.7}/>
            <circle cx={linePending.x} cy={linePending.y} r={5/scale} fill="var(--accent)" stroke="#fff" strokeWidth={2/scale}/>
            <circle cx={snappedCursor.x} cy={snappedCursor.y} r={5/scale} fill="none" stroke="var(--accent)" strokeWidth={2/scale}/>
            {(() => {
              const len = Math.hypot(snappedCursor.x - linePending.x, snappedCursor.y - linePending.y);
              if (len < 0.2) return null;
              const mx = (linePending.x + snappedCursor.x) / 2;
              const my = (linePending.y + snappedCursor.y) / 2;
              return (
                <g transform={`translate(${mx}, ${my - 0.55})`}>
                  <rect x={-0.6} y={-0.22} width={1.2} height={0.44} rx={0.08} fill="var(--accent)"/>
                  <text x={0} y={0.08} textAnchor="middle" fontSize={0.3} fontFamily="var(--font-mono)" fill="#fff" fontWeight={600}>{len.toFixed(2)} м</text>
                </g>
              );
            })()}
          </g>
        )}

        {/* Contour preview */}
        {isRoofContourTool && contourPts.length > 0 && (
          <g style={{ pointerEvents: "none" }}>
            {contourPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={7/scale} fill="var(--accent)" stroke="#fff" strokeWidth={2/scale}/>)}
            {contourPts.map((p, i) => {
              if (i === 0) return null;
              const prev = contourPts[i - 1];
              return <line key={`l${i}`} x1={prev.x} y1={prev.y} x2={p.x} y2={p.y} stroke="var(--accent)" strokeWidth={2.5/scale} strokeDasharray={`${8/scale} ${5/scale}`}/>;
            })}
            {snappedCursor && contourPts.length > 0 && snappedCursor.x !== undefined && (
              <line x1={contourPts[contourPts.length - 1].x} y1={contourPts[contourPts.length - 1].y}
                x2={snappedCursor.x} y2={snappedCursor.y}
                stroke="var(--accent)" strokeWidth={2/scale} strokeDasharray={`${8/scale} ${5/scale}`} opacity={0.6}/>
            )}
          </g>
        )}

        {/* Place tool preview */}
        {isPlaceTool && snappedCursor && snappedCursor.onWall && (() => {
          const { wall, t } = snappedCursor;
          const size = tool === "window" ? 1.5 : tool === "door" ? 0.9 : 1.0;
          const half = size / 2;
          const thick = wall.type === "external" ? 0.36 : 0.16;
          let rect;
          if (wallIsH(wall)) {
            const cx = wall.x1 + t * (wall.x2 - wall.x1);
            rect = { x: cx - half, y: wall.y1 - thick/2, w: size, h: thick };
          } else {
            const cy = wall.y1 + t * (wall.y2 - wall.y1);
            rect = { x: wall.x1 - thick/2, y: cy - half, w: thick, h: size };
          }
          const color = tool === "window" ? "var(--window)" : tool === "door" ? "var(--accent)" : "var(--text-muted)";
          return <g style={{ pointerEvents: "none" }}><rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={color} opacity={0.4}/></g>;
        })()}

        {/* Roof point ghost */}
        {isRoofPointTool && snappedCursor && snappedCursor.x !== undefined && (
          <g style={{ pointerEvents: "none", opacity: 0.5 }}>
            {tool === "aerator" && <window.AeratorShape aerator={snappedCursor}/>}
            {tool === "drain"   && <window.DrainShape drain={snappedCursor}/>}
            {tool === "engout"  && <window.EngoutShape engout={snappedCursor}/>}
          </g>
        )}

        {/* Snap crosshair */}
        {(isWallTool || isRoomTool || isRoofContourTool || isSegmentTool || isLineTool || isNoteTool) && snappedCursor && snappedCursor.x !== undefined && !wallDrag && !roomStart && !segDrag && (
          <g style={{ pointerEvents: "none" }}>
            <circle cx={snappedCursor.x} cy={snappedCursor.y} r={5/scale} fill="none" stroke="var(--accent)" strokeWidth={2/scale}/>
          </g>
        )}

        {/* Wall endpoint handles when wall selected */}
        {tool === "select" && selectedIds.length === 1 && (() => {
          const w = data.walls.find(x => x.id === selectedIds[0]);
          if (!w) return null;
          if (isLocked(layerOf(w, w.type === "external" ? "wall_external" : "wall_internal"))) return null;
          return (
            <g>
              <WallHandle x={w.x1} y={w.y1} scale={scale} onMouseDown={(e) => { e.stopPropagation(); onWallHandleDragStart(w.id, "start"); }}/>
              <WallHandle x={w.x2} y={w.y2} scale={scale} onMouseDown={(e) => { e.stopPropagation(); onWallHandleDragStart(w.id, "end"); }}/>
            </g>
          );
        })()}

        {/* Room/Segment resize handles */}
        {tool === "select" && selectedIds.length === 1 && (() => {
          const id = selectedIds[0];
          const room = data.rooms.find(r => r.id === id);
          const seg = (data.roof?.segments || []).find(s => s.id === id);
          const obj = room || seg;
          if (!obj) return null;
          const kind = room ? "room" : "segment";
          if (isLocked(layerOf(obj, kind))) return null;
          const b = { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
          return <window.ResizeHandles bounds={b} scale={scale} onHandle={(h) => onStartResizeDrag(id, kind, h, { x: obj.x, y: obj.y })}/>;
        })()}

        {/* Endpoint handles for line objects (dim, parapet, junction, slope, opening/window via wall handled separately) */}
        {tool === "select" && selectedIds.length === 1 && (() => {
          const id = selectedIds[0];
          const all = [
            ...(data.dimensions || []).map(o => ({ obj: o, kind: "dimension" })),
            ...((data.roof?.parapets) || []).map(o => ({ obj: o, kind: "parapet" })),
            ...((data.roof?.junctions) || []).map(o => ({ obj: o, kind: "junction" })),
            ...((data.roof?.slopes) || []).map(o => ({ obj: o, kind: "slope" })),
          ];
          const found = all.find(x => x.obj.id === id);
          if (!found) return null;
          if (isLocked(layerOf(found.obj, found.kind))) return null;
          const o = found.obj;
          return <window.EndpointHandles p1={{ x: o.x1, y: o.y1 }} p2={{ x: o.x2, y: o.y2 }} scale={scale}
            onHandle={(end) => onStartEndpointDrag(id, found.kind, end, end === "a" ? { x: o.x1, y: o.y1 } : { x: o.x2, y: o.y2 })}/>;
        })()}

        {/* Roof contour vertex handles — visible in roof mode (no need to select the contour) */}
        {isRoofLevel && tool === "select" && data.roof?.contour?.length >= 3 && !isLocked("L-contour") && (
          <g>
            {data.roof.contour.map((p, i) => (
              <g key={`cv-${i}`} transform={`translate(${p.x} ${p.y})`} style={{ cursor: "grab" }}
                onPointerDown={(e) => { e.stopPropagation(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} onStartContourVertexDrag(i); }}>
                <circle r={9/scale} fill="rgba(124,58,237,0.18)"/>
                <circle r={5/scale} fill="#fff" stroke="#7C3AED" strokeWidth={2.5/scale}/>
              </g>
            ))}
          </g>
        )}

        {/* Multi-select bounding box */}
        {selectedIds.length > 1 && (() => {
          const bs = [];
          for (const id of selectedIds) {
            const f = findObjectById(data, id);
            if (f) { const b = getObjectBounds(f.obj); if (b) bs.push(b); }
          }
          const u = unionBounds(bs);
          if (!u) return null;
          return <window.SelectionRect bounds={{ x: u.x - 0.05, y: u.y - 0.05, w: u.w + 0.1, h: u.h + 0.1 }} scale={scale}/>;
        })()}

        {/* Auto dimension lines around building */}
        {!isRoofLevel && data.walls.length > 0 && viewState.zoom >= 0.2 && <window.DimensionLines walls={data.walls}/>}

        {/* Compass */}
        {viewState.zoom >= 0.2 && <window.Compass x={world.w - 1.4} y={1.3}/>}
      </g>
    </svg>
  );
}

// Wall endpoint handle (drag to reshape wall)
function WallHandle({ x, y, scale, onMouseDown }) {
  return (
    <g transform={`translate(${x} ${y})`} style={{ cursor: "grab" }}
      onPointerDown={onMouseDown}>
      <circle r={11/scale} fill="rgba(234,88,12,0.15)"/>
      <circle r={6/scale} fill="#fff" stroke="var(--accent)" strokeWidth={2.5/scale}/>
    </g>
  );
}

// Origin (0,0) marker + short axes
function OriginMarker({ zoom }) {
  if (zoom < 0.15) return null;
  const sz = 1.2;
  return (
    <g style={{ pointerEvents: "none" }}>
      {/* X axis (red-ish) */}
      <line x1={0} y1={0} x2={sz} y2={0} stroke="#DC2626" strokeWidth={3/zoom/40} opacity={0.85}/>
      <polygon points={`${sz},0 ${sz-0.18},-0.1 ${sz-0.18},0.1`} fill="#DC2626"/>
      {/* Y axis (green-ish) */}
      <line x1={0} y1={0} x2={0} y2={sz} stroke="#16A34A" strokeWidth={3/zoom/40} opacity={0.85}/>
      <polygon points={`0,${sz} -0.1,${sz-0.18} 0.1,${sz-0.18}`} fill="#16A34A"/>
      {/* Origin dot */}
      <circle r={0.12} fill="#1F2937"/>
      <text x={0.18} y={-0.18} fontSize={0.28} fill="#6B7280" fontFamily="var(--font-mono)">0,0</text>
    </g>
  );
}

// helper for floor overlay
function getPrevFloorData(project) {
  const idx = project.levels.findIndex(l => l.id === project.activeLevelId);
  if (idx <= 0) return null;
  for (let i = idx - 1; i >= 0; i--) {
    if (project.levels[i].type === "floor") return project.levelsData[project.levels[i].id];
  }
  return null;
}

// ============================================================
// Rulers (X top, Y left) — adapt to zoom + pan
// ============================================================
function Rulers({ viewState, containerSize, gridSize, hoverPoint }) {
  const W = containerSize.w || 800;
  const H = containerSize.h || 600;
  const step = Math.max(gridSize, getVisibleGridStep(viewState.zoom));
  const major = step * 5;
  const scale = PX_PER_M * viewState.zoom;
  // Compute first major tick visible on each axis
  const startX = Math.floor(-viewState.panX / scale / major) * major;
  const endX = Math.ceil((W - viewState.panX) / scale / major) * major;
  const startY = Math.floor(-viewState.panY / scale / major) * major;
  const endY = Math.ceil((H - viewState.panY) / scale / major) * major;
  const ticksX = [];
  for (let m = startX; m <= endX; m += major) {
    const x = m * scale + viewState.panX;
    if (x < 18 || x > W) continue;
    ticksX.push({ x, label: m });
  }
  const ticksY = [];
  for (let m = startY; m <= endY; m += major) {
    const y = m * scale + viewState.panY;
    if (y < 18 || y > H) continue;
    ticksY.push({ y, label: m });
  }
  const cursorX = hoverPoint ? hoverPoint.x * scale + viewState.panX : null;
  const cursorY = hoverPoint ? hoverPoint.y * scale + viewState.panY : null;

  return (
    <>
      <div className="ruler ruler-top">
        <svg width={W} height={18} viewBox={`0 0 ${W} 18`}>
          <rect x={0} y={0} width={W} height={18} fill="#F7F8FA"/>
          {ticksX.map((t, i) => (
            <g key={i}>
              <line x1={t.x} y1={12} x2={t.x} y2={18} stroke="#94A3B8" strokeWidth={1}/>
              <text x={t.x + 3} y={11} fontSize={9} fill="#6B7280" fontFamily="var(--font-mono)">{t.label}м</text>
            </g>
          ))}
          {cursorX !== null && cursorX >= 18 && cursorX <= W && (
            <line x1={cursorX} y1={0} x2={cursorX} y2={18} stroke="var(--accent)" strokeWidth={1.5}/>
          )}
          <line x1={0} y1={17} x2={W} y2={17} stroke="#E4E7EC" strokeWidth={1}/>
        </svg>
      </div>
      <div className="ruler ruler-left">
        <svg width={18} height={H} viewBox={`0 0 18 ${H}`}>
          <rect x={0} y={0} width={18} height={H} fill="#F7F8FA"/>
          {ticksY.map((t, i) => (
            <g key={i}>
              <line x1={12} y1={t.y} x2={18} y2={t.y} stroke="#94A3B8" strokeWidth={1}/>
              <text x={9} y={t.y - 3} fontSize={9} fill="#6B7280" fontFamily="var(--font-mono)" textAnchor="end" transform={`rotate(-90 9 ${t.y - 3})`}>{t.label}м</text>
            </g>
          ))}
          {cursorY !== null && cursorY >= 18 && cursorY <= H && (
            <line x1={0} y1={cursorY} x2={18} y2={cursorY} stroke="var(--accent)" strokeWidth={1.5}/>
          )}
          <line x1={17} y1={0} x2={17} y2={H} stroke="#E4E7EC" strokeWidth={1}/>
        </svg>
      </div>
      <div className="ruler-corner"/>
    </>
  );
}

// ============================================================
// MiniMap — shows all objects, viewport rect, draggable
// ============================================================
function MiniMap({ world, viewState, containerSize, data, onPanCenterTo, onFit }) {
  const W = 188, H = 130, pad = 8;
  const svgRef = useRef(null);
  // Fit world into mini map
  const sx = (W - pad*2) / world.w;
  const sy = (H - pad*2) / world.h;
  const s = Math.min(sx, sy);
  const offX = pad + (W - pad*2 - world.w * s) / 2;
  const offY = pad + (H - pad*2 - world.h * s) / 2;
  // Viewport rect in world coords from current view
  const scale = PX_PER_M * viewState.zoom;
  const visX = -viewState.panX / scale;
  const visY = -viewState.panY / scale;
  const visW = containerSize.w / scale;
  const visH = containerSize.h / scale;

  function mmToWorld(e) {
    const r = svgRef.current.getBoundingClientRect();
    const xs = (e.clientX - r.left - offX) / s;
    const ys = (e.clientY - r.top - offY) / s;
    return { x: xs, y: ys };
  }
  const dragRef = useRef(false);
  return (
    <div className="mini-map">
      <div className="mini-map-header">
        <I.Map size={11}/>
        <span>Карта объекта</span>
        <button className="mini-map-fit" title="Подогнать к объекту" onClick={onFit}><I.Fit size={10}/></button>
      </div>
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        style={{ cursor: "crosshair" }}
        onPointerDown={(e) => { dragRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); const p = mmToWorld(e); onPanCenterTo(p.x, p.y); }}
        onPointerMove={(e) => { if (!dragRef.current) return; const p = mmToWorld(e); onPanCenterTo(p.x, p.y); }}
        onPointerUp={(e) => { dragRef.current = false; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} }}
        onDoubleClick={onFit}
      >
        <rect x={offX} y={offY} width={world.w * s} height={world.h * s} fill="#FCFCFD" stroke="var(--border)" strokeWidth={1}/>
        <g transform={`translate(${offX} ${offY}) scale(${s})`}>
          {(data.backgrounds || []).filter(b => b.visible).map(b => (
            <rect key={b.id} x={b.x} y={b.y} width={b.width} height={b.height}
              fill="rgba(124,58,237,0.06)" stroke="rgba(124,58,237,0.45)" strokeWidth={1/s} strokeDasharray={`${3/s} ${2/s}`}/>
          ))}
          {data.rooms.map(r => <rect key={r.id} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.color}/>)}
          {data.roof?.contour?.length >= 3 && (
            <polygon points={data.roof.contour.map(p => `${p.x},${p.y}`).join(" ")} fill="rgba(124,58,237,0.08)" stroke="#4A5365" strokeWidth={1.5/s}/>
          )}
          {(data.roof?.segments || []).map(seg => seg.bounds && (
            <rect key={seg.id} x={seg.bounds.x} y={seg.bounds.y} width={seg.bounds.w} height={seg.bounds.h} fill="rgba(124,58,237,0.04)" stroke="rgba(124,58,237,0.3)" strokeWidth={1/s} strokeDasharray={`${4/s} ${3/s}`}/>
          ))}
          {data.walls.filter(w => w.type === "external").map(w => (
            <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#1F2937" strokeWidth={3/s}/>
          ))}
          {data.walls.filter(w => w.type === "internal").map(w => (
            <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#94A3B8" strokeWidth={1.5/s}/>
          ))}
          {(data.roof?.drains || []).map(d => (
            <circle key={d.id} cx={d.x} cy={d.y} r={3/s} fill="#0891B2" opacity={0.7}/>
          ))}
          {(data.roof?.aerators || []).slice(0, 60).map(a => (
            <circle key={a.id} cx={a.x} cy={a.y} r={2.5/s} fill="#1E3A8A" opacity={0.7}/>
          ))}
          {/* Viewport rect */}
          <rect x={visX} y={visY} width={visW} height={visH}
            fill="rgba(30,58,138,0.08)" stroke="var(--primary)" strokeWidth={2/s} strokeDasharray={`${4/s} ${2/s}`}/>
        </g>
      </svg>
    </div>
  );
}

// ============================================================
// Canvas zoom controls — extended
// ============================================================
function CanvasZoom({ viewState, onZoomIn, onZoomOut, onFitObject, onFitWorld, onFitSelection, hasSelection, on100 }) {
  return (
    <div className="canvas-zoom">
      <button onClick={onZoomOut} title="Уменьшить"><I.Minus size={14}/></button>
      <div className="level">{`${Math.round(viewState.zoom * 100)}%`}</div>
      <button onClick={onZoomIn} title="Увеличить"><I.Plus size={14}/></button>
      <div className="zoom-sep"/>
      <button onClick={on100} title="Реальный масштаб 1:1" className="text-btn">1:1</button>
      <button onClick={onFitObject} title="Показать построенный объект"><I.Fit size={14}/></button>
      <button onClick={onFitWorld} title="Показать весь холст"><I.Map size={13}/></button>
      <button onClick={onFitSelection} disabled={!hasSelection} title="Показать выбранное" style={{ opacity: hasSelection ? 1 : 0.4 }}><I.Cursor size={13}/></button>
    </div>
  );
}

// ============================================================
// Canvas legend (kept simple)
// ============================================================
function CanvasLegend({ mode }) {
  if (mode === "roof") return (
    <div className="canvas-legend">
      <div className="legend-row"><span className="legend-swatch" style={{ background: "#0B1220", height: 6 }}/>Контур</div>
      <div className="legend-row"><span className="legend-swatch" style={{ background: "#7C2D12", height: 6 }}/>Парапет</div>
      <div className="legend-row"><span className="legend-swatch" style={{ background: "#9A3412", height: 3, borderTop: "2px dashed #9A3412" }}/>Примыкание</div>
      <div className="legend-row"><svg width={14} height={10}><circle cx={7} cy={5} r={3.5} fill="none" stroke="#1E3A8A" strokeWidth={1}/><line x1={3.5} y1={5} x2={10.5} y2={5} stroke="#1E3A8A" strokeWidth={0.9}/></svg>Аэратор</div>
      <div className="legend-row"><svg width={14} height={10}><circle cx={7} cy={5} r={3.5} fill="#0891B2" opacity={0.4}/><circle cx={7} cy={5} r={1.2} fill="#0891B2"/></svg>Воронка</div>
      <div className="legend-row"><svg width={14} height={10}><polygon points="2,5 10,5 8,3 10,5 8,7" fill="#7C2D12" stroke="#7C2D12" strokeWidth={0.7}/></svg>Уклон</div>
      <div className="legend-row"><svg width={14} height={10}><rect x={3} y={1} width={8} height={8} fill="#fff" stroke="#4A5365" strokeWidth={1.2}/><line x1={3} y1={1} x2={11} y2={9} stroke="#4A5365" strokeWidth={0.8}/></svg>Инж. выход</div>
      <div className="legend-row"><span className="legend-swatch" style={{ background: "rgba(124,58,237,0.16)", border: "1px dashed rgba(124,58,237,0.5)" }}/>Сегмент</div>
    </div>
  );
  return (
    <div className="canvas-legend">
      <div className="legend-row"><span className="legend-swatch" style={{ background: "var(--wall-external)", height: 6 }}/>Внешняя стена</div>
      <div className="legend-row"><span className="legend-swatch" style={{ background: "var(--wall-internal)", height: 3 }}/>Перегородка</div>
      <div className="legend-row"><span className="legend-swatch" style={{ background: "var(--window)" }}/>Окно</div>
      <div className="legend-row">
        <svg width={14} height={8} viewBox="0 0 14 8" style={{ overflow: "visible" }}>
          <path d="M0 8 A 8 8 0 0 1 8 0" fill="none" stroke="var(--door)" strokeWidth={1}/>
        </svg>
        Дверь
      </div>
    </div>
  );
}

// ============================================================
// Warnings overlay (top-right of canvas)
// ============================================================
function WarningsOverlay({ warnings, onJump }) {
  const [open, setOpen] = useState(false);
  const errs = warnings.filter(w => w.level === "error");
  const warns = warnings.filter(w => w.level === "warn");
  const infos = warnings.filter(w => w.level === "info");
  const tone = errs.length ? "error" : warns.length ? "warn" : "info";
  const count = warnings.length;
  return (
    <div className={`warnings-overlay tone-${tone}`}>
      <button className="warn-pill" onClick={() => setOpen(o => !o)}>
        <I.Info size={12}/> {count} {count === 1 ? "замечание" : "замечаний"}
      </button>
      {open && (
        <div className="warn-list">
          {warnings.map((w, i) => (
            <div key={i} className={`warn-item tone-${w.level}`} onClick={() => { if (w.targetId) onJump(w.targetId); }}>
              <span className={`dot tone-${w.level}`}/>
              <span>{w.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Status bar — extended with cursor coords, zoom, grid, selection, warnings
// ============================================================
function StatusBar({ mode, tool, level, stats, gridSize, viewState, hoverPoint, selected, warnings, selectedIds, visibleGridStep, savedAt, backgrounds }) {
  const isRoof = level.type === "roof" || level.type === "industrial_roof";
  const toolLabel = (() => {
    const ts = TOOLSETS[mode] || TOOLSETS.plan;
    return ts.find(t => !t.sep && t.id === tool)?.label || tool;
  })();
  const selCount = (selectedIds || []).length;
  const selType = (() => {
    if (selCount > 1) return `${selCount} элементов`;
    if (!selected) return null;
    const k = window.plClassifyObject ? window.plClassifyObject(selected) : null;
    const map = {
      wall_external: "Внешняя стена", wall_internal: "Перегородка",
      window: "Окно", door: "Дверь", opening: "Проём", room: "Помещение",
      aerator: "Аэратор", drain: "Воронка", slope: "Уклон", segment: "Сегмент кровли",
      parapet: "Парапет", junction: "Примыкание", engout: "Инж. выход",
      dimension: "Размер", note: "Заметка",
    };
    return map[k] || "Элемент";
  })();
  return (
    <div className="status-bar">
      <span className="sb-item"><b>{level.name}</b></span>
      <span className="sb-sep">·</span>
      <span className="sb-item">{MODES.find(m => m.id === mode)?.label || mode}</span>
      <span className="sb-sep">·</span>
      <span className="sb-item">Инструмент: <b>{toolLabel}</b></span>
      <span className="sb-sep">·</span>
      <span className="sb-item">Сетка: <b>{gridSize} м</b>{visibleGridStep > gridSize && <span style={{ color: "var(--text-muted)" }}> (вид: {visibleGridStep}м)</span>}</span>
      <span className="sb-sep">·</span>
      <span className="sb-item">Зум: <b>{Math.round(viewState.zoom * 100)}%</b></span>
      {hoverPoint && (<>
        <span className="sb-sep">·</span>
        <span className="sb-item sb-coords">X: <b>{hoverPoint.x.toFixed(2)}</b> · Y: <b>{hoverPoint.y.toFixed(2)}</b></span>
      </>)}
      {backgrounds && backgrounds.length > 0 && (<>
        <span className="sb-sep">·</span>
        <span className="sb-item" title={backgrounds.map(b => `${b.name} · ${b.scaleCalibrated ? "масштаб задан" : "без масштаба"} · ${Math.round((b.opacity || 0.6) * 100)}%`).join("\n")}>
          <I.Upload size={11}/> Подложка{backgrounds.length > 1 ? ` ×${backgrounds.length}` : ""}:{" "}
          <b>{backgrounds[0].scaleCalibrated ? "масштаб задан" : "без масштаба"}</b>
          {backgrounds[0].locked ? " · 🔒" : " · 🔓"}
        </span>
      </>)}
      <span className="sb-spacer"/>
      {warnings.length > 0 && (<>
        <span className="sb-item" style={{ color: warnings.some(w => w.level === "error") ? "#DC2626" : "var(--accent)" }}>
          <I.Info size={11}/> {warnings.length} замеч.
        </span>
        <span className="sb-sep">·</span>
      </>)}
      {selType && (<>
        <span className="sb-item">Выбрано: <b>{selType}</b></span>
        <span className="sb-sep">·</span>
      </>)}
      {isRoof ? (
        <>
          <span className="sb-item">Кровля: <b>{stats.roofArea?.toFixed(0) || 0} м²</b></span>
          <span className="sb-sep">·</span>
          <span className="sb-item">Аэраторы: <b>{stats.aeratorCount || 0}</b></span>
          <span className="sb-sep">·</span>
          <span className="sb-item">Воронки: <b>{stats.drainCount || 0}</b></span>
          <span className="sb-sep">·</span>
          <span className="sb-item">Парапет: <b>{stats.roofPerimeter?.toFixed(0) || 0} м</b></span>
        </>
      ) : (
        <>
          <span className="sb-item">Площадь: <b>{stats.totalArea.toFixed(0)} м²</b></span>
          <span className="sb-sep">·</span>
          <span className="sb-item">Стены: <b>{stats.extLen.toFixed(0)} м</b></span>
          <span className="sb-sep">·</span>
          <span className="sb-item">Окна: <b>{stats.winCount}</b></span>
          <span className="sb-sep">·</span>
          <span className="sb-item">Двери: <b>{stats.doorCount}</b></span>
        </>
      )}
    </div>
  );
}
