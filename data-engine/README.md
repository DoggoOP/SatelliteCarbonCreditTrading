# CarbonSight data engine

Given a WGS84 GeoJSON polygon, this service reads live public data and returns aboveground biomass, a Sentinel-2 vegetation summary, and a CO2e estimate.

No API key is required. Sentinel-2 assets are read with anonymous Planetary Computer SAS tokens. NASA GEDI L4B is not in this version: the granules on ORNL DAAC answer `401` without an Earthdata token. Biomass comes from ESA CCI Biomass v7 instead (100 m, global, through 2024, public on CEDA).

## Run

```bash
cd data-engine
python -m pip install -r requirements.txt
python -m uvicorn app:app --host 0.0.0.0 --port 8000
```

Library call:

```python
from carbonsight import analyze
result = analyze(geojson_polygon, timeout_s=90, include_timeseries=True)
```

HTTP:

```bash
curl -s -X POST http://127.0.0.1:8000/analyze \
  -H 'content-type: application/json' \
  -d '{"type":"Polygon","coordinates":[[[-59.81,-2.51],[-59.79,-2.51],[-59.79,-2.49],[-59.81,-2.49],[-59.81,-2.51]]]}'
```

`GET /health` returns `{"status":"ok"}`.

Query parameters on `POST /analyze`:

| Param | Default | Meaning |
| --- | --- | --- |
| `timeout_s` | 90 | 10–180 seconds. Geometry errors return before any download. |
| `timeseries` | true | Quarterly Sentinel-2 NDVI for the last two years. |

The body is a GeoJSON `Polygon`, `MultiPolygon`, `Feature`, or `FeatureCollection` in WGS84 (RFC 7946). Legacy `crs` members are rejected.

Limits: area 1–50,000 ha, bounding box at most 1 degree on a side, at most 10,000 vertices. Antimeridian polygons are rejected.

## Sources

- **Biomass.** ESA CCI Biomass v7, 100 m above-ground biomass density (Mg/ha) and its standard-deviation layer. Tiles are northwest-corner 10-degree GeoTIFFs, for example `N00W060` for the forest north of Manaus. Pixel value 0 is non-forest, not a fill, and is included in the mean. A five-year difference (latest year minus five years) is the sequestration signal.
- **Optical.** Planetary Computer `sentinel-2-l2a`. The least-cloudy scene from the last 150 days (or the clearest scene in the search window if that is empty). SCL classes 4 and 5 are valid land; classes 3, 8, 9, and 10 count as cloud or shadow. Processing baseline ≥ 4.00 uses reflectance `(DN - 1000) / 10000`.
- **NDVI fallback.** Used only for the fraction of the polygon the biomass map does not cover. See the citation below. It is a poor predictor in closed canopy, where NDVI saturates, and those predictions are clamped.

## Estimate

- Direct: polygon-mean AGBD (Mg/ha) × geodesic area (ha) = AGB (Mg), on the area the map covers.
- Hybrid: that total, plus the NDVI regression on the uncovered fraction.
- Carbon (Mg) = AGB × 0.47 (IPCC 2006, Vol. 4, Table 4.3).
- tCO2e = carbon × 44/12.
- Sequestration (tCO2e/ha/year) = (AGBD_latest − AGBD_five_years_earlier) / 5 × 0.47 × 44/12.
- The numeric range is mean ± the root-mean-square of the map's per-pixel standard deviation. Pixels are spatially correlated, so this is not divided by sqrt(n). It is often wide.
- Confidence is High (≥ 75), Medium (≥ 50), or Low. Points come from biomass coverage (40), valid Sentinel-2 fraction (20), scene age (20 / 14 / 8 / 3), and method (20 direct, 12 hybrid, 4 NDVI-only), with penalties when the map SD is large or the NDVI line disagrees. Disagreement is down-weighted when NDVI ≥ 0.75 because the regression is outside its calibration.

