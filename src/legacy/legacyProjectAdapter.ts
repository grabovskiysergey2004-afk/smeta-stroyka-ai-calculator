import { generateEstimateDraft } from "../domains/estimates";
import { samplePriceCatalog } from "../domains/pricing";
import type { PriceCatalog } from "../domains/pricing";
import type { Project, ProjectLevelKind } from "../domains/projects";
import type { CanvasElement } from "../domains/projects/types";
import type { Estimate, EstimateLine, EstimateSection } from "../domains/estimates";

type LegacyLevel = {
  id: string;
  name?: string;
  type?: string;
  world?: { w: number; h: number };
};

type LegacyProject = {
  name?: string;
  levels?: LegacyLevel[];
  activeLevelId?: string;
  levelsData?: Record<string, LegacyLevelData>;
};

type LegacyLevelData = {
  walls?: LegacyWall[];
  windows?: LegacyOpening[];
  doors?: LegacyOpening[];
  openings?: LegacyOpening[];
  rooms?: LegacyRoom[];
  roof?: LegacyRoof | null;
};

type LegacyWall = {
  id?: string;
  type?: "external" | "internal";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  includeInEstimate?: boolean;
  height?: number;
  thickness?: number;
  sourceKind?: string;
  sourceLabel?: string;
};

type LegacyOpening = {
  id?: string;
  onIdx?: number;
  a?: number;
  b?: number;
  includeInEstimate?: boolean;
  gate?: boolean;
  sourceKind?: string;
  sourceLabel?: string;
};

type LegacyRoom = {
  id?: string;
  name?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  includeInEstimate?: boolean;
  sourceKind?: string;
  sourceLabel?: string;
};

type LegacyRoof = {
  contour?: Array<{ x: number; y: number }>;
  segments?: Array<{
    id?: string;
    name?: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    bounds?: { x: number; y: number; w: number; h: number };
    area?: number;
    includeInEstimate?: boolean;
    material?: string;
  }>;
  slope?: number;
  material?: string;
};

export type LegacyEstimateRow = {
  id: string;
  group: string;
  name: string;
  qty: number;
  unit: string;
  mat: number;
  work: number;
  total: number;
  source: string;
  include: boolean;
  status: EstimateLine["status"];
  warnings: string[];
  levelId?: string;
  levelName?: string;
  levelType?: string;
  typedLineId: string;
  unitPrice?: number;
};

export type LegacyEstimateResult = {
  domainProject: Project;
  estimate: Estimate;
  rows: LegacyEstimateRow[];
};

const SECTION_LABELS: Record<EstimateSection, string> = {
  foundation: "Фундамент",
  box: "Коробка",
  roof: "Кровля",
  openings: "Окна и двери",
  finishing: "Отделка",
  engineering: "Инженерные системы",
  additional: "Дополнительные работы",
};

const LINE_LABELS: Record<string, string> = {
  "External wall masonry, gas block 400 mm": "Внешние стены · газоблок 400 мм",
  "Internal partition masonry, gas block 100 mm": "Перегородки · газоблок 100 мм",
  "Window supply and install": "Окна · поставка и монтаж",
  "Door supply and install": "Двери · поставка и монтаж",
  "Draft floor by room area": "Черновой пол по площади помещений",
  "Metal roof by slope area": "Кровельное покрытие по площади скатов",
  "Monolithic slab concrete": "Фундаментная плита · бетон",
};

export function generateTypedLegacyEstimate(
  project: LegacyProject,
  priceCatalog: PriceCatalog = samplePriceCatalog,
): LegacyEstimateResult {
  const domainProject = convertLegacyProjectToDomain(project);
  const estimate = generateEstimateDraft({
    project: domainProject,
    priceCatalog,
    marginPercent: 22,
  });

  return {
    domainProject,
    estimate,
    rows: estimate.lines.map((line) => convertEstimateLineToLegacyRow(line, domainProject)),
  };
}

