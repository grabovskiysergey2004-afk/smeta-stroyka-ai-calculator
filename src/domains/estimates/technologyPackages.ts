import type { CanvasElementKind } from "../projects/types";
import type { EstimateSection } from "./types";

export type QuantityFormulaId =
  | "wall-net-area"
  | "opening-count"
  | "room-area"
  | "roof-area"
  | "foundation-volume";

export type TechnologyEstimateItem = {
  id: string;
  name: string;
  section: EstimateSection;
  unit: "m2" | "m3" | "pcs";
  quantityFormulaId: QuantityFormulaId;
  priceCode: string;
};

export type TechnologyPackage = {
  id: string;
  name: string;
  appliesTo: CanvasElementKind[];
  items: TechnologyEstimateItem[];
};

export const baseTechnologyPackages: TechnologyPackage[] = [
  {
    id: "wall-gasblock-400",
    name: "External wall gas block 400 mm",
    appliesTo: ["wall"],
    items: [
      {
        id: "wall-gasblock-400-masonry",
        name: "External wall masonry, gas block 400 mm",
        section: "box",
        unit: "m2",
        quantityFormulaId: "wall-net-area",
        priceCode: "wall.gasblock400.m2",
      },
    ],
  },
  {
    id: "partition-gasblock-100",
    name: "Internal partition gas block 100 mm",
    appliesTo: ["partition"],
    items: [
      {
        id: "partition-gasblock-100-masonry",
        name: "Internal partition masonry, gas block 100 mm",
        section: "box",
        unit: "m2",
        quantityFormulaId: "wall-net-area",
        priceCode: "partition.gasblock100.m2",
      },
    ],
  },
  {
    id: "window-basic",
    name: "Window supply and install",
    appliesTo: ["window"],
    items: [
      {
        id: "window-basic-pcs",
        name: "Window supply and install",
        section: "openings",
        unit: "pcs",
        quantityFormulaId: "opening-count",
        priceCode: "window.basic.pcs",
      },
    ],
  },
  {
    id: "door-basic",
    name: "Door supply and install",
    appliesTo: ["door"],
    items: [
      {
        id: "door-basic-pcs",
        name: "Door supply and install",
        section: "openings",
        unit: "pcs",
        quantityFormulaId: "opening-count",
        priceCode: "door.basic.pcs",
      },
    ],
  },
  {
    id: "floor-draft",
    name: "Draft floor package",
    appliesTo: ["room"],
    items: [
      {
        id: "floor-draft-area",
        name: "Draft floor by room area",
        section: "finishing",
        unit: "m2",
        quantityFormulaId: "room-area",
        priceCode: "floor.draft.m2",
      },
    ],
  },
  {
    id: "roof-metal",
    name: "Metal roof package",
    appliesTo: ["roof-segment"],
    items: [
      {
        id: "roof-metal-area",
        name: "Metal roof by slope area",
        section: "roof",
        unit: "m2",
        quantityFormulaId: "roof-area",
        priceCode: "roof.metal.m2",
      },
    ],
  },
  {
    id: "foundation-slab",
    name: "Monolithic slab foundation",
    appliesTo: ["foundation-segment"],
    items: [
      {
        id: "foundation-slab-concrete",
        name: "Monolithic slab concrete",
        section: "foundation",
        unit: "m3",
        quantityFormulaId: "foundation-volume",
        priceCode: "foundation.slab.concrete.m3",
      },
    ],
  },
];
