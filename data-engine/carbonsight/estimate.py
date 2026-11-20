"""Hybrid biomass estimate, IPCC carbon conversion, and a confidence score."""

from __future__ import annotations

import math

# IPCC 2006 Guidelines, Volume 4, Table 4.3. Default carbon fraction of dry biomass.
CARBON_FRACTION = 0.47
CO2_PER_C = 44.0 / 12.0

# KC, Bhattarai, and Pandey (2022), Forestry: Journal of Institute of Forestry, Nepal.
# Sentinel-2 equation (vi): AGB = -113.602 + 983.414 * NDVI.
# R^2 = 0.733, RMSE = 78.44 t/ha, for the Salbote Karele community forest, Ilam, Nepal.
# https://doi.org/10.3126/forestry.v18i01.41749
# The paper's mapped predictions ran from 0 to 402.31 t/ha. We clamp to that range
# and use the equation only where a biomass map does not cover the polygon.
NDVI_INTERCEPT = -113.602
NDVI_SLOPE = 983.414
NDVI_RMSE = 78.44
NDVI_MAX = 402.31
NDVI_CITATION = (
    "KC, A., Bhattarai, S., & Pandey, P. (2022). A comparison of Landsat-8 and "
    "Sentinel-2 spectral indices for estimating aboveground forest carbon in a "
    "community forest. Forestry: Journal of Institute of Forestry, Nepal, 19, 40-55. "
    "https://doi.org/10.3126/forestry.v18i01.41749 . "
    "Sentinel-2 equation: AGB (t/ha) = -113.602 + 983.414 * NDVI "
    "(R^2 = 0.733, RMSE = 78.44 t/ha). Site-specific to the Salbote Karele "
    "community forest, Ilam, Nepal; clamped here to 0-402.31 t/ha."
)


def ndvi_to_agb(ndvi: float | None) -> dict | None:
    if ndvi is None or not math.isfinite(ndvi):
        return None
    raw = NDVI_INTERCEPT + NDVI_SLOPE * float(ndvi)
    clamped = min(NDVI_MAX, max(0.0, raw))
    return {
        "citation": NDVI_CITATION,
        "equation": "AGB = -113.602 + 983.414 * NDVI",
        "rmse_mg_ha": NDVI_RMSE,
        "raw_agbd_mg_ha": raw,
        "agbd_mg_ha": clamped,
        "clamped": clamped != raw,
    }


def carbon_stock(agb_mg: float) -> tuple[float, float]:
    """Return (carbon Mg, tCO2e) from dry aboveground biomass in Mg."""
    carbon = agb_mg * CARBON_FRACTION
    return carbon, carbon * CO2_PER_C


def confidence_score(
    *,
    method: str,
    coverage: float | None,
    valid_pixel_fraction: float | None,
    scene_age_days: float | None,
    disagreement: float | None,
    sd_ratio: float | None,
) -> tuple[str, int]:
    """0-100 score from coverage, cloud-free fraction, recency, and agreement.

    High >= 75, Medium >= 50, otherwise Low.
    """
    score = 0.0
    if coverage is not None:
        score += 40.0 * _unit(coverage)
    if valid_pixel_fraction is not None:
        score += 20.0 * _unit(valid_pixel_fraction)
    if scene_age_days is not None:
        if scene_age_days <= 90:
            score += 20
        elif scene_age_days <= 180:
            score += 14
        elif scene_age_days <= 365:
            score += 8
        else:
            score += 3
    score += {"direct_biomass": 20, "hybrid": 12, "ndvi_regression": 4}.get(method, 0)
    if disagreement is not None:
        if disagreement > 0.5:
            score -= 15
        elif disagreement > 0.3:
            score -= 8
    if sd_ratio is not None:
        if sd_ratio > 0.75:
            score -= 10
        elif sd_ratio > 0.5:
            score -= 5
    score = max(0.0, min(100.0, score))
    rounded = int(round(score))
    if rounded >= 75:
        return "High", rounded
    if rounded >= 50:
        return "Medium", rounded
    return "Low", rounded


