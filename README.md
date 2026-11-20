# CarbonSight

Real-time satellite intelligence for bankable carbon credits.

Draw a polygon, and CarbonSight estimates above-ground biomass and carbon stock from live public satellite data. The figure is a screening estimate for a demo, not a verified credit.

## Setup

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173. One command starts the API on port 8787 and the Vite app on port 5173.

Headless check against the two demo forests (needs a network, takes about 20–40 seconds each):

```bash
npm run analyze -- manaus
npm run analyze -- humboldt
```

## Using the app

1. Search a place, or choose **Amazon · Manaus** or **Redwoods · Humboldt**.
2. Draw a polygon (click corners, then the first point) or drag a rectangle. The chip shows area in hectares. Areas under 1 ha or over 15,000 ha are rejected with a clear message.
3. Click **Analyze with Satellites**.
4. The panel reports area, NDVI, an NDVI series, biomass density, carbon stock (tC and tCO₂e), sequestration, clear-pixel and cloud fraction, biomass-map coverage, GEDI coverage, a High/Medium/Low confidence score with a numeric range, and the method. Toggle the NDVI overlay after a successful run.
5. **List credits** checks the result with `createListingFromAnalysis()` and opens `/marketplace/list` with the polygon, stock, sequestration, and confidence filled in. Browse and portfolio live under `/marketplace`.

## Optional data-engine

The built-in analyzer is the default. If a `data-engine` service is running, the API prefers it.

```bash
DATA_ENGINE_URL=http://127.0.0.1:8090 npm run dev
```

The server calls `POST /analyze` with `{ "geometry": <GeoJSON Polygon> }` and uses the response when it normalizes to a real estimate. On timeout, a mock payload, or an unreachable host, the request falls back to the built-in path. Force a path with `{ "engine": "builtin" }` or `{ "engine": "data-engine" }`.

## What the built-in estimate uses

Live reads from the [Microsoft Planetary Computer](https://planetarycomputer.microsoft.com/) (anonymous, no key):

- Sentinel-2 L2A, last 30 months, clearest scene per quarter. NDVI uses the baseline offset: `(B08−B04)/(B08+B04−2000)`. SCL gives the cloud and clear-pixel fractions. EVI is reported when it is in a sane range.
- Harmonized global aboveground biomass **carbon** for 2010 at 300 m (Spawn & Gibbs, Scientific Data 2020). Raster integers × 0.1 = Mg C/ha. AGB = that carbon ÷ 0.47.
- Chloris woody biomass for 2019 (tonnes per ~4.6 km pixel ÷ ground area of the cell) as an independent check, plus Chloris CO₂e change when the net flux is large enough to see at that resolution.
- ESA WorldCover 2021, only to name the land cover and pick an IPCC growth class.

GEDI L4A/L4B are not queried. Those products sit behind NASA Earthdata authentication. Coverage is reported as 0% and the biomass maps above are the fallback.

Carbon = AGB × 0.47 (IPCC 2006). tCO₂e = tC × 44/12.

Where the biomass maps have no valid pixels, AGB falls back to Poudel et al. 2023: `304.00·NDVI² − 125.73·NDVI + 26.676` Mg/ha (doi:10.1155/2023/5553957). That fit is subtropical and saturates near 200 Mg/ha.

Annual sequestration uses Chloris net stock change when the signal is at least 0.75 tCO₂e/ha/yr. Otherwise it uses IPCC 2006 Table 4.9 Tier-1 growth for natural forest older than 20 years, chosen from latitude, longitude, and tree cover. That default is not a measured flux. North American temperate oceanic forest is the published 15 t dry matter/ha/yr.

Confidence is High, Medium, or Low from biomass-map coverage, Sentinel-2 clear pixels and cloud, scene age, agreement between HGB and Chloris (or the NDVI gap-fill), and the HGB per-pixel standard error. The numeric range is that error, not a registry confidence interval.

## Limits

Polygons must be between 1 and 15,000 hectares. Upstream timeouts surface as errors rather than invented numbers. Chloris is CC BY-NC-SA 4.0. Nothing in the app issues or prices a credit.
