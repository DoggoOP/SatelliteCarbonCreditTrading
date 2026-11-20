import { DEFAULT_ORGANIZATION_NAME, DEFAULT_TIER_ID } from "./constants";
import { createListingFromAnalysis } from "./createListingFromAnalysis";
import { DEMO_CATALOG } from "./catalog";
import type { CreditListing, MarketplaceSnapshot } from "./types";

const DEMO_CREATED_AT = new Date("2026-02-01T15:00:00.000Z");

export function createDemoListings(): CreditListing[] {
  return DEMO_CATALOG.map((entry, index) =>
    createListingFromAnalysis(entry.analysis, {
      id: entry.id,
      sellerName: entry.sellerName,
      pricePerTCO2e: entry.pricePerTCO2e,
      vintage: entry.vintage,
      demo: true,
      now: new Date(DEMO_CREATED_AT.getTime() + index * 86_400_000),
    }),
  );
}

export function createSeedSnapshot(
  organization: MarketplaceSnapshot["organization"] = {
    name: DEFAULT_ORGANIZATION_NAME,
    tierId: DEFAULT_TIER_ID,
  },
): MarketplaceSnapshot {
  return {
    version: 1,
    organization,
    listings: createDemoListings(),
    holdings: [],
    transactions: [],
  };
}

export function emptySnapshot(): MarketplaceSnapshot {
  return {
    version: 1,
    organization: { name: DEFAULT_ORGANIZATION_NAME, tierId: DEFAULT_TIER_ID },
    listings: [],
    holdings: [],
    transactions: [],
  };
}
