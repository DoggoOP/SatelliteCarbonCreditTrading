"""Public entry point: GeoJSON polygon to a carbon estimate."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from carbonsight.errors import DataEngineError
from carbonsight.esa import load_biomass
from carbonsight.estimate import CARBON_FRACTION, CO2_PER_C, build_estimate
from carbonsight.geometry import bbox, parse_geojson, validate_limits
from carbonsight.sentinel import load_sentinel

logger = logging.getLogger("carbonsight")


def analyze(geojson: dict, *, timeout_s: float = 90.0, include_timeseries: bool = True) -> dict:
    """Estimate aboveground biomass and CO2e for one WGS84 polygon.

    Biomass comes from ESA CCI Biomass v7 (public, no key). Sentinel-2 L2A on
    the Planetary Computer supplies NDVI, EVI, and a two-year quarterly series.
    The NDVI regression is used only on area the biomass map does not cover.
    """
    if not isinstance(timeout_s, (int, float)) or timeout_s < 10 or timeout_s > 180:
        raise DataEngineError(
            "invalid_timeout",
            "timeout_s must be between 10 and 180 seconds.",
            400,
        )
    geom = parse_geojson(geojson)
    area_ha = validate_limits(geom)
    warnings: list[str] = []

    per_call = max(20.0, min(60.0, timeout_s * 0.6))
    try:
        biomass = load_biomass(geom, timeout=per_call)
    except DataEngineError:
        raise
    except Exception as exc:
        logger.exception("biomass read failed")
        biomass = None
        warnings.append(f"Biomass map could not be read ({exc.__class__.__name__}).")
    if biomass is None:
        warnings.append("No ESA CCI Biomass pixels were found for this polygon.")

    try:
        sentinel = load_sentinel(geom, timeout=per_call, include_timeseries=include_timeseries)
    except Exception as exc:
        logger.exception("sentinel read failed")
        sentinel = None
        warnings.append(f"Sentinel-2 could not be read ({exc.__class__.__name__}).")
    if sentinel is None:
        warnings.append("No usable Sentinel-2 L2A scene was found.")

    if biomass is None and (sentinel is None or sentinel.get("ndvi_mean") is None):
        raise DataEngineError(
            "no_data",
            "Neither the biomass map nor a clear Sentinel-2 scene returned data for this polygon.",
            422,
        )

    try:
        estimate = build_estimate(biomass, sentinel)
    except ValueError as exc:
        raise DataEngineError("no_data", str(exc), 422) from exc

    agbd = estimate["agbd_mg_ha"]
    low, high = estimate["agbd_mg_ha_range"]
    agb_mg = agbd * area_ha
    carbon_mg, tco2e = _stock(agb_mg)
    carbon_low, tco2e_low = _stock(low * area_ha)
    carbon_high, tco2e_high = _stock(high * area_ha)
    seq = estimate.pop("sequestration")
    seq_per_ha = seq.get("tco2e_per_ha_per_year")
    seq_total = None if seq_per_ha is None else seq_per_ha * area_ha
    seq_range = seq.get("tco2e_per_ha_per_year_range")
    seq_total_range = None if seq_range is None else [seq_range[0] * area_ha, seq_range[1] * area_ha]
    if seq_range is not None and seq_range[0] < 0 < seq_range[1]:
        warnings.append(
            "The biomass maps' standard deviations are larger than the multi-year "
            "change, so the sequestration range crosses zero."
        )

    return {
        "schema_version": "1.0",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "area_ha": _r(area_ha, 2),
        "bbox": [_r(v, 6) for v in bbox(geom)],
        "biomass": _biomass_public(biomass),
        "sentinel2": _sentinel_public(sentinel),
        "estimate": {
            "method": estimate["method"],
            "agbd_mg_ha": _r(agbd, 2),
            "agb_mg": _r(agb_mg, 1),
            "carbon_fraction": CARBON_FRACTION,
            "carbon_mg": _r(carbon_mg, 1),
            "tco2e": _r(tco2e, 1),
            "agbd_mg_ha_range": [_r(low, 2), _r(high, 2)],
            "tco2e_range": [_r(tco2e_low, 1), _r(tco2e_high, 1)],
            "sequestration_tco2e_per_ha_per_year": _r(seq_per_ha, 3),
            "sequestration_tco2e_per_year": _r(seq_total, 1),
            "sequestration_tco2e_per_year_range": (
                None if seq_total_range is None else [_r(seq_total_range[0], 1), _r(seq_total_range[1], 1)]
            ),
            "sequestration_method": seq.get("method"),
            "sequestration_confidence": seq.get("confidence"),
            "confidence": estimate["confidence"],
            "confidence_score": estimate["confidence_score"],
            "confidence_factors": _factors(estimate["confidence_factors"]),
            "ndvi_regression": _regression(estimate["ndvi_regression"]),
            "composition": [
                {
                    "source": part["source"],
                    "area_fraction": _r(part["area_fraction"], 4),
                    "agbd_mg_ha": _r(part["agbd_mg_ha"], 2),
                }
                for part in estimate["composition"]
            ],
            "sources": estimate["sources"],
        },
        "warnings": warnings,
    }


def _stock(agb_mg: float) -> tuple[float, float]:
    carbon = agb_mg * CARBON_FRACTION
    return carbon, carbon * CO2_PER_C


def _biomass_public(biomass: dict | None) -> dict | None:
    if biomass is None:
        return None
    change = biomass.get("change")
    return {
        "source": biomass["source"],
        "version": biomass["version"],
        "year": biomass["year"],
        "agbd_mg_ha": _r(biomass["agbd_mg_ha"], 2),
        "agbd_sd_mg_ha": _r(biomass["agbd_sd_mg_ha"], 2),
        "coverage_fraction": _r(biomass["coverage_fraction"], 4),
        "forest_fraction": _r(biomass["forest_fraction"], 4),
        "pixel_count": biomass["pixel_count"],
        "tiles": biomass["tiles"],
        "citation": biomass["citation"],
        "license": biomass["license"],
        "change": None
        if not change
        else {
            "from_year": change["from_year"],
            "to_year": change["to_year"],
            "delta_agbd_mg_ha_per_year": _r(change["delta_agbd_mg_ha_per_year"], 3),
            "delta_sd_mg_ha_per_year": _r(change["delta_sd_mg_ha_per_year"], 3),
        },
        "notes": biomass["notes"],
    }


def _sentinel_public(sentinel: dict | None) -> dict | None:
    if sentinel is None:
        return None
    series = []
    for point in sentinel.get("time_series") or []:
        series.append(
            {
                "period": point["period"],
                "start": point["start"],
                "end": point["end"],
                "ndvi_mean": _r(point["ndvi_mean"], 4),
                "valid_pixel_fraction": _r(point["valid_pixel_fraction"], 4),
                "cloud_cover_pct": _r(point["cloud_cover_pct"], 3),
                "scene_id": point["scene_id"],
                "datetime": point["datetime"],
            }
        )
    return {
        "collection": sentinel["collection"],
        "scene_id": sentinel["scene_id"],
        "datetime": sentinel["datetime"],
        "mgrs_tile": sentinel["mgrs_tile"],
        "processing_baseline": sentinel["processing_baseline"],
        "cloud_cover_pct": _r(sentinel["cloud_cover_pct"], 3),
        "age_days": _r(sentinel["age_days"], 1),
        "valid_pixel_fraction": _r(sentinel["valid_pixel_fraction"], 4),
        "cloud_pixel_fraction": _r(sentinel["cloud_pixel_fraction"], 4),
        "ndvi_mean": _r(sentinel["ndvi_mean"], 4),
        "evi_mean": _r(sentinel["evi_mean"], 4),
        "time_series": series,
    }


def _regression(regression: dict | None) -> dict | None:
    if regression is None:
        return None
    return {
        "citation": regression["citation"],
        "equation": regression["equation"],
        "rmse_mg_ha": regression["rmse_mg_ha"],
        "raw_agbd_mg_ha": _r(regression["raw_agbd_mg_ha"], 2),
        "agbd_mg_ha": _r(regression["agbd_mg_ha"], 2),
        "clamped": regression["clamped"],
    }


def _factors(factors: dict) -> dict:
    return {
        "biomass_coverage": _r(factors["biomass_coverage"], 4),
        "valid_pixel_fraction": _r(factors["valid_pixel_fraction"], 4),
        "scene_age_days": _r(factors["scene_age_days"], 1),
        "method": factors["method"],
        "relative_disagreement": _r(factors["relative_disagreement"], 4),
        "notes": factors["notes"],
    }


def _r(value, digits: int):
    if value is None:
        return None
    return round(float(value), digits)
