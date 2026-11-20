# CarbonSight architecture

This is the system the analysis should implement, plus a description of what `main` actually calls as of commit `5a40de2` (`added carbonsight app baseline`). There is no remote branch named `kevin` at the time of writing. Application code is not modified by this documentation set.

## What the system is

A user draws a forest polygon. The service estimates aboveground biomass from public satellite data, converts that stock to carbon and tCO2e with the factors in `methodology.md`, attaches a Tier-1 sequestration *rate* only when the biome supports one, scores confidence, and can place the result on a marketplace as a **screening listing**. The listing is not a Verra, Gold Standard, ACR, or CAR credit.

```text
browser map
    │  GeoJSON polygon, date window
    ▼
analysis API
    │  area check, land-cover gate
    ├──────────────────────────────┐
    ▼                              ▼
Planetary Computer STAC            NASA Earthdata / ORNL DAAC
Sentinel-2 L2A (NDVI)              GEDI L4A footprints, L4B 1 km grid
    │                              │
    └──────────► estimator ◄───────┘
                    │  AGB, carbon, stock tCO2e,
                    │  optional roots, Tier-1 rate, confidence
                    ▼
              listing record
                    │
                    ▼
              marketplace
              (discovery + subscription billing;
               success fee only on a later registry issuance)
```

## Data flow

1. **Draw.** The map stores a polygon in WGS84. Reject unclosed rings, self-intersections, and polygons larger than a configured cap (suggested default 50,000 ha) unless the user explicitly asks for a landscape summary. Reproject to an equal-area CRS only to compute hectares. Keep the GeoJSON in longitude, latitude for every downstream query.

2. **Land cover.** Query a global land-cover layer over the polygon. Microsoft Planetary Computer hosts ESA WorldCover and the Esri/Impact Observatory annual land-cover collection. Confirm the STAC collection id at build time (`esa-worldcover` and `io-lulc-annual-v02` are the ids these products have used). The majority class becomes the ecozone gate: forest, shrub, grassland, bare, water, crop. Water-dominated polygons stop here.

3. **Sentinel-2.** STAC search against Planetary Computer collection `sentinel-2-l2a`, intersecting the polygon, filtered by cloud cover and the user’s date window. Compute NDVI from surface-reflectance B8 and B4 at 10 m, mask with the scene classification layer, and take the median of clear observations. Persist the item ids and the clear-observation count. Fewer than three clear dates is an optical failure, recorded even if lidar later succeeds.

4. **GEDI.** L4A is not assumed to be inside the Planetary Computer catalog. Query NASA Earthdata / ORNL DAAC for GEDI04_A footprints in the polygon, and apply the Version 3 quality rules in `methodology.md` (`l4_quality_flag`, the sensitivity thresholds already inside that flag, `elev_highestreturn_outlier_flag`, `degrade_include_flag`). L4B 1 km means are a second request, stored with the product version. The Version 2 L4B guide only covers April 2019 through August 2021. Do not describe that grid as current-year biomass.

5. **Estimate.** If the quality-filtered shot count meets the confidence rules, the reported AGB is the footprint mean. Otherwise the API may compute the Ilam (2022) NDVI equation and must tag it `ndvi_fallback_ilam_2022`. IPCC Table 4.7 is stored as `ipcc_prior_agb` and is never copied into `agb_mg_ha`. Carbon, stock, optional roots, and the Tier-1 rate follow `methodology.md`. Desert, shrub, and grassland leave `sequestration` null.

6. **Score and list.** Write the component scores, the caps, the product versions, and the geometry. A marketplace row can be created only when the label is `screen_only` or `list_with_provenance`. The row’s public text includes the non-issuance sentence below. `do_not_list` results stay in the user’s analysis history and do not appear as supply.

## What the code on main does today

`server/engine/analyze.ts` does not query GEDI. A live analysis:

1. Reads **Harmonized Global Biomass (HGB)** on Planetary Computer, collection `hgb`, assets `aboveground` and `aboveground_uncertainty`.
2. Treats that mean as dry AGB in Mg ha⁻¹ and converts with `AGB × 0.47 × 44/12` (`server/engine/carbon.ts`).
3. Reads **Chloris** collection `chloris-biomass`, asset `biomass_change`, and scales the pixel total down to the polygon. The code comment states the pixel is about 4.6 km on a side and that the asset is tonnes of CO2e, not a per-hectare rate. This documentation pass did not re-derive that unit from a Chloris ATBD.
4. Reads **MODIS** `modis-13Q1-061` NDVI and EVI for the vegetation panel. Sentinel-2 L2A is searched and used as a map tile, not as the biomass regression in `methodology.md`.
5. Applies a **20 percent** non-permanence buffer (`NON_PERMANENCE_BUFFER = 0.2` in `shared/contract.ts`) and will only treat a positive annual number as issuable volume. The shipped disclaimer says the result is illustrative and not a Verra, Gold Standard, or ACR issuance. The 20 percent is a product constant, not an IPCC default.

