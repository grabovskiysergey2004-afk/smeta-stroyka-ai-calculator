import type { MeasurementSource, PriceReference, VerificationStatus } from "../common/source";
import type { PriceCatalog, PriceItem } from "../pricing/types";
import type {
  CanvasElement,
  FoundationSegmentElement,
  OpeningElement,
  Project,
  ProjectLevel,
  RoomElement,
  RoofSegmentElement,
  WallElement,
} from "../projects/types";
import { distanceMeters, polygonAreaM2, roundQuantity } from "./geometry";
import {
  baseTechnologyPackages,
  type TechnologyEstimateItem,
  type TechnologyPackage,
} from "./technologyPackages";
import type { Estimate, EstimateLine } from "./types";

type GenerateEstimateOptions = {
  project: Project;
  priceCatalog: PriceCatalog;
  technologyPackages?: TechnologyPackage[];
  marginPercent?: number;
  generatedAt?: string;
};

type QuantityResult = {
  quantity: number;
  source: MeasurementSource;
  warnings: string[];
};

export function generateEstimateDraft(options: GenerateEstimateOptions): Estimate {
  const technologyPackages = options.technologyPackages ?? baseTechnologyPackages;
  const marginPercent = options.marginPercent ?? 22;
  const lines: EstimateLine[] = [];

  for (const level of options.project.levels) {
    for (const element of level.elements) {
      if (!element.includeInEstimate) continue;

      const packageIds = getTechnologyPackageIds(element);
      for (const packageId of packageIds) {
        const technologyPackage = technologyPackages.find((item) => item.id === packageId);
        if (!technologyPackage) {
          lines.push(createMissingPackageLine(level, element, packageId));
          continue;
        }

        for (const item of technologyPackage.items) {
          const quantityResult = resolveQuantity(level, element, item);
          const priceItem = findPriceItem(options.priceCatalog, item.priceCode);
          const priceReference = createPriceReference(
            options.priceCatalog,
            item.priceCode,
            priceItem,
          );
          const priceWarnings = priceItem
            ? priceItem.requiresReview
              ? ["Price item requires review."]
              : []
            : [`Missing price for code ${item.priceCode}.`];
          const warnings = [...quantityResult.warnings, ...priceWarnings];
          const status = resolveLineStatus(element, priceItem, warnings);
          const materialUnitPrice = priceItem?.materialUnitPrice ?? 0;
          const laborUnitPrice = priceItem?.laborUnitPrice ?? 0;
          const quantity = roundQuantity(quantityResult.quantity);
          const materialTotal = roundMoney(quantity * materialUnitPrice);
          const laborTotal = roundMoney(quantity * laborUnitPrice);

          lines.push({
            id: `${level.id}:${element.id}:${item.id}`,
            section: item.section,
            name: item.name,
            quantity,
            unit: item.unit,
            materialUnitPrice,
            laborUnitPrice,
            materialTotal,
            laborTotal,
            total: roundMoney(materialTotal + laborTotal),
            quantitySource: quantityResult.source,
            priceReference,
            status,
            warnings,
          });
        }
      }
    }
  }

  const materialTotal = roundMoney(lines.reduce((sum, line) => sum + line.materialTotal, 0));
  const laborTotal = roundMoney(lines.reduce((sum, line) => sum + line.laborTotal, 0));
  const subtotal = roundMoney(materialTotal + laborTotal);
  const marginTotal = roundMoney(subtotal * (marginPercent / 100));
  const grandTotal = roundMoney(subtotal + marginTotal);

  return {
    id: `estimate-${options.project.id}`,
    projectId: options.project.id,
    projectName: options.project.name,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    currency: options.project.currency,
    marginPercent,
    lines,
    totals: {
      materialTotal,
      laborTotal,
      subtotal,
      marginTotal,
      grandTotal,
    },
  };
}

function getTechnologyPackageIds(element: CanvasElement): string[] {
  switch (element.kind) {
    case "wall":
    case "partition":
    case "roof-segment":
    case "foundation-segment":
      return [element.technologyPackageId];
    case "window":
    case "door":
    case "opening":
      return element.technologyPackageId ? [element.technologyPackageId] : [];
    case "room":
      return [element.floorFinishPackageId, element.ceilingFinishPackageId].filter(
        Boolean,
      ) as string[];
  }
}

function resolveQuantity(
  level: ProjectLevel,
  element: CanvasElement,
  item: TechnologyEstimateItem,
): QuantityResult {
  switch (item.quantityFormulaId) {
    case "wall-net-area":
      return wallNetArea(level, element as WallElement);
    case "opening-count":
      return openingCount(level, element as OpeningElement);
    case "room-area":
      return roomArea(level, element as RoomElement);
    case "roof-area":
      return roofArea(level, element as RoofSegmentElement);
    case "foundation-volume":
      return foundationVolume(level, element as FoundationSegmentElement);
  }
}