export function convertLegacyProjectToDomain(project: LegacyProject): Project {
  const levels = project.levels ?? [];

  return {
    id: "legacy-current-project",
    name: project.name || "Текущий проект",
    kind: "house",
    currency: "RUB",
    levels: levels.map((level, levelIndex) => {
      const data = project.levelsData?.[level.id] ?? {};
      return {
        id: level.id,
        name: level.name || `Уровень ${levelIndex + 1}`,
        kind: mapLevelKind(level.type, levelIndex),
        heightMeters: 2.8,
        elements: convertLegacyLevelElements(level, data),
      };
    }),
  };
}

function convertLegacyLevelElements(level: LegacyLevel, data: LegacyLevelData): CanvasElement[] {
  const elements: CanvasElement[] = [];
  const wallIdByIndex = new Map<number, string>();

  for (const [index, wall] of (data.walls ?? []).entries()) {
    const id = wall.id || `${level.id}-wall-${index + 1}`;
    wallIdByIndex.set(index, id);
    elements.push({
      id,
      kind: wall.type === "internal" ? "partition" : "wall",
      name: wall.type === "internal" ? "Перегородка" : "Внешняя стена",
      includeInEstimate: wall.includeInEstimate !== false,
      start: { x: wall.x1, y: wall.y1 },
      end: { x: wall.x2, y: wall.y2 },
      heightMeters: wall.height ?? 2.8,
      thicknessMeters: wall.thickness ?? (wall.type === "internal" ? 0.1 : 0.4),
      technologyPackageId:
        wall.type === "internal" ? "partition-gasblock-100" : "wall-gasblock-400",
      source: {
        kind: wall.sourceKind === "pdf" ? "pdf-candidate" : "canvas",
        elementId: id,
        levelId: level.id,
        description: wall.sourceLabel || "Legacy canvas wall.",
        confidence: wall.sourceKind === "pdf" ? 0.75 : 0.9,
      },
    });
  }

  for (const [index, window] of (data.windows ?? []).entries()) {
    elements.push(convertOpening(level.id, window, "window", index, wallIdByIndex));
  }

  for (const [index, door] of (data.doors ?? []).entries()) {
    elements.push(convertOpening(level.id, door, "door", index, wallIdByIndex));
  }

  for (const [index, opening] of (data.openings ?? []).entries()) {
    elements.push(convertOpening(level.id, opening, "opening", index, wallIdByIndex));
  }

  for (const [index, room] of (data.rooms ?? []).entries()) {
    const id = room.id || `${level.id}-room-${index + 1}`;
    elements.push({
      id,
      kind: "room",
      name: room.name || `Помещение ${index + 1}`,
      includeInEstimate: room.includeInEstimate !== false,
      areaM2: room.w * room.h,
      floorFinishPackageId: "floor-draft",
      source: {
        kind: room.sourceKind === "pdf" ? "pdf-candidate" : "canvas",
        elementId: id,
        levelId: level.id,
        description: room.sourceLabel || "Legacy canvas room area.",
        confidence: room.sourceKind === "pdf" ? 0.78 : 0.9,
      },
    });
  }

  for (const [index, roofElement] of convertLegacyRoof(level.id, data.roof).entries()) {
    elements.push({
      ...roofElement,
      id: roofElement.id || `${level.id}-roof-${index + 1}`,
    });
  }

  return elements;
}

function convertOpening(
  levelId: string,
  opening: LegacyOpening,
  kind: "window" | "door" | "opening",
  index: number,
  wallIdByIndex: Map<number, string>,
): CanvasElement {
  const id = opening.id || `${levelId}-${kind}-${index + 1}`;
  const widthMeters = opening.a != null && opening.b != null ? Math.abs(opening.b - opening.a) : 1;

  return {
    id,
    kind,
    name:
      kind === "window" ? "Окно" : kind === "door" ? (opening.gate ? "Ворота" : "Дверь") : "Проём",
    includeInEstimate: opening.includeInEstimate !== false,
    wallId: wallIdByIndex.get(opening.onIdx ?? -1) || `${levelId}-unlinked-wall`,
    widthMeters,
    heightMeters: kind === "window" ? 1.4 : kind === "door" ? 2.1 : 2.1,
    count: 1,
    technologyPackageId:
      kind === "window" ? "window-basic" : kind === "door" ? "door-basic" : undefined,
    source: {
      kind: opening.sourceKind === "pdf" ? "pdf-candidate" : "canvas",
      elementId: id,
      levelId,
      description: opening.sourceLabel || "Legacy canvas opening.",
      confidence: opening.sourceKind === "pdf" ? 0.72 : 0.88,
    },
  };
}

