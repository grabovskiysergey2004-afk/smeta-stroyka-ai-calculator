export type IterationZeroModule = {
  path: string;
  purpose: string;
};

export const iterationZeroModules: IterationZeroModule[] = [
  {
    path: "src/app",
    purpose: "application composition, routing, and feature orchestration",
  },
  {
    path: "src/domains/projects",
    purpose: "client projects, levels, and canvas element ownership",
  },
  {
    path: "src/domains/estimates",
    purpose: "estimate lines, formulas, quantities, and verification statuses",
  },
  {
    path: "src/domains/pricing",
    purpose: "price sources, suppliers, imported rows, and price mapping",
  },
  {
    path: "src/domains/proposals",
    purpose: "commercial proposal settings, works, margins, and export flow",
  },
  {
    path: "src/shared",
    purpose: "shared UI primitives, formatting helpers, and cross-domain utilities",
  },
];
