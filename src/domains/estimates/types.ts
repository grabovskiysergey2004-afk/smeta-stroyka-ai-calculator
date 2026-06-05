import type { MeasurementSource, PriceReference, VerificationStatus } from "../common/source";

export type EstimateStatus = VerificationStatus;

export type EstimateSection =
  | "foundation"
  | "box"
  | "roof"
  | "openings"
  | "finishing"
  | "engineering"
  | "additional";

export type EstimateLine = {
  id: string;
  section: EstimateSection;
  name: string;
  quantity: number;
  unit: string;
  materialUnitPrice: number;
  laborUnitPrice: number;
  materialTotal: number;
  laborTotal: number;
  total: number;
  quantitySource: MeasurementSource;
  priceReference: PriceReference;
  status: EstimateStatus;
  warnings: string[];
};

export type EstimateTotals = {
  materialTotal: number;
  laborTotal: number;
  subtotal: number;
  marginTotal: number;
  grandTotal: number;
};

export type Estimate = {
  id: string;
  projectId: string;
  projectName: string;
  generatedAt: string;
  currency: "RUB";
  marginPercent: number;
  lines: EstimateLine[];
  totals: EstimateTotals;
};