function wallNetArea(level: ProjectLevel, wall: WallElement): QuantityResult {
  const length = distanceMeters(wall.start, wall.end);
  const grossArea = length * wall.heightMeters;
  const openings = level.elements.filter(
    (element): element is OpeningElement =>
      isOpeningElement(element) && element.wallId === wall.id && element.includeInEstimate,
  );
  const openingArea = openings.reduce(
    (sum, opening) => sum + opening.widthMeters * opening.heightMeters * opening.count,
    0,
  );
  const netArea = grossArea - openingArea;
  const warnings = [];

  if (openingArea > grossArea) {
    warnings.push("Opening area is larger than wall gross area.");
  }

  return {
    quantity: Math.max(0, netArea),
    source: {
      kind: "canvas",
      elementId: wall.id,
      levelId: level.id,
      description: `${wall.name}: wall length x height minus linked openings.`,
      formula: `(${roundQuantity(length)} m * ${wall.heightMeters} m) - ${roundQuantity(openingArea)} m2`,
      confidence: warnings.length ? 0.65 : 0.95,
    },
    warnings,
  };
}

function isOpeningElement(element: CanvasElement): element is OpeningElement {
  return element.kind === "window" || element.kind === "door" || element.kind === "opening";
}

function openingCount(level: ProjectLevel, opening: OpeningElement): QuantityResult {
  return {
    quantity: opening.count,
    source: {
      kind: "canvas",
      elementId: opening.id,
      levelId: level.id,
      description: `${opening.name}: opening count from canvas.`,
      formula: `${opening.count} pcs`,
      confidence: 0.9,
    },
    warnings: [],
  };
}

function roomArea(level: ProjectLevel, room: RoomElement): QuantityResult {
  const area = room.areaM2 ?? (room.polygon ? polygonAreaM2(room.polygon) : 0);
  const warnings = area <= 0 ? ["Room area is empty."] : [];

  return {
    quantity: area,
    source: {
      kind: "canvas",
      elementId: room.id,
      levelId: level.id,
      description: `${room.name}: room area.`,
      formula: room.areaM2 ? `${room.areaM2} m2` : "polygon area",
      confidence: warnings.length ? 0.5 : 0.9,
    },
    warnings,
  };
}

function roofArea(level: ProjectLevel, roofSegment: RoofSegmentElement): QuantityResult {
  const planArea =
    roofSegment.areaM2 ?? (roofSegment.polygon ? polygonAreaM2(roofSegment.polygon) : 0);
  const quantity = planArea * roofSegment.slopeCoefficient;
  const warnings = planArea <= 0 ? ["Roof segment area is empty."] : [];

  return {
    quantity,
    source: {
      kind: "canvas",
      elementId: roofSegment.id,
      levelId: level.id,
      description: `${roofSegment.name}: plan area x slope coefficient.`,
      formula: `${roundQuantity(planArea)} m2 * ${roofSegment.slopeCoefficient}`,
      confidence: warnings.length ? 0.55 : 0.88,
    },
    warnings,
  };
}

function foundationVolume(
  level: ProjectLevel,
  foundation: FoundationSegmentElement,
): QuantityResult {
  const quantity = foundation.areaM2 * foundation.thicknessMeters;
  const warnings = foundation.thicknessMeters <= 0 ? ["Foundation thickness is empty."] : [];

  return {
    quantity,
    source: {
      kind: "canvas",
      elementId: foundation.id,
      levelId: level.id,
      description: `${foundation.name}: slab area x thickness.`,
      formula: `${foundation.areaM2} m2 * ${foundation.thicknessMeters} m`,
      confidence: warnings.length ? 0.55 : 0.9,
    },
    warnings,
  };
}

function findPriceItem(priceCatalog: PriceCatalog, priceCode: string): PriceItem | undefined {
  return priceCatalog.items.find((item) => item.code === priceCode);
}

function createPriceReference(
  priceCatalog: PriceCatalog,
  priceCode: string,
  priceItem: PriceItem | undefined,
): PriceReference {
  return {
    priceItemId: priceItem?.id,
    priceSourceId: priceCatalog.source.id,
    priceCode,
    sourceName: priceCatalog.source.name,
    status: priceItem ? "from-price-list" : "missing",
  };
}

function resolveLineStatus(
  element: CanvasElement,
  priceItem: PriceItem | undefined,
  warnings: string[],
): VerificationStatus {
  if (!element.includeInEstimate) return "excluded";
  if (!priceItem || warnings.length > 0) return "needs-review";
  return "calculated";
}

function createMissingPackageLine(
  level: ProjectLevel,
  element: CanvasElement,
  packageId: string,
): EstimateLine {
  return {
    id: `${level.id}:${element.id}:missing-package:${packageId}`,
    section: "additional",
    name: `Missing technology package: ${packageId}`,
    quantity: 0,
    unit: "pcs",
    materialUnitPrice: 0,
    laborUnitPrice: 0,
    materialTotal: 0,
    laborTotal: 0,
    total: 0,
    quantitySource: {
      kind: "canvas",
      elementId: element.id,
      levelId: level.id,
      description: `${element.name}: technology package is missing.`,
      confidence: 0,
    },
    priceReference: {
      priceCode: packageId,
      sourceName: "No price source",
      status: "missing",
    },
    status: "needs-review",
    warnings: [`Technology package ${packageId} was not found.`],
  };
}

function roundMoney(value: number): number {
  return Math.round(value);
}
