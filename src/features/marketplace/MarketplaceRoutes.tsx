import { Route, Routes } from "react-router-dom";
import { MarketplaceChrome } from "./components/MarketplaceChrome";
import { MarketplaceProvider } from "./context";
import { BrowsePage } from "./pages/BrowsePage";
import { ListCreditsPage } from "./pages/ListCreditsPage";
import { ListingDetailPage } from "./pages/ListingDetailPage";
import { PortfolioPage } from "./pages/PortfolioPage";
import type { MarketplaceStore } from "./store/marketplaceStore";
import type { AnalysisResult } from "./types";

/**
 * Mount inside an existing router:
 *
 *   <Route path="/marketplace/*" element={<MarketplaceRoutes />} />
 *
 * Pass `initialAnalysis` to prefill the list form from the map flow.
 * Pass `store` to inject a repository-backed store (tests, or a future API).
 */
export function MarketplaceRoutes({
  store,
  initialAnalysis,
}: {
  store?: MarketplaceStore;
  initialAnalysis?: AnalysisResult;
} = {}) {
  return (
    <MarketplaceProvider store={store}>
      <Routes>
        <Route element={<MarketplaceChrome />}>
          <Route index element={<BrowsePage />} />
          <Route path="list" element={<ListCreditsPage initialAnalysis={initialAnalysis} />} />
          <Route path="listing/:listingId" element={<ListingDetailPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
        </Route>
      </Routes>
    </MarketplaceProvider>
  );
}
