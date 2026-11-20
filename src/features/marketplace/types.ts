export type Confidence = "High" | "Medium" | "Low";

export type TierId = "starter" | "growth" | "enterprise";

export type GeoJsonPosition = [number, number] | [number, number, number];

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: GeoJsonPosition[][];
}

export interface GeoJsonMultiPolygon {
  type: "MultiPolygon";
  coordinates: GeoJsonPosition[][][];
}

export interface GeoJsonFeature {
  type: "Feature";
  geometry: GeoJsonPolygon | GeoJsonMultiPolygon | null;
  properties?: Record<string, unknown> | null;
}

/** Polygon accepted from the analysis app. Feature, Polygon, or MultiPolygon. */
export type AnalysisPolygon = GeoJsonPolygon | GeoJsonMultiPolygon | GeoJsonFeature;

/**
 * Result produced by the map analysis flow. Standing stock (`tCO2e`) is
 * disclosed; tradeable credits are issued from `annualSequestrationTCO2e`.
 */
export interface AnalysisResult {
  projectName: string;
  polygon: AnalysisPolygon;
  areaHa: number;
  tCO2e: number;
  annualSequestrationTCO2e: number;
  confidence: Confidence;
  uncertaintyPct: number;
  dataSources: string[];
}

export interface ListingTerms {
  pricePerTCO2e: number;
  vintage: number;
  sellerName: string;
  /** Overrides the region inferred from the polygon centroid. */
  region?: string;
  id?: string;
  demo?: boolean;
  now?: Date;
}

export interface CreditListing {
  id: string;
  demo: boolean;
  projectName: string;
  sellerName: string;
  region: string;
  polygon: AnalysisPolygon;
  areaHa: number;
  stockTCO2e: number;
  annualSequestrationTCO2e: number;
  confidence: Confidence;
  uncertaintyPct: number;
  dataSources: string[];
  vintage: number;
  grossTCO2e: number;
  bufferPct: number;
  bufferTCO2e: number;
  bankableTCO2e: number;
  availableTCO2e: number;
  pricePerTCO2e: number;
  createdAt: string;
  /** Snapshot of the issuance rule at listing time. */
  rule: string;
}

export interface Holding {
  id: string;
  listingId: string;
  projectName: string;
  region: string;
  vintage: number;
  confidence: Confidence;
  pricePerTCO2e: number;
  /** Tonnes still held and not retired. */
  quantityTCO2e: number;
  retiredTCO2e: number;
  acquiredAt: string;
}

export type TransactionKind = "issuance" | "purchase" | "retirement";

export interface LedgerTransaction {
  id: string;
  kind: TransactionKind;
  at: string;
  projectName: string;
  listingId: string;
  holdingId?: string;
  quantityTCO2e: number;
  pricePerTCO2e: number | null;
  subtotalUsd: number;
  successFeePct: number;
  successFeeUsd: number;
  sellerNetUsd: number;
  buyerPaysUsd: number;
  counterparty: string;
  note: string;
}

export interface Organization {
  name: string;
  tierId: TierId;
}

export interface MarketplaceSnapshot {
  version: 1;
  organization: Organization;
  listings: CreditListing[];
  holdings: Holding[];
  transactions: LedgerTransaction[];
}

export interface ListingFilters {
  /** Empty means every confidence band. */
  confidences: Confidence[];
  minPrice: number | null;
  maxPrice: number | null;
  /** Null means every region. */
  region: string | null;
  hideSoldOut: boolean;
}

export interface PurchaseQuote {
  quantityTCO2e: number;
  pricePerTCO2e: number;
  subtotalUsd: number;
  successFeePct: number;
  successFeeUsd: number;
  sellerNetUsd: number;
  buyerPaysUsd: number;
}

export interface Issuance {
  grossTCO2e: number;
  bufferPct: number;
  bufferTCO2e: number;
  bankableTCO2e: number;
}
