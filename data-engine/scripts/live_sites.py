"""Run the engine on an Amazon patch and a Humboldt redwood patch.

Usage (from data-engine/):
    python scripts/live_sites.py
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from carbonsight.analyze import analyze


def box_km(lon: float, lat: float, km: float = 2.2) -> dict:
    half_lat = (km / 2) / 110.574
    half_lon = (km / 2) / (111.320 * math.cos(math.radians(lat)))
    return {
        "type": "Polygon",
        "coordinates": [[
            [lon - half_lon, lat - half_lat],
            [lon + half_lon, lat - half_lat],
            [lon + half_lon, lat + half_lat],
            [lon - half_lon, lat + half_lat],
            [lon - half_lon, lat - half_lat],
        ]],
    }


SITES = {
    # Intact forest north of Manaus, Amazonas. ESA CCI reads about 300 Mg/ha here.
    "manaus": box_km(-59.80, -2.50),
    # Humboldt Redwoods, Rockefeller Forest area, California.
    "humboldt": box_km(-123.97, 40.35),
}


def main() -> None:
    timeseries = "--no-timeseries" not in sys.argv
    report = {}
    for name, polygon in SITES.items():
        print(f"\n=== {name} ===", flush=True)
        result = analyze(polygon, timeout_s=150, include_timeseries=timeseries)
        report[name] = result
        biomass = result.get("biomass") or {}
        optical = result.get("sentinel2") or {}
        estimate = result["estimate"]
        print(
            json.dumps(
                {
                    "area_ha": result["area_ha"],
                    "biomass_source": biomass.get("source"),
                    "biomass_year": biomass.get("year"),
                    "agbd_mg_ha": biomass.get("agbd_mg_ha"),
                    "agbd_sd_mg_ha": biomass.get("agbd_sd_mg_ha"),
                    "forest_fraction": biomass.get("forest_fraction"),
                    "tiles": biomass.get("tiles"),
                    "ndvi": optical.get("ndvi_mean"),
                    "evi": optical.get("evi_mean"),
                    "valid_pixel_fraction": optical.get("valid_pixel_fraction"),
                    "scene": optical.get("scene_id"),
                    "scene_date": optical.get("datetime"),
                    "cloud_cover_pct": optical.get("cloud_cover_pct"),
                    "quarters": [
                        {"period": point["period"], "ndvi": point["ndvi_mean"]}
                        for point in (optical.get("time_series") or [])
                    ],
                    "method": estimate["method"],
                    "tco2e": estimate["tco2e"],
                    "tco2e_range": estimate["tco2e_range"],
                    "sequestration_tco2e_per_ha_per_year": estimate["sequestration_tco2e_per_ha_per_year"],
                    "confidence": estimate["confidence"],
                    "confidence_score": estimate["confidence_score"],
                    "warnings": result["warnings"],
                },
                indent=2,
            ),
            flush=True,
        )
    out = Path(__file__).with_name("last_live_report.json")
    out.write_text(json.dumps(report, indent=2))
    print(f"\nWrote {out}", flush=True)


if __name__ == "__main__":
    main()
