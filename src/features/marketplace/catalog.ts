import type { AnalysisResult } from "./types";
import { squarePolygon } from "./region";

export interface CatalogProject {
  id: string;
  sellerName: string;
  pricePerTCO2e: number;
  vintage: number;
  analysis: AnalysisResult;
}

function project(
  id: string,
  sellerName: string,
  pricePerTCO2e: number,
  vintage: number,
  analysis: Omit<AnalysisResult, "polygon"> & { lon: number; lat: number },
): CatalogProject {
  const { lon, lat, ...rest } = analysis;
  return {
    id,
    sellerName,
    pricePerTCO2e,
    vintage,
    analysis: { ...rest, polygon: squarePolygon(lon, lat, 0.15) },
  };
}

/** Clearly demo projects. Listings built from these are flagged `demo: true`. */
export const DEMO_CATALOG: readonly CatalogProject[] = [
  project("demo_cedar", "Cascade Municipal Trust", 52, 2024, {
    projectName: "Cedar Bench Restoration",
    lon: -122.6,
    lat: 45.5,
    areaHa: 860,
    tCO2e: 42_000,
    annualSequestrationTCO2e: 1800,
    confidence: "High",
    uncertaintyPct: 11,
    dataSources: ["Sentinel-2 L2A", "GEDI L4A", "SRTM DEM"],
  }),
  project("demo_negro", "Rio Negro Cooperative", 28, 2025, {
    projectName: "Rio Negro Community Forest",
    lon: -63.2,
    lat: -2.4,
    areaHa: 4100,
    tCO2e: 210_000,
    annualSequestrationTCO2e: 6400,
    confidence: "Medium",
    uncertaintyPct: 24,
    dataSources: ["Landsat 8/9", "ESA WorldCover", "GEDI L4A"],
  }),
  project("demo_salonga", "Basin Stewardship Fund", 16, 2023, {
    projectName: "Salonga Buffer Corridor",
    lon: 21.4,
    lat: -1.2,
    areaHa: 1800,
    tCO2e: 90_000,
    annualSequestrationTCO2e: 2200,
    confidence: "Low",
    uncertaintyPct: 38,
    dataSources: ["Sentinel-2 L2A", "ESA WorldCover"],
  }),
  project("demo_kapuas", "Kapuas Village League", 34, 2024, {
    projectName: "Kapuas Peat Avoided Degradation",
    lon: 114.2,
    lat: -0.8,
    areaHa: 1260,
    tCO2e: 155_000,
    annualSequestrationTCO2e: 3100,
    confidence: "Medium",
    uncertaintyPct: 27,
    dataSources: ["Sentinel-1", "Sentinel-2 L2A", "GEDI L4A"],
  }),
  project("demo_varmland", "Värmland Forest Society", 44, 2025, {
    projectName: "Värmland Mixed Stand",
    lon: 13.2,
    lat: 59.8,
    areaHa: 540,
    tCO2e: 28_400,
    annualSequestrationTCO2e: 960,
    confidence: "High",
    uncertaintyPct: 9,
    dataSources: ["Landsat 8/9", "SRTM DEM", "National forest inventory"],
  }),
  project("demo_serra", "Serra do Mar Institute", 61, 2026, {
    projectName: "Serra do Mar Corridor",
    lon: -45.2,
    lat: -23.4,
    areaHa: 390,
    tCO2e: 18_200,
    annualSequestrationTCO2e: 740,
    confidence: "High",
    uncertaintyPct: 14,
    dataSources: ["Sentinel-2 L2A", "GEDI L4A"],
  }),
];

export const SAMPLE_ANALYSIS: AnalysisResult = {
  projectName: "Sample — Hillside Oak Plot",
  polygon: squarePolygon(-121.4, 44.2, 0.12),
  areaHa: 120,
  tCO2e: 6400,
  annualSequestrationTCO2e: 210,
  confidence: "High",
  uncertaintyPct: 12,
  dataSources: ["Sentinel-2 L2A", "GEDI L4A"],
};
