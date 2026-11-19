# CarbonSight

Real-time satellite intelligence for bankable carbon credits.

Draw a forest boundary. CarbonSight reads live public satellite data and returns standing carbon, an annual removal forecast, and a confidence score. Only the buffered annual removal can be listed. Standing stock is inventory, not a credit.

## How to run

```bash
npm install
npm run dev
```

Open http://localhost:5173. The API is http://localhost:8787 and Vite proxies `/api` to it.

```bash
npm run typecheck
npm test
npm run smoke
```

`smoke` calls Microsoft Planetary Computer with the Humboldt redwoods preset. It needs a network.

## What the baseline already does

- Map with three presets (Humboldt redwoods, Central Amazon, Sierra Nevada) and GeoJSON paste
- `POST /api/analyze` against live Planetary Computer data:
  - MODIS 13Q1 NDVI/EVI
  - Harmonized Global Biomass (aboveground Mg/ha)
  - Chloris biomass change, scaled from a ~4.6 km pixel to the polygon
  - A recent Sentinel-2 scene id and tile template
- Carbon math: biomass × 0.47 (IPCC) × 44/12. Credits = positive annual change × 0.8 non-permanence buffer
- Marketplace and portfolio backed by `server/data/ledger.json` (gitignored)

A checked redwoods run returned about 378 ha, 819 Mg/ha, NDVI 0.79, ~680 tCO₂e/year before buffer, ~546 tCO₂e/year listable.

## Who owns which files

Work in separate clones or git worktrees. Do not share one working directory.

| Person | Branch | Owns |
| --- | --- | --- |
| Map | `feat/atlas` | `src/features/map/**`, `src/pages/AnalyzePage.tsx`, `shared/presets.ts` |
| Engine | `feat/engine` | `server/engine/**`, `server/routes/analyze.ts`, `scripts/smoke.ts` |
| Market | `feat/market` | `src/features/market/**`, `src/pages/MarketplacePage.tsx`, `src/pages/PortfolioPage.tsx`, `server/routes/credits.ts`, `server/store/**` |
| Design | `feat/studio` | `src/index.css`, `tailwind.config.js`, `src/components/**`, `src/features/landing/**`, `src/features/results/**`, `src/pages/LandingPage.tsx`, `README.md` |

Nobody edits these unless the whole team agrees: `shared/contract.ts`, `shared/geo.ts`, `src/api/client.ts`, `src/App.tsx`, `src/main.tsx`, `server/index.ts`, `package.json`, `package-lock.json`.

Do not rename the Tailwind colors `canvas`, `paper`, `ink`, `muted`, `canopy`, `copper`, `line`.

## Hackathon README (fill from the real build)

### Inspiration

Forest carbon inventories take 6–18 months and cost $20k–$100k. Buyers still get a PDF. Public satellite archives can price a stand in minutes if the math stays honest.

### What it does

Users draw or load a forest polygon, run a live satellite analysis, and list buffered annual removals on an in-app marketplace. Buyers purchase a slice and see the fee.

### How we built it

React, Vite, TypeScript, Tailwind, MapLibre GL, Recharts, and a small Express API. Data comes from the Microsoft Planetary Computer STAC and statistics APIs (MODIS, Harmonized Global Biomass, Chloris, Sentinel-2). No API key.

### Challenges we ran into

Fill this in from tonight. Do not invent obstacles.

### Accomplishments

Fill this in after the demo path works on stage.

### What we learned

Fill this in from tonight.

### What's next

Registry handoff (Verra or ACR), higher-resolution biomass, and a real billing layer for the $49 / $149 / $299 tiers. The 8% fee is already applied in the ledger.

### How Grok Bot helped build it

Paste the session story here after export. Remove names, emails, phone numbers, and tokens.

### How to run it

See the top of this file. Demo path: `/analyze?preset=redwoods` → Analyze with satellites → List annual credits → buy as Northwind Climate Desk → Portfolio.