function convertLegacyRoof(levelId: string, roof: LegacyRoof | null | undefined): CanvasElement[] {
  if (!roof) return [];

  const elements: CanvasElement[] = [];
  const contourArea = roof.contour && roof.contour.length >= 3 ? polygonArea(roof.contour) : 0;

  if (contourArea > 0) {
    elements.push({
      id: `${levelId}-roof-contour`,
      kind: "roof-segment",
      name: roof.material || "Кровля по контуру",
      includeInEstimate: true,
      areaM2: contourArea,
      slopeCoefficient: 1 + Math.max(0, roof.slope ?? 0) / 100,
      technologyPackageId: "roof-metal",
      source: {
        kind: "canvas",
        elementId: `${levelId}-roof-contour`,
        levelId,
        description: "Legacy roof contour area.",
        formula: "polygon area * slope coefficient",
        confidence: 0.85,
      },
    });
  }

  for (const [index, segment] of (roof.segments ?? []).entries()) {
    const areaM2 =
      segment.area ??
      (segment.w && segment.h
        ? segment.w * segment.h
        : segment.bounds
          ? segment.bounds.w * segment.bounds.h
          : 0);
    if (areaM2 <= 0) continue;

    elements.push({
      id: segment.id || `${levelId}-roof-segment-${index + 1}`,
      kind: "roof-segment",
      name: segment.name || segment.material || `Сегмент кровли ${index + 1}`,
      includeInEstimate: segment.includeInEstimate !== false,
      areaM2,
      slopeCoefficient: 1 + Math.max(0, roof.slope ?? 0) / 100,
      technologyPackageId: "roof-metal",
      source: {
        kind: "canvas",
        elementId: segment.id || `${levelId}-roof-segment-${index + 1}`,
        levelId,
        description: "Legacy roof segment area.",
        formula: "segment area * slope coefficient",
        confidence: 0.82,
      },
    });
  }

  return elements;
}

function convertEstimateLineToLegacyRow(line: EstimateLine, project: Project): LegacyEstimateRow {
  const level = project.levels.find((item) => item.id === line.quantitySource.levelId);
  const unitPrice =
    line.quantity === 0 ? 0 : (line.materialTotal + line.laborTotal) / line.quantity;

  return {
    id: `typed-${line.id}`,
    group: `${level?.name || "Проект"} · ${SECTION_LABELS[line.section]}`,
    name: LINE_LABELS[line.name] || line.name,
    qty: line.quantity,
    unit: localizeUnit(line.unit),
    mat: line.materialUnitPrice,
    work: line.laborUnitPrice,
    total: line.total,
    source: `${line.priceReference.sourceName} · ${line.quantitySource.description}`,
    include: line.status !== "excluded",
    status: line.status,
    warnings: line.warnings,
    levelId: level?.id,
    levelName: level?.name,
    levelType: level?.kind,
    typedLineId: line.id,
    // Kept for current Result Center price override math.
    ...(unitPrice > 0 ? { unitPrice } : {}),
  };
}

function mapLevelKind(levelType: string | undefined, index: number): ProjectLevelKind {
  if (levelType === "roof" || levelType === "industrial_roof") return "roof";
  if (levelType === "garage") return "garage";
  if (levelType === "attic") return "floor-2";
  if (index === 0) return "floor-1";
  return "floor-2";
}

function localizeUnit(unit: string): string {
  if (unit === "m2") return "м2";
  if (unit === "m3") return "м3";
  if (unit === "pcs") return "шт";
  return unit;
}

function polygonArea(points: Array<{ x: number; y: number }>): number {
  if (points.length < 3) return 0;

  const sum = points.reduce((acc, point, index) => {
    const next = points[(index + 1) % points.length];
    return acc + point.x * next.y - next.x * point.y;
  }, 0);

  return Math.abs(sum) / 2;
}