**HGB unit risk.** The Planetary Computer catalog describes HGB as “Global maps of aboveground and belowground biomass **carbon** density for the year 2010 at 300 m resolution.” The example notebook for the collection uses the same words: biomass carbon density. That is the Spawn et al. (2020) harmonized product, whose title is carbon density, not dry woody mass (*Scientific Data* 7: 112, https://doi.org/10.1038/s41597-020-0444-4). The COG scale factor was not opened for this note. If the asset is already tonnes of carbon per hectare, multiplying by 0.47 applies the carbon fraction twice, and the field labeled aboveground biomass is actually a carbon density. Against the Manaus reference (317 Mg dry matter ha⁻¹, about 149 t C ha⁻¹), a mislabeled run would show a “biomass” near 150 and a stock near 260 t CO2e ha⁻¹ instead of about 550. `validation.md` is written against dry biomass on purpose, so this mistake fails the reference check instead of being absorbed into it. Confirm the GeoTIFF units before changing the multiplier.

Chloris is a reasonable flux source where IPCC Table 4.9 is only a default. It does not remove the need to refuse a forest flux on the Mojave control, and a 4.6 km pixel scaled onto a 5–20 ha polygon is a sample of the pixel, not a measurement of the polygon. The code already warns when the polygon is smaller than one Chloris pixel. Confidence should stay capped in that case. The minimum polygon in the current API is 5 ha and the maximum is 20,000 ha.

Preset boxes in `shared/presets.ts` are demo geometries, not the plot corners in `reference_values.json`. The Amazon preset sits near 2.69° S, 59.89° W, east of Manaus. The Suwa et al. transect is in ZF-2, northwest of the city. Both can be terra firme. Do not expect the preset to return 316.6 Mg ha⁻¹ exactly.

## Suggested technical choices

These are choices, not constraints on the other branch. They are here so the data flow has a concrete shape.

| Piece | Suggestion | Why |
| --- | --- | --- |
| Map | MapLibre GL in the browser | Polygon draw and GeoJSON without a per-map license fee. |
| API | Python, FastAPI | STAC and HDF5/Earthdata clients are Python-first. |
| Geometry | PostGIS | Intersection of footprints and polygons, area in an equal-area projection. |
| Object store | Blob storage for cached rasters | Median NDVI tiles should not be recomputed on every page view. |
| Jobs | A short queue for GEDI queries | Earthdata searches are slower than a map click. The UI polls a job id. |
| Auth | Ordinary accounts | Needed for subscriptions. No special claim about custody of credits. |

Cache keys include the polygon hash, the date window, and the GEDI product version. A new product version must miss the cache. Every response stores enough provenance to recompute: STAC item ids, shot count, quality-flag definition, CF used (0.47), the 44/12 factor, the IPCC table row or an explicit null, and the confidence components.

## Non-issuance sentence

Every listing and every export shows this, in the product UI not only in this doc:

> This is a screening estimate of aboveground biomass carbon from public satellite data and IPCC default factors. It is not a carbon credit, not a verification statement, and not evidence of additionality.

The success fee described below attaches to credits a **registry** later issues, not to this sentence’s number.

## Monetization

The team’s pricing for the hackathon product, as specified for this build:

- Subscriptions at **$49, $149, and $299 per month** are the three planned tiers inside a $49–$299 range. The middle price is a packaging choice, not a market statistic.
- A **success fee of 7–10 percent** on credits that a recognized registry subsequently issues for a project that was originated or monitored through the product.

What each tier should gate, if the other branch builds billing:

| Tier | Intended access |
| --- | --- |
| $49 / month | Saved polygons, stock and confidence, no marketplace listing. |
| $149 / month | Listings, provenance export, email when new GEDI shots land in a saved polygon. |
| $299 / month | Several seats, a simple portfolio view, and the success-fee schedule for registry-issued volume. |

The fee and the estimate need to stay apart. A vendor that is paid a percentage of credits, and that also produces the number those credits are based on, has a conflict of interest. Sylvera’s ratings business and Pachama’s historical marketplace sit on opposite sides of that line (see below). CarbonSight should take the fee only after an independent registry issuance, and the in-app number should remain a screen. Taking 7–10 percent of the app’s own tCO2e figure would bill customers for a stock that is not a credit. Do not do that.

## Competitive landscape

Facts below are limited to what the organizations say about themselves or what a product guide states. Industry blogs add color; where a claim is only from a secondary blog, it is marked.

**Pachama** sells evaluation of forest carbon projects using remote sensing, and it has operated a marketplace where buyers can purchase forest credits. That combination, assessment plus a place to buy, is the structural fact. A secondary industry roundup describes a later combination with Carbon Direct; this file does not treat the corporate transaction as confirmed, because the primary announcement was not checked here.

**Sylvera** rates carbon credits for buyers and also publishes forest biomass data products. Its own materials describe a letter-grade style project rating. Any accuracy percentage quoted by the company for its biomass product is a company claim, not a result reproduced in this repo.

**CTrees** is a U.S. 501(c)(3) nonprofit, founded in 2022, building land-carbon maps and MRV data. Its public description says annual global maps at 1 hectare with uncertainty, using ground plots plus satellite lidar (including GEDI and ICESat) and radar, and that NISAR and ESA Biomass are planned inputs as they become available. CTrees gives away or licenses data. It is not a credit marketplace.

Adjacent names a pitch should not confuse with these three:

- **BeZero Carbon** rates credits. It is another opinion provider, not a sensor.
- **Chloris Geospatial** sells biomass change layers.
- **Verra, Gold Standard, ACR, and CAR** are registries. They issue the credits a success fee could legally refer to. CarbonSight is not one of them.
- **Planet** and public missions (Sentinel-2, GEDI, Landsat) sell or give away pixels. They are suppliers, not the product.

Public criticism of REDD+ baselines is part of the landscape, not a footnote. Ecosystem Marketplace’s 2024 *State of the Voluntary Carbon Markets* report (transactions in 2023) describes a sharp drop in forestry-and-land-use volume after scrutiny of REDD+ baselines, and buyer preference for credits with a clearer additionality story. West et al. (*Science*, 2023) is the academic paper most often cited for overstated avoided deforestation. CarbonSight’s answer is methodological: show stock, show a labeled rate, show confidence, and do not print a credit id.

## Moat

There is no data moat. Sentinel-2 and GEDI are public. CTrees, Sylvera, Chloris, and a careful graduate student can compute a biomass mean for the same polygon. A hackathon team will not out-model groups that already fuse airborne lidar campaigns with those streams.

What can be true, and worth saying to a technical judge:

1. **The unit of work is a polygon drawn by a non-specialist**, with provenance stored at the shot and scene level, at a subscription price two orders of magnitude below an enterprise ratings contract. That is distribution, not science.
2. **The method refuses.** Capping confidence when the only input is a saturated NDVI, and refusing forest growth rates on desert and savanna, is a product decision incumbents with a fee on volume are not always paid to make. It is only a moat if the refusal stays in the shipping UI.
3. **Open factors.** CF 0.47, 44/12, the IPCC row, and the Ilam coefficients are written down and tested against the five sites in `validation.md`. Most competing interfaces do not show the Tier-1 row they would have used, because they are not using Tier 1. Transparency is a feature for a student and landowner tool. It is not a feature that replaces hybrid-inference biomass science.

What is not a moat: “AI,” a proprietary index that is NDVI with a new name, or a marketplace that lists the stock itself as a credit. The last of those is a liability.

## Operational risks

- **Earthdata credentials and rate limits** will break a live demo if the GEDI query is synchronous on the request path. Precompute the five validation polygons.
- **GEDI geolocation error** is on the order of several meters to more than a footprint, and it moves between product versions. Do not pretend a shot center is a survey monument.
- **Cache invalidation** when ORNL publishes a new L4A version. Old means must not be served under a new version label.
- **Marketplace claims.** A listing without the non-issuance sentence is the failure mode a VC who knows the 2023 REDD+ controversy will look for.

## Related docs

- Factors, equations, and the confidence arithmetic: `methodology.md`
- The five polygons and pass bands: `validation.md`, `reference_values.json`
- How to talk about the market without inventing one: `pitch.md`
