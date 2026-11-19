/**
 * Frozen API contract. Every teammate imports these types.
 * Do not rename fields. Add fields only if all four branches agree.
 *
 * Standing stock is not a carbon credit. Credits on this platform are
 * annual removals after a non-permanence buffer.
 */

export interface Polygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface AnalysisRequest {
  name: string;
  geometry: Polygon;
}

export type SourceStatus = "ok" | "partial" | "unavailable";

export interface DataSourceCitation {
  id: string;
  name: string;
  url: string;
  retrievedAt: string;
  status: SourceStatus;
  note: string;
}

export interface TimeSeriesPoint {
  date: string;
  ndvi: number | null;
  evi: number | null;
  cloudFraction: number | null;
  validPercent: number | null;
}

export type ConfidenceBand = "high" | "medium" | "low" | "insufficient";

export interface AnalysisResult {
  id: string;
  name: string;
  areaHa: number;
  analyzedAt: string;
  centroid: [number, number];
  bbox: [number, number, number, number];
  stock: {
    aboveGroundBiomassMgHa: number | null;
    carbonDensityTco2eHa: number | null;
    carbonStockTco2e: number | null;
    uncertaintyMgHa: number | null;
    method: string;
  };
  forecast: {
    annualTco2e: number | null;
    fiveYearTco2e: number | null;
    method: string;
  };
  vegetation: {
    ndviMean: number | null;
    eviMean: number | null;
    ndviTrendPerYear: number | null;
    forestFraction: number | null;
    timeseries: TimeSeriesPoint[];
  };
  uncertainty: {
    score: number;
    band: ConfidenceBand;
    drivers: string[];
    clearObservationCount: number;
  };
  credits: {
    /** Buffered annual removals. This is the only volume that may be listed. */
    annualIssuableTco2e: number | null;
    bufferFraction: number;
    suggestedPriceUsdPerTonne: number | null;
    disclaimer: string;
  };
  map: {
    sentinelItemId: string | null;
    sentinelTileTemplate: string | null;
    sentinelCloudCover: number | null;
    ndviTileTemplate: string | null;
  };
  sources: DataSourceCitation[];
  warnings: string[];
  liveData: boolean;
}

export interface CreditListing {
  id: string;
  analysisId: string;
  projectName: string;
  regionLabel: string;
  vintageYear: number;
  annualTco2e: number;
  remainingTco2e: number;
  pricePerTonneUsd: number;
  confidence: ConfidenceBand;
  status: "listed" | "sold_out";
  areaHa: number;
  carbonStockTco2e: number | null;
  methodNote: string;
  createdAt: string;
}

export interface Purchase {
  id: string;
  listingId: string;
  projectName: string;
  buyerName: string;
  tco2e: number;
  pricePerTonneUsd: number;
  grossUsd: number;
  feeUsd: number;
  developerProceedsUsd: number;
  purchasedAt: string;
}

export interface CreateListingRequest {
  analysis: AnalysisResult;
  pricePerTonneUsd?: number;
}

export interface PurchaseRequest {
  buyerName: string;
  tco2e: number;
}

export interface PurchaseReceipt {
  purchase: Purchase;
  listing: CreditListing;
}

export interface PortfolioSnapshot {
  listings: CreditListing[];
  purchases: Purchase[];
  totals: {
    listedTco2e: number;
    remainingTco2e: number;
    purchasedTco2e: number;
    grossUsd: number;
    feeUsd: number;
  };
}

export const PLATFORM_FEE_FRACTION = 0.08;
export const NON_PERMANENCE_BUFFER = 0.2;

export const CREDIT_DISCLAIMER =
  "Illustrative removal estimate from public satellite data, after a 20% non-permanence buffer. Not a Verra, Gold Standard, or ACR issuance.";
