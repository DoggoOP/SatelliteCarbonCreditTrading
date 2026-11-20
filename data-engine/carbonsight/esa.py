"""ESA CCI Biomass v7, 100 m AGBD, public GeoTIFFs on CEDA (no login)."""

from __future__ import annotations

import math
import time

import numpy as np
from rasterio.enums import Resampling

from carbonsight.raster import cap_shape, inside_mask, open_raster, polygon_window, read_band

BASE = "https://dap.ceda.ac.uk/neodc/esacci/biomass/data/agb/maps/v7.0/geotiff"
VERSION = "7.0"
YEARS = (2024, 2023, 2022)
TILE_DEG = 10

CITATION = (
    "Santoro, M., & Cartus, O. (2025). ESA Biomass Climate Change Initiative "
    "(Biomass_cci): Global datasets of forest above-ground biomass for the years "
    "2005-2012 and 2015-2024, v7.0. NERC EDS Centre for Environmental Data Analysis. "
    "https://catalogue.ceda.ac.uk/uuid/6429d1aafe1e43b9b414e4a5a7f8b903"
)
LICENSE = "ESA CCI Data Policy: free and open access"


def format_tile(north: int, west: int) -> str:
    """Tile name is the northwest corner, spaced every 10 degrees."""
    ns = f"N{north:02d}" if north >= 0 else f"S{abs(north):02d}"
    ew = f"E{west:03d}" if west >= 0 else f"W{abs(west):03d}"
    return ns + ew


def tiles_for_bounds(min_lon: float, min_lat: float, max_lon: float, max_lat: float) -> list[str]:
    """10-degree tiles intersecting a WGS84 box.

    A tile named for its northwest corner (north, west) covers
    latitude [north-10, north) and longitude [west, west+10).
    """
    tiles: list[str] = []
    north = math.floor(min_lat / TILE_DEG) * TILE_DEG + TILE_DEG
    while north - TILE_DEG < max_lat - 1e-12:
        if north > min_lat + 1e-15:
            west = math.floor(min_lon / TILE_DEG) * TILE_DEG
            while west < max_lon - 1e-12:
                tiles.append(format_tile(int(round(north)), int(round(west))))
                west += TILE_DEG
        north += TILE_DEG
        if north > 100:
            break
    return tiles


def agb_url(tile: str, year: int) -> str:
    return (
        f"{BASE}/{year}/{tile}_ESACCI-BIOMASS-L4-AGB-MERGED-100m-{year}-fv{VERSION}.tif"
    )


def sd_url(tile: str, year: int) -> str:
    return (
        f"{BASE}/{year}/{tile}_ESACCI-BIOMASS-L4-AGB_SD-MERGED-100m-{year}-fv{VERSION}.tif"
    )


def _masked_values(url: str, polygon, timeout: float) -> np.ndarray | None:
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            return _masked_values_once(url, polygon, timeout)
        except Exception as exc:
            last_error = exc
            time.sleep(0.6)
    if last_error is not None:
        raise last_error
    return None


def _masked_values_once(url: str, polygon, timeout: float) -> np.ndarray | None:
    with open_raster(url, timeout=timeout) as dataset:
        located = polygon_window(dataset, polygon)
        if located is None:
            return None
        window, _bounds = located
        out_shape = cap_shape(window, 1_500_000)
        data, transform = read_band(
            dataset,
            window,
            out_shape=out_shape,
            resampling=Resampling.average,
        )
        inside = inside_mask(polygon, dataset.crs, transform, data.shape)
    if not np.any(inside):
        return None
    values = data[inside].astype("float64")
    values = values[np.isfinite(values)]
    if values.size == 0:
        return None
    return values


def _read_year(polygon, year: int, timeout: float) -> dict | None:
    minx, miny, maxx, maxy = polygon.bounds
    tiles = tiles_for_bounds(minx, miny, maxx, maxy)
    if not tiles:
        return None
    agb_parts: list[np.ndarray] = []
    sd_parts: list[np.ndarray] = []
    used: list[str] = []
    for tile in tiles:
        try:
            values = _masked_values(agb_url(tile, year), polygon, timeout)
        except Exception:
            values = None
        if values is None:
            continue
        agb_parts.append(values)
        used.append(tile)
        try:
            sd_values = _masked_values(sd_url(tile, year), polygon, timeout)
        except Exception:
            sd_values = None
        if sd_values is not None and sd_values.shape == values.shape:
            sd_parts.append(sd_values)
    if not agb_parts:
        return None
    agb = np.concatenate(agb_parts)
    sd = np.concatenate(sd_parts) if len(sd_parts) == len(agb_parts) else None
    sd_rms = float(np.sqrt(np.mean(np.square(sd)))) if sd is not None else None
    return {
        "year": year,
        "agbd_mg_ha": float(np.mean(agb)),
        "agbd_sd_mg_ha": sd_rms,
        "forest_fraction": float(np.mean(agb > 0)),
        "pixel_count": int(agb.size),
        "tiles": used,
        "coverage_fraction": len(used) / len(tiles),
    }


def load_biomass(polygon, timeout: float) -> dict | None:
    """Latest v7 map plus a 5-year difference when the older year exists.

    Pixel value 0 is non-forest biomass in this product, not a fill value, so it
    stays in the polygon mean. Missing tiles lower coverage_fraction.
    """
    latest = None
    for year in YEARS:
        latest = _read_year(polygon, year, timeout)
        if latest is not None:
            break
    if latest is None:
        return None
    older = _read_year(polygon, latest["year"] - 5, timeout)
    change = None
    if older is not None and older["pixel_count"] > 0:
        years = latest["year"] - older["year"]
        delta = (latest["agbd_mg_ha"] - older["agbd_mg_ha"]) / years
        delta_sd = None
        if latest["agbd_sd_mg_ha"] is not None and older["agbd_sd_mg_ha"] is not None:
            delta_sd = math.sqrt(latest["agbd_sd_mg_ha"] ** 2 + older["agbd_sd_mg_ha"] ** 2) / years
        change = {
            "from_year": older["year"],
            "to_year": latest["year"],
            "delta_agbd_mg_ha_per_year": delta,
            "delta_sd_mg_ha_per_year": delta_sd,
        }
    return {
        "source": "esa-cci-biomass",
        "version": VERSION,
        "year": latest["year"],
        "agbd_mg_ha": latest["agbd_mg_ha"],
        "agbd_sd_mg_ha": latest["agbd_sd_mg_ha"],
        "coverage_fraction": latest["coverage_fraction"],
        "forest_fraction": latest["forest_fraction"],
        "pixel_count": latest["pixel_count"],
        "tiles": latest["tiles"],
        "citation": CITATION,
        "license": LICENSE,
        "change": change,
        "notes": [
            "Values are megagrams of above-ground biomass per hectare. "
            "Zero means non-forest in the CCI forest biomass map."
        ],
    }
