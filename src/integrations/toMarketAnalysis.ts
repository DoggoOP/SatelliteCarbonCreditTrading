import type { AnalysisResult as MarketAnalysis } from "../features/marketplace";
import type { AnalysisResult, Polygon } from "../lib/types";

/** Map a live analysis onto the marketplace listing contract. */
export function toMarketAnalysis(result: AnalysisResult, polygon: Polygon): MarketAnalysis {
  const span = Math.max(0, result.uncertainty.agbdHigh - result.uncertainty.agbdLow);
  const uncertaintyPct =
    result.biomass.densityMgHa > 0
      ? Math.min(100, Math.round((span / 2 / result.biomass.densityMgHa) * 1000) / 10)
      : 50;
  const sources = result.sources.map((source) => source.name.trim()).filter(Boolean);
  return {
    projectName: `Satellite AOI · ${Math.round(result.areaHa).toLocaleString("en-US")} ha`,
    polygon: {
      type: "Polygon",
      coordinates: polygon.coordinates.map((ring) => ring.map((position) => [position[0], position[1]] as [number, number])),
    },
    areaHa: result.areaHa,
    tCO2e: result.carbon.stockTCo2e,
    annualSequestrationTCO2e: result.carbon.annualSequestrationTCo2e,
    confidence: result.uncertainty.level,
    uncertaintyPct,
    dataSources: sources.length ? sources : ["Sentinel-2 L2A"],
  };
}
