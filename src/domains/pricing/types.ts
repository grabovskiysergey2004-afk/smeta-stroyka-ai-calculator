export type PriceSourceKind = "csv" | "xlsx" | "pdf" | "manual";

export type PriceSource = {
  id: string;
  name: string;
  kind: PriceSourceKind;
  supplierName?: string;
  importedAt: string;
};

export type PriceItem = {
  id: string;
  sourceId: string;
  code: string;
  category: string;
  name: string;
  unit: string;
  materialUnitPrice: number;
  laborUnitPrice: number;
  requiresReview: boolean;
};

export type PriceCatalog = {
  source: PriceSource;
  items: PriceItem[];
};
