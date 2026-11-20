import { issuanceRuleText, isConfidence, issueCredits } from "./creditMath";
import { MarketplaceError } from "./errors";
import { createId } from "./ids";
import { roundUsd } from "./money";
import { inferRegion } from "./region";
import type { AnalysisPolygon, AnalysisResult, CreditListing, GeoJsonPosition, ListingTerms } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPosition(value: unknown): value is GeoJsonPosition {
  return (
    Array.isArray(value) &&
    (value.length === 2 || value.length === 3) &&
    value.every((part) => typeof part === "number" && Number.isFinite(part))
  );
}

function isRing(value: unknown): value is GeoJsonPosition[] {
  return Array.isArray(value) && value.length >= 4 && value.every(isPosition);
}

export function isAnalysisPolygon(value: unknown): value is AnalysisPolygon {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (value.type === "Polygon") {
    return Array.isArray(value.coordinates) && value.coordinates.length > 0 && value.coordinates.every(isRing);
  }
  if (value.type === "MultiPolygon") {
    return (
      Array.isArray(value.coordinates) &&
      value.coordinates.length > 0 &&
      value.coordinates.every(
        (polygon) => Array.isArray(polygon) && polygon.length > 0 && polygon.every(isRing),
      )
    );
  }
  if (value.type === "Feature") {
    return isAnalysisPolygon(value.geometry);
  }
  return false;
}

function requireText(value: string, code: string, message: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new MarketplaceError(code, message);
  return trimmed;
}

/**
 * Turn an analysis result into a listable credit. Pure: nothing is stored.
 * Bankable volume follows the buffer rule in `ISSUANCE_RULE`.
 */
export function createListingFromAnalysis(analysis: AnalysisResult, terms: ListingTerms): CreditListing {
  const projectName = requireText(analysis.projectName ?? "", "bad_project", "Project name is required.");
  const sellerName = requireText(terms.sellerName ?? "", "bad_seller", "Seller name is required.");

  if (!isAnalysisPolygon(analysis.polygon)) {
    throw new MarketplaceError(
      "bad_polygon",
      "Polygon must be a GeoJSON Polygon, MultiPolygon, or Feature with one of those geometries.",
    );
  }
  if (!Number.isFinite(analysis.areaHa) || analysis.areaHa <= 0) {
    throw new MarketplaceError("bad_area", "Area must be greater than zero hectares.");
  }
  if (!Number.isFinite(analysis.tCO2e) || analysis.tCO2e < 0) {
    throw new MarketplaceError("bad_stock", "Standing stock must be zero or greater.");
  }
  if (!Number.isFinite(analysis.annualSequestrationTCO2e) || analysis.annualSequestrationTCO2e <= 0) {
    throw new MarketplaceError("bad_sequestration", "Annual sequestration must be greater than zero.");
  }
  if (!isConfidence(analysis.confidence)) {
    throw new MarketplaceError("bad_confidence", "Confidence must be High, Medium, or Low.");
  }
  if (
    !Number.isFinite(analysis.uncertaintyPct) ||
    analysis.uncertaintyPct < 0 ||
    analysis.uncertaintyPct > 100
  ) {
    throw new MarketplaceError("bad_uncertainty", "Uncertainty must be a percent from 0 to 100.");
  }
  if (
    !Array.isArray(analysis.dataSources) ||
    analysis.dataSources.length === 0 ||
    analysis.dataSources.some((source) => typeof source !== "string" || source.trim() === "")
  ) {
    throw new MarketplaceError("bad_sources", "At least one data source is required.");
  }
  if (!Number.isFinite(terms.pricePerTCO2e) || terms.pricePerTCO2e <= 0 || terms.pricePerTCO2e > 100_000) {
    throw new MarketplaceError("bad_price", "Price per tCO2e must be greater than zero and at most $100,000.");
  }
  if (!Number.isInteger(terms.vintage) || terms.vintage < 2000 || terms.vintage > 2100) {
    throw new MarketplaceError("bad_vintage", "Vintage must be a year from 2000 through 2100.");
  }

  const issuance = issueCredits(analysis.annualSequestrationTCO2e, analysis.confidence);
  if (issuance.bankableTCO2e <= 0) {
    throw new MarketplaceError(
      "nothing_bankable",
      "The buffer leaves no bankable tonnes. Increase annual sequestration before listing.",
    );
  }

  const region = terms.region?.trim() || inferRegion(analysis.polygon);
  const createdAt = (terms.now ?? new Date()).toISOString();

  return {
    id: terms.id ?? createId("lst"),
    demo: terms.demo ?? false,
    projectName,
    sellerName,
    region,
    polygon: analysis.polygon,
    areaHa: analysis.areaHa,
    stockTCO2e: analysis.tCO2e,
    annualSequestrationTCO2e: analysis.annualSequestrationTCO2e,
    confidence: analysis.confidence,
    uncertaintyPct: analysis.uncertaintyPct,
    dataSources: analysis.dataSources.map((source) => source.trim()),
    vintage: terms.vintage,
    grossTCO2e: issuance.grossTCO2e,
    bufferPct: issuance.bufferPct,
    bufferTCO2e: issuance.bufferTCO2e,
    bankableTCO2e: issuance.bankableTCO2e,
    availableTCO2e: issuance.bankableTCO2e,
    pricePerTCO2e: roundUsd(terms.pricePerTCO2e),
    createdAt,
    rule: issuanceRuleText(),
  };
}
