export type MeasurementSourceKind = "canvas" | "pdf-candidate" | "manual" | "template";

export type VerificationStatus = "calculated" | "needs-review" | "manual-adjustment" | "excluded";

export type MeasurementSource = {
  kind: MeasurementSourceKind;
  elementId?: string;
  levelId?: string;
  description: string;
  formula?: string;
  confidence?: number;
};

export type PriceReference = {
  priceItemId?: string;
  priceSourceId?: string;
  priceCode: string;
  sourceName: string;
  status: "from-price-list" | "manual" | "missing";
};