def build_estimate(biomass: dict | None, sentinel: dict | None) -> dict:
    """Area-weighted direct biomass, with the NDVI regression filling gaps."""
    ndvi = None if sentinel is None else sentinel.get("ndvi_mean")
    regression = ndvi_to_agb(ndvi)
    ndvi_agbd = None if regression is None else regression["agbd_mg_ha"]
    coverage = 0.0 if biomass is None else float(biomass["coverage_fraction"])
    direct = None if biomass is None else float(biomass["agbd_mg_ha"])

    composition = []
    if direct is not None and coverage > 0:
        composition.append(
            {
                "source": biomass["source"],
                "area_fraction": coverage,
                "agbd_mg_ha": direct,
            }
        )
    missing = 1.0 - coverage if direct is not None else 1.0
    if missing > 0.02 and ndvi_agbd is not None:
        composition.append(
            {
                "source": "ndvi_regression",
                "area_fraction": missing if direct is not None else 1.0,
                "agbd_mg_ha": ndvi_agbd,
            }
        )
        if direct is not None and coverage > 0:
            agbd = direct * coverage + ndvi_agbd * missing
            method = "hybrid" if missing > 0.05 else "direct_biomass"
        else:
            agbd = ndvi_agbd
            method = "ndvi_regression"
    elif direct is not None:
        agbd = direct
        method = "direct_biomass"
    else:
        raise ValueError("no biomass or NDVI")

    disagreement = None
    if direct is not None and ndvi_agbd is not None and direct > 1:
        disagreement = abs(ndvi_agbd - direct) / max(direct, 25.0)
        # The Nepal equation saturates and was not fit on high-NDVI closed forest.
        if ndvi is not None and ndvi >= 0.75:
            disagreement *= 0.35
        if regression and regression["clamped"]:
            disagreement *= 0.5

    sd = None if biomass is None else biomass.get("agbd_sd_mg_ha")
    if method == "ndvi_regression":
        sigma = NDVI_RMSE
    elif sd is not None:
        sigma = float(sd)
        if method == "hybrid":
            sigma = math.sqrt((float(sd) ** 2) * coverage + (NDVI_RMSE ** 2) * missing)
    else:
        sigma = 0.35 * agbd
    low = max(0.0, agbd - sigma)
    high = agbd + sigma

    sd_ratio = None
    if sd is not None and direct is not None and direct > 1:
        sd_ratio = float(sd) / direct

    valid = None if sentinel is None else sentinel.get("valid_pixel_fraction")
    age = None if sentinel is None else sentinel.get("age_days")
    label, score = confidence_score(
        method=method,
        coverage=coverage if biomass is not None else 0.0,
        valid_pixel_fraction=valid,
        scene_age_days=age,
        disagreement=disagreement,
        sd_ratio=sd_ratio if method != "ndvi_regression" else None,
    )

    sequestration = _sequestration(biomass, agbd, sigma if method != "ndvi_regression" else None)
    notes = []
    if regression and regression["clamped"]:
        notes.append(
            "NDVI regression was clamped to the 0-402 t/ha range of KC et al. (2022); "
            "NDVI is a weak biomass predictor once the canopy is closed."
        )
    if disagreement is not None and disagreement > 0.5:
        notes.append("Direct biomass and the NDVI regression disagree by more than half.")
    if sd_ratio is not None and sd_ratio > 0.6:
        notes.append(
            "The biomass map's own standard deviation is large relative to the mean, "
            "so the numeric range is wide even when the scene is clear."
        )

    return {
        "method": method,
        "agbd_mg_ha": agbd,
        "agbd_mg_ha_range": [low, high],
        "carbon_fraction": CARBON_FRACTION,
        "sequestration": sequestration,
        "confidence": label,
        "confidence_score": score,
        "confidence_factors": {
            "biomass_coverage": coverage if biomass is not None else 0.0,
            "valid_pixel_fraction": valid,
            "scene_age_days": age,
            "method": method,
            "relative_disagreement": disagreement,
            "notes": notes,
        },
        "ndvi_regression": regression,
        "composition": composition,
        "sources": {
            "biomass": None if biomass is None else biomass["source"],
            "optical": None if sentinel is None else sentinel.get("collection"),
        },
    }


def _sequestration(biomass: dict | None, agbd: float, sigma_agbd: float | None) -> dict:
    empty = {
        "tco2e_per_ha_per_year": None,
        "method": None,
        "tco2e_per_ha_per_year_range": None,
        "confidence": None,
    }
    if not biomass or not biomass.get("change"):
        return empty
    change = biomass["change"]
    per_ha = change["delta_agbd_mg_ha_per_year"] * CARBON_FRACTION * CO2_PER_C
    delta_sd = change.get("delta_sd_mg_ha_per_year")
    span = None
    if delta_sd is not None:
        sigma = delta_sd * CARBON_FRACTION * CO2_PER_C
        span = [per_ha - sigma, per_ha + sigma]
    conf = "Low"
    if delta_sd is not None and abs(change["delta_agbd_mg_ha_per_year"]) > delta_sd:
        conf = "Medium"
    return {
        "tco2e_per_ha_per_year": per_ha,
        "method": (
            f"esa-cci-biomass-v{biomass['version']} "
            f"{change['from_year']}-{change['to_year']} difference, "
            "converted with carbon fraction 0.47 and 44/12"
        ),
        "tco2e_per_ha_per_year_range": span,
        "confidence": conf,
        "_agbd_for_scale": agbd,
        "_sigma_unused": sigma_agbd,
    }


def _unit(value: float) -> float:
    return max(0.0, min(1.0, float(value)))
