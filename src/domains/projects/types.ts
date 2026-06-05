import type { MeasurementSource } from "../common/source";

export type ProjectKind = "house" | "bathhouse" | "garage" | "roof" | "terrace";

export type ProjectLevelKind =
  | "foundation"
  | "floor-1"
  | "floor-2"
  | "roof"
  | "garage"
  | "bathhouse"
  | "terrace";

export type CanvasElementKind =
  | "wall"
  | "partition"
  | "room"
  | "opening"
  | "window"
  | "door"
  | "roof-segment"
  | "foundation-segment";

export type Project = {
  id: string;
  name: string;
  kind: ProjectKind;
  currency: "RUB";
  levels: ProjectLevel[];
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectLevel = {
  id: string;
  name: string;
  kind: ProjectLevelKind;
  elements: CanvasElement[];
  heightMeters?: number;
};

export type Point = {
  x: number;
  y: number;
};

export type BaseCanvasElement = {
  id: string;
  kind: CanvasElementKind;
  name: string;
  includeInEstimate: boolean;
  source?: MeasurementSource;
};

export type WallElement = BaseCanvasElement & {
  kind: "wall" | "partition";
  start: Point;
  end: Point;
  heightMeters: number;
  thicknessMeters: number;
  technologyPackageId: string;
};

export type RoomElement = BaseCanvasElement & {
  kind: "room";
  areaM2?: number;
  polygon?: Point[];
  floorFinishPackageId?: string;
  ceilingFinishPackageId?: string;
};

export type OpeningElement = BaseCanvasElement & {
  kind: "window" | "door" | "opening";
  wallId: string;
  widthMeters: number;
  heightMeters: number;
  count: number;
  technologyPackageId?: string;
};

export type RoofSegmentElement = BaseCanvasElement & {
  kind: "roof-segment";
  areaM2?: number;
  polygon?: Point[];
  slopeCoefficient: number;
  technologyPackageId: string;
};

export type FoundationSegmentElement = BaseCanvasElement & {
  kind: "foundation-segment";
  areaM2: number;
  thicknessMeters: number;
  perimeterMeters?: number;
  technologyPackageId: string;
};

export type CanvasElement =
  | WallElement
  | RoomElement
  | OpeningElement
  | RoofSegmentElement
  | FoundationSegmentElement;