## JSON response (`schema_version` 1.0)

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-11-20T00:00:00Z",
  "area_ha": 484.0,
  "bbox": [-59.81, -2.51, -59.79, -2.49],
  "biomass": {
    "source": "esa-cci-biomass",
    "version": "7.0",
    "year": 2024,
    "agbd_mg_ha": 300.0,
    "agbd_sd_mg_ha": 120.0,
    "coverage_fraction": 1.0,
    "forest_fraction": 1.0,
    "pixel_count": 480,
    "tiles": ["N00W060"],
    "citation": "Santoro & Cartus (2025), ESA Biomass CCI v7.0",
    "license": "ESA CCI Data Policy: free and open access",
    "change": {
      "from_year": 2019,
      "to_year": 2024,
      "delta_agbd_mg_ha_per_year": 1.8,
      "delta_sd_mg_ha_per_year": 30.0
    },
    "notes": []
  },
  "sentinel2": {
    "collection": "sentinel-2-l2a",
    "scene_id": "S2...",
    "datetime": "2026-09-03T14:17:11Z",
    "mgrs_tile": "20MRC",
    "processing_baseline": "05.12",
    "cloud_cover_pct": 0.03,
    "age_days": 78.0,
    "valid_pixel_fraction": 0.99,
    "cloud_pixel_fraction": 0.0,
    "ndvi_mean": 0.83,
    "evi_mean": 0.55,
    "time_series": [
      {
        "period": "2024-Q4",
        "start": "2024-10-01",
        "end": "2024-12-31",
        "ndvi_mean": 0.8,
        "valid_pixel_fraction": 0.9,
        "cloud_cover_pct": 5.0,
        "scene_id": "S2...",
        "datetime": "2024-11-01T14:00:00Z"
      }
    ]
  },
  "estimate": {
    "method": "direct_biomass",
    "agbd_mg_ha": 300.0,
    "agb_mg": 145200.0,
    "carbon_fraction": 0.47,
    "carbon_mg": 68244.0,
    "tco2e": 250228.0,
    "agbd_mg_ha_range": [180.0, 420.0],
    "tco2e_range": [150000.0, 350000.0],
    "sequestration_tco2e_per_ha_per_year": 3.1,
    "sequestration_tco2e_per_year": 1500.0,
    "sequestration_tco2e_per_year_range": [-4000.0, 7000.0],
    "sequestration_method": "esa-cci-biomass-v7.0 2019-2024 difference, converted with carbon fraction 0.47 and 44/12",
    "sequestration_confidence": "Low",
    "confidence": "High",
    "confidence_score": 90,
    "confidence_factors": {
      "biomass_coverage": 1.0,
      "valid_pixel_fraction": 0.99,
      "scene_age_days": 78.0,
      "method": "direct_biomass",
      "relative_disagreement": 0.1,
      "notes": []
    },
    "ndvi_regression": {
      "citation": "KC, Bhattarai, and Pandey (2022), doi:10.3126/forestry.v18i01.41749",
      "equation": "AGB = -113.602 + 983.414 * NDVI",
      "rmse_mg_ha": 78.44,
      "raw_agbd_mg_ha": 700.0,
      "agbd_mg_ha": 402.31,
      "clamped": true
    },
    "composition": [
      {"source": "esa-cci-biomass", "area_fraction": 1.0, "agbd_mg_ha": 300.0}
    ],
    "sources": {"biomass": "esa-cci-biomass", "optical": "sentinel-2-l2a"}
  },
  "warnings": []
}
```

`biomass` or `sentinel2` is `null` when that source fails and the other one is enough to estimate. `method` is `direct_biomass`, `hybrid`, or `ndvi_regression`. `time_series` is `[]` when `timeseries=false`. A quarter with no scene under 80% cloud has `ndvi_mean: null`.

Numbers in the block above show the shape of the payload. A live run of `scripts/live_sites.py` on 2026-11-20 (about 2.2 km squares) returned:

| Site | AGBD 2024 | NDVI | EVI | Stock | Confidence |
| --- | --- | --- | --- | --- | --- |
| Forest north of Manaus (`-59.80`, `-2.50`) | 298 Mg/ha (SD 151), tile `N00W060` | 0.82 | 0.55 | 248,762 tCO2e on 484 ha | High (95) |
| Humboldt Redwoods (`-123.97`, `40.35`) | 401 Mg/ha (SD 316), tile `N50W130` | 0.87 | 0.42 | 336,185 tCO2e on 487 ha | High (90) |

Both scenes were effectively cloud-free (0.03% and 0%). Quarterly NDVI stays near 0.77–0.86 in the Amazon. The redwood series is near 0.84–0.91 except 2024-Q4, whose least-cloudy scene came back at NDVI 0.11. The five-year biomass change is smaller than the map's standard deviation at both sites (about −0.25 and +0.28 tCO2e/ha/year), so sequestration confidence is Low and the range crosses zero. That is the map, not a measured growth rate.

## Errors

HTTP body: `{"error": "<code>", "message": "...", ...}`.

| HTTP | `error` | When |
| --- | --- | --- |
| 400 | `invalid_geometry` | Not a polygon, bad coordinates, antimeridian, or a legacy `crs`. |
| 400 | `polygon_too_small` | Under 1 ha. |
| 400 | `polygon_too_large` | Over 50,000 ha or a bounding box wider than 1 degree. |
| 400 | `polygon_too_complex` | More than 10,000 vertices. |
| 400 | `invalid_timeout` | `timeout_s` outside 10–180. |
| 422 | `no_data` | Biomass and Sentinel-2 both returned nothing. |
| 502 | `upstream_failure` | Unexpected read error. |

## Tests

```bash
cd data-engine
python -m pytest -q
python scripts/live_sites.py
```

`pytest` stays offline. The script calls CEDA and Planetary Computer for:

- intact forest north of Manaus (`-59.80`, `-2.50`, about 2.2 km)
- Humboldt Redwoods / Rockefeller Forest (`-123.97`, `40.35`, about 2.2 km)

## Citations

- Santoro, M., & Cartus, O. (2025). ESA Biomass Climate Change Initiative (Biomass_cci): Global datasets of forest above-ground biomass for the years 2005–2012 and 2015–2024, v7.0. NERC EDS Centre for Environmental Data Analysis. https://catalogue.ceda.ac.uk/uuid/6429d1aafe1e43b9b414e4a5a7f8b903
- IPCC (2006). 2006 IPCC Guidelines for National Greenhouse Gas Inventories, Volume 4, Chapter 4, Table 4.3. Carbon fraction 0.47. CO2e uses 44/12.
- KC, A., Bhattarai, S., & Pandey, P. (2022). A comparison of Landsat-8 and Sentinel-2 spectral indices for estimating aboveground forest carbon in a community forest. Forestry: Journal of Institute of Forestry, Nepal, 19, 40–55. https://doi.org/10.3126/forestry.v18i01.41749
