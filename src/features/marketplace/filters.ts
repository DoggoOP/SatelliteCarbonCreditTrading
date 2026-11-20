import type { CreditListing, ListingFilters } from "./types";

export const EMPTY_FILTERS: ListingFilters = {
  confidences: [],
  minPrice: null,
  maxPrice: null,
  region: null,
  hideSoldOut: false,
};

export function applyListingFilters(
  listings: readonly CreditListing[],
  filters: ListingFilters,
): CreditListing[] {
  return listings.filter((listing) => {
    if (filters.confidences.length > 0 && !filters.confidences.includes(listing.confidence)) {
      return false;
    }
    if (filters.region && listing.region !== filters.region) return false;
    if (filters.minPrice != null && listing.pricePerTCO2e < filters.minPrice) return false;
    if (filters.maxPrice != null && listing.pricePerTCO2e > filters.maxPrice) return false;
    if (filters.hideSoldOut && listing.availableTCO2e <= 0) return false;
    return true;
  });
}

export function regionsIn(listings: readonly CreditListing[]): string[] {
  return [...new Set(listings.map((listing) => listing.region))].sort((a, b) => a.localeCompare(b));
}
