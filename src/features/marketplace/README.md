# Marketplace

Self-contained credit book for CarbonSight. Mount it from the shell with one route. Everything under this folder is the feature: issuance math, listings, purchases, retirement, plans, and a `localStorage` repository.

## Mount

Peer dependencies: `react`, `react-dom`, `react-router-dom` (v6 or v7). Tailwind has to scan this folder. In Tailwind v3:

```js
content: ["./src/features/marketplace/**/*.{ts,tsx}"]
```

```tsx
import { Route, Routes } from "react-router-dom";
import { MarketplaceRoutes } from "./features/marketplace";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/marketplace/*" element={<MarketplaceRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}
```

`MarketplaceRoutes` renders Browse (`/marketplace`), List credits (`/marketplace/list`), a listing (`/marketplace/listing/:listingId`), and Portfolio (`/marketplace/portfolio`).

To hand a finished analysis into the list form:

```tsx
<Route
  path="/marketplace/*"
  element={<MarketplaceRoutes initialAnalysis={analysis} />}
/>
```

`analysis` matches `AnalysisResult`: `{ projectName, polygon, areaHa, tCO2e, annualSequestrationTCO2e, confidence, uncertaintyPct, dataSources }`. `polygon` is a GeoJSON Polygon, MultiPolygon, or Feature.

The page components (`BrowsePage`, `ListCreditsPage`, `ListingDetailPage`, `PortfolioPage`) are also exported if you would rather place them yourself. They must sit inside `MarketplaceProvider`.

## Issuance

`createListingFromAnalysis(analysis, terms)` is pure. It does not write to storage.

Bankable credits equal **annual sequestration** minus a confidence-scaled buffer. Standing stock (`tCO2e`) is stored on the listing and is not issued, so the same tonne is not sold twice.

| Confidence | Buffer withheld |
| --- | --- |
| High | 10% |
| Medium | 20% |
| Low | 30% |

Tonnes settle to 0.01 tCO₂e, and buffer + bankable equals the rounded gross. Withheld tonnes stay in the reversal reserve and cannot be listed. Uncertainty is shown to buyers and does not change the rate. The same text is on `ISSUANCE_RULE` and on each listing.

```ts
import { createListingFromAnalysis } from "./features/marketplace";

const listing = createListingFromAnalysis(analysis, {
  pricePerTCO2e: 40,
  vintage: 2026,
  sellerName: "Northwind Desk",
});
```

`terms.region` overrides the region inferred from the polygon centroid.

## Commercial terms

The buyer pays the listed price. CarbonSight keeps a success fee from seller proceeds. The fee is always between 7% and 10%, and every transaction row shows the rate and the dollar fee (zero on issuance and retirement).

| Plan | Monthly | Success fee | Gates |
| --- | --- | --- | --- |
| Starter | $49 | 10% | Browse and buy, capped at 500 tCO₂e per calendar month. No listing, no retirement. |
| Growth | $149 | 8% | List, buy without a cap, retire. |
| Enterprise | $299 | 7% | Same desk tools as Growth. |

The portfolio plan switcher is a local demo control. It persists with the book. It does not charge a card.

## Persistence

The default repository is `localStorage` under `carbonsight.marketplace.v1`. An empty browser is seeded with six listings flagged `demo: true`. Swap the repository without touching the UI:

```ts
import { createMarketplaceStore, MarketplaceRoutes } from "./features/marketplace";

const repository = {
  async load() {
    const response = await fetch("/api/marketplace");
    if (response.status === 404) return null;
    return response.json();
  },
  async save(snapshot) {
    await fetch("/api/marketplace", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(snapshot),
    });
  },
};

const store = createMarketplaceStore({ repository });

<MarketplaceRoutes store={store} />
```

`createMemoryRepository()` is the in-memory implementation used by tests.

## Tests

Credit, fee, listing, and store tests sit next to the code (`*.test.ts`) and use Vitest.

```bash
npx vitest run src/features/marketplace
```
