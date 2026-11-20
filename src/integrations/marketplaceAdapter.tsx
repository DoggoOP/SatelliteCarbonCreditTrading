import type { AnalysisResult } from "../lib/types";

/**
 * Integration slot for the marketplace module.
 *
 * When `src/features/marketplace` lands, replace these stubs with:
 *   export { MarketplacePage, createListingFromAnalysis } from "../features/marketplace";
 *   export const marketplaceReady = true;
 *
 * The analyze page already stores the latest result at
 * sessionStorage key `carbonsight:last-analysis` before calling
 * createListingFromAnalysis, and the nav already routes to /marketplace.
 */
export const marketplaceReady = false;

export function MarketplacePage() {
  const raw = typeof window !== "undefined" ? sessionStorage.getItem("carbonsight:last-analysis") : null;
  let area: string | null = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as AnalysisResult;
      area = `${Math.round(parsed.areaHa).toLocaleString("en-US")} ha · ${Math.round(parsed.carbon.stockTCo2e).toLocaleString("en-US")} tCO₂e`;
    } catch {
      area = null;
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Marketplace</p>
      <h1 className="mt-3 font-serif text-4xl text-pine">Credit desk</h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink/80">
        Listings, purchases, and the portfolio will mount here from the marketplace module. The route
        and the “List credits” action are already wired.
      </p>
      {area ? (
        <div className="mt-8 rounded-2xl border border-line bg-white px-5 py-4 shadow-panel">
          <p className="text-sm text-ink/60">Latest analysis waiting to be listed</p>
          <p className="mt-1 font-serif text-2xl text-pine">{area}</p>
        </div>
      ) : (
        <p className="mt-8 text-sm text-ink/60">Run an analysis first, then come back to list it.</p>
      )}
    </main>
  );
}

export function createListingFromAnalysis(_result: AnalysisResult): { id: string } | null {
  return null;
}
