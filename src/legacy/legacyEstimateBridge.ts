import {
  mergeWithSampleCatalog,
  parsePriceCatalogInput,
  samplePriceCatalog,
  summarizePriceCatalog,
} from "../domains/pricing";
import type { PriceCatalog } from "../domains/pricing";
import { generateTypedLegacyEstimate } from "./legacyProjectAdapter";

declare global {
  interface Window {
    plTypedEstimateEngine?: {
      generate(project: unknown): ReturnType<typeof generateTypedLegacyEstimate>;
      getPriceCatalog(): PriceCatalog;
      setPriceCatalog(catalog: PriceCatalog): void;
    };
    plPriceCatalogTools?: {
      parse(input: Parameters<typeof parsePriceCatalogInput>[0]): PriceCatalog;
      mergeWithSample(catalog: PriceCatalog): PriceCatalog;
      summarize(catalog: PriceCatalog): ReturnType<typeof summarizePriceCatalog>;
      loadCurrent(): Promise<PriceCatalog>;
      saveCurrent(catalog: PriceCatalog): Promise<unknown>;
    };
  }
}

let activePriceCatalog: PriceCatalog = samplePriceCatalog;

async function loadCurrentPriceCatalog(): Promise<PriceCatalog> {
  const response = await fetch("/api/prices/current");
  if (!response.ok) return activePriceCatalog;
  const payload = (await response.json()) as { catalog?: PriceCatalog | null };
  if (payload.catalog) {
    activePriceCatalog = mergeWithSampleCatalog(payload.catalog);
    window.dispatchEvent(new CustomEvent("pl-price-catalog-updated"));
  }
  return activePriceCatalog;
}

async function saveCurrentPriceCatalog(catalog: PriceCatalog): Promise<unknown> {
  activePriceCatalog = mergeWithSampleCatalog(catalog);
  const response = await fetch("/api/prices/current", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ catalog: activePriceCatalog }),
  });
  const payload = await response.json().catch(() => ({}));
  window.dispatchEvent(new CustomEvent("pl-price-catalog-updated"));
  return payload;
}

window.plTypedEstimateEngine = {
  generate(project: unknown) {
    return generateTypedLegacyEstimate(
      project as Parameters<typeof generateTypedLegacyEstimate>[0],
      activePriceCatalog,
    );
  },
  getPriceCatalog() {
    return activePriceCatalog;
  },
  setPriceCatalog(catalog: PriceCatalog) {
    activePriceCatalog = mergeWithSampleCatalog(catalog);
    window.dispatchEvent(new CustomEvent("pl-price-catalog-updated"));
  },
};

window.plPriceCatalogTools = {
  parse: parsePriceCatalogInput,
  mergeWithSample: mergeWithSampleCatalog,
  summarize: summarizePriceCatalog,
  loadCurrent: loadCurrentPriceCatalog,
  saveCurrent: saveCurrentPriceCatalog,
};

void loadCurrentPriceCatalog();
window.dispatchEvent(new CustomEvent("pl-typed-estimate-ready"));
