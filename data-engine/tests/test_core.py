"""Offline tests for tiles, limits, indices, carbon math, and the HTTP errors."""

from datetime import datetime, timezone

import numpy as np
from fastapi.testclient import TestClient

from app import app
from carbonsight.errors import DataEngineError
from carbonsight.esa import format_tile, tiles_for_bounds
from carbonsight.estimate import (
    CARBON_FRACTION,
    CO2_PER_C,
    build_estimate,
    carbon_stock,
    confidence_score,
    ndvi_to_agb,
)
from carbonsight.geometry import parse_geojson, validate_limits
from carbonsight.sentinel import boa_offset, quarters, reflectance, spectral_indices


def _square(lon, lat, half=0.01):
    return {
        "type": "Polygon",
        "coordinates": [[
            [lon - half, lat - half],
            [lon + half, lat - half],
            [lon + half, lat + half],
            [lon - half, lat + half],
            [lon - half, lat - half],
        ]],
    }


def test_tile_names_for_the_live_sites():
    assert tiles_for_bounds(-59.81, -2.51, -59.79, -2.49) == ["N00W060"]
    assert tiles_for_bounds(-123.98, 40.34, -123.96, 40.36) == ["N50W130"]
    assert format_tile(-10, -60) == "S10W060"
    assert format_tile(0, 0) == "N00E000"
    # Equator crossing uses the half-open tile edges.
    assert tiles_for_bounds(10.0, -0.05, 10.1, 0.05) == ["N00E010", "N10E010"]


def test_polygon_limits_fail_before_any_network_call():
    huge = _square(-55, -5, half=2)
    try:
        validate_limits(parse_geojson(huge))
    except DataEngineError as exc:
        assert exc.code == "polygon_too_large"
        assert exc.status_code == 400
    else:
        raise AssertionError("expected polygon_too_large")

    tiny = _square(-59.8, -2.5, half=0.0001)
    try:
        validate_limits(parse_geojson(tiny))
    except DataEngineError as exc:
        assert exc.code == "polygon_too_small"
    else:
        raise AssertionError("expected polygon_too_small")


def test_carbon_conversion_uses_ipcc_fraction():
    carbon, tco2e = carbon_stock(100)
    assert carbon == 100 * CARBON_FRACTION
    assert tco2e == carbon * CO2_PER_C
    assert abs(tco2e - 172.333333) < 1e-6


def test_ndvi_regression_is_the_published_line_and_clamps():
    fit = ndvi_to_agb(0.4)
    assert abs(fit["raw_agbd_mg_ha"] - (-113.602 + 983.414 * 0.4)) < 1e-6
    assert fit["clamped"] is False
    saturated = ndvi_to_agb(0.85)
    assert saturated["clamped"] is True
    assert saturated["agbd_mg_ha"] == 402.31
    assert ndvi_to_agb(0.0)["agbd_mg_ha"] == 0.0


def test_confidence_bands():
    label, score = confidence_score(
        method="direct_biomass",
        coverage=1,
        valid_pixel_fraction=1,
        scene_age_days=30,
        disagreement=0.1,
        sd_ratio=0.2,
    )
    assert label == "High"
    assert score >= 75
    label, score = confidence_score(
        method="ndvi_regression",
        coverage=0,
        valid_pixel_fraction=0.9,
        scene_age_days=40,
        disagreement=None,
        sd_ratio=None,
    )
    assert label == "Low"
    assert score < 50


def test_direct_estimate_scales_by_area_inputs():
    biomass = {
        "source": "esa-cci-biomass",
        "version": "7.0",
        "coverage_fraction": 1,
        "agbd_mg_ha": 300,
        "agbd_sd_mg_ha": 60,
        "change": {
            "from_year": 2019,
            "to_year": 2024,
            "delta_agbd_mg_ha_per_year": 2,
            "delta_sd_mg_ha_per_year": 10,
        },
    }
    sentinel = {"ndvi_mean": 0.82, "valid_pixel_fraction": 0.95, "age_days": 20, "collection": "sentinel-2-l2a"}
    estimate = build_estimate(biomass, sentinel)
    assert estimate["method"] == "direct_biomass"
    assert estimate["agbd_mg_ha"] == 300
    assert estimate["sequestration"]["tco2e_per_ha_per_year"] == 2 * 0.47 * (44 / 12)


def test_hybrid_fills_only_the_uncovered_fraction():
    biomass = {
        "source": "esa-cci-biomass",
        "version": "7.0",
        "coverage_fraction": 0.5,
        "agbd_mg_ha": 200,
        "agbd_sd_mg_ha": 40,
        "change": None,
    }
    estimate = build_estimate(biomass, {"ndvi_mean": 0.4, "valid_pixel_fraction": 1, "age_days": 10, "collection": "sentinel-2-l2a"})
    expected_ndvi = -113.602 + 983.414 * 0.4
    assert estimate["method"] == "hybrid"
    assert abs(estimate["agbd_mg_ha"] - (200 * 0.5 + expected_ndvi * 0.5)) < 1e-6


def test_reflectance_offset_and_indices():
    assert boa_offset("05.11") == -1000
    assert boa_offset(3.1) == 0
    dn = np.array([[2000, 0]], dtype="uint16")
    refl = reflectance(dn, -1000)
    assert abs(float(refl[0, 0]) - 0.1) < 1e-6
    assert np.isnan(refl[0, 1])
    red = np.array([[0.05]], dtype="float32")
    nir = np.array([[0.45]], dtype="float32")
    blue = np.array([[0.03]], dtype="float32")
    scl = np.array([[4]], dtype="uint8")
    stats = spectral_indices(red, nir, blue, scl)
    assert abs(stats["ndvi_mean"] - (0.40 / 0.50)) < 1e-5
    assert stats["valid_pixel_fraction"] == 1


def test_quarters_cover_two_years():
    found = quarters(datetime(2026, 11, 19, tzinfo=timezone.utc), 2)
    labels = [item[0] for item in found]
    assert labels[0] == "2024-Q4"
    assert labels[-1] == "2026-Q4"
    assert len(labels) == 9


def test_http_rejects_a_polygon_that_is_too_large():
    client = TestClient(app)
    response = client.post("/analyze", json=_square(-55, -5, half=2))
    assert response.status_code == 400
    body = response.json()
    assert body["error"] == "polygon_too_large"
    assert "max_area_ha" in body or "max_bbox_span_deg" in body


def test_http_rejects_a_point():
    client = TestClient(app)
    response = client.post("/analyze", json={"type": "Point", "coordinates": [-59.8, -2.5]})
    assert response.status_code == 400
    assert response.json()["error"] == "invalid_geometry"


def test_health():
    assert TestClient(app).get("/health").json() == {"status": "ok"}
