import { samplePriceCatalog } from "./sampleCatalog";
import type { PriceCatalog, PriceItem, PriceSource, PriceSourceKind } from "./types";

export type ImportedPriceCatalogInput = {
  fileName: string;
  text: string;
  supplierName?: string;
  importedAt?: string;
};

type RawPriceItem = Partial<Record<keyof PriceItem, unknown>> & Record<string, unknown>;

const COLUMN_ALIASES: Record<string, keyof PriceItem> = {
  code: "code",
  pricecode: "code",
  price_code: "code",
  article: "code",
  category: "category",
  cat: "category",
  name: "name",
  title: "name",
  unit: "unit",
  uom: "unit",
  material: "materialUnitPrice",
  materialprice: "materialUnitPrice",
  material_unit_price: "materialUnitPrice",
  materialunitprice: "materialUnitPrice",
  mat: "materialUnitPrice",
  labor: "laborUnitPrice",
  labour: "laborUnitPrice",
  work: "laborUnitPrice",
  laborprice: "laborUnitPrice",
  labor_unit_price: "laborUnitPrice",
  laborunitprice: "laborUnitPrice",
  requiresreview: "requiresReview",
  requires_review: "requiresReview",
  review: "requiresReview",
  sourceid: "sourceId",
  source_id: "sourceId",
  id: "id",
};

export function parsePriceCatalogInput(input: ImportedPriceCatalogInput): PriceCatalog {
  const fileKind = resolveFileKind(input.fileName);
  const importedAt = input.importedAt ?? new Date().toISOString();

  if (fileKind === "json") {
    return parseJsonCatalog(input, importedAt);
  }

  if (fileKind === "csv") {
    return parseCsvCatalog(input, importedAt);
  }

  throw new Error("Supported price file formats: .json and .csv.");
}

export function mergeWithSampleCatalog(imported: PriceCatalog): PriceCatalog {
  const importedByCode = new Map(imported.items.map((item) => [item.code, item]));
  const mergedItems = samplePriceCatalog.items.map((sampleItem) => {
    const importedItem = importedByCode.get(sampleItem.code);
    if (!importedItem) return { ...sampleItem, requiresReview: true };
    return {
      ...sampleItem,
      ...importedItem,
      id: importedItem.id || sampleItem.id,
      sourceId: imported.source.id,
      requiresReview: importedItem.requiresReview,
    };
  });

  for (const item of imported.items) {
    if (!samplePriceCatalog.items.some((sampleItem) => sampleItem.code === item.code)) {
      mergedItems.push({ ...item, sourceId: imported.source.id });
    }
  }

  return {
    source:
      mergedItems.length === imported.items.length
        ? imported.source
        : {
            ...imported.source,
            name: `${imported.source.name} + демо-подстановка`,
          },
    items: mergedItems,
  };
}

export function summarizePriceCatalog(catalog: PriceCatalog) {
  const reviewItems = catalog.items.filter((item) => item.requiresReview).length;
  const categories = Array.from(new Set(catalog.items.map((item) => item.category))).sort();

  return {
    sourceName: catalog.source.name,
    supplierName: catalog.source.supplierName ?? "",
    kind: catalog.source.kind,
    importedAt: catalog.source.importedAt,
    items: catalog.items.length,
    categories: categories.length,
    reviewItems,
  };
}

function parseJsonCatalog(input: ImportedPriceCatalogInput, importedAt: string): PriceCatalog {
  const parsed = JSON.parse(input.text) as PriceCatalog | PriceItem[] | { items?: RawPriceItem[] };
  const rawItems = Array.isArray(parsed) ? parsed : parsed.items;
  if (!rawItems || !Array.isArray(rawItems)) {
    throw new Error("JSON price catalog must be an array or an object with items[].");
  }

  const parsedSource =
    !Array.isArray(parsed) && "source" in parsed && parsed.source ? parsed.source : undefined;
  const source: PriceSource = Array.isArray(parsed)
    ? createSource(input, "manual", importedAt)
    : {
        ...createSource(input, (parsedSource?.kind as PriceSourceKind) || "manual", importedAt),
        ...parsedSource,
        importedAt,
        supplierName: input.supplierName || parsedSource?.supplierName,
      };

  return {
    source,
    items: rawItems.map((item, index) => normalizePriceItem(item, source, index)),
  };
}

function parseCsvCatalog(input: ImportedPriceCatalogInput, importedAt: string): PriceCatalog {
  const rows = parseCsvRows(input.text);
  if (rows.length < 2) {
    throw new Error("CSV price catalog must contain a header row and at least one item.");
  }

  const headers = rows[0].map((header) => normalizeHeader(header));
  const source = createSource(input, "csv", importedAt);
  const items = rows.slice(1).map((row, index) => {
    const rawItem: RawPriceItem = {};
    row.forEach((value, columnIndex) => {
      const target = COLUMN_ALIASES[headers[columnIndex]];
      if (target) rawItem[target] = value;
    });
    return normalizePriceItem(rawItem, source, index);
  });

  return { source, items };
}

function normalizePriceItem(item: RawPriceItem, source: PriceSource, index: number): PriceItem {
  const code = stringValue(item.code);
  if (!code) {
    throw new Error(`Price item #${index + 1} is missing code.`);
  }

  return {
    id: stringValue(item.id) || `price-${source.id}-${index + 1}`,
    sourceId: source.id,
    code,
    category: stringValue(item.category) || "Импорт",
    name: stringValue(item.name) || code,
    unit: stringValue(item.unit) || "pcs",
    materialUnitPrice: moneyValue(item.materialUnitPrice),
    laborUnitPrice: moneyValue(item.laborUnitPrice),
    requiresReview: booleanValue(item.requiresReview),
  };
}

function createSource(
  input: ImportedPriceCatalogInput,
  kind: PriceSourceKind | "json",
  importedAt: string,
): PriceSource {
  const cleanName = input.fileName.replace(/\.[^.]+$/, "");
  return {
    id: slugify(cleanName || "imported-price"),
    name: cleanName || "Импортированный прайс",
    kind: kind === "json" ? "manual" : kind,
    supplierName: input.supplierName || cleanName || undefined,
    importedAt,
  };
}

function resolveFileKind(fileName: string): "json" | "csv" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".csv")) return "csv";
  return "csv";
}

function parseCsvRows(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function detectDelimiter(text: string): "," | ";" {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  return firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
}

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[\s.-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function moneyValue(value: unknown): number {
  if (typeof value === "number") return Math.round(value);
  const normalized = stringValue(value)
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function booleanValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = stringValue(value).toLowerCase();
  return ["1", "true", "yes", "y", "да", "review", "needs-review"].includes(normalized);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "imported-price";
}
