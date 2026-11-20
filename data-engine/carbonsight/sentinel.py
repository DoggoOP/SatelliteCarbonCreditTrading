"""Sentinel-2 L2A NDVI and EVI from the Planetary Computer STAC API."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import numpy as np
import planetary_computer
from pystac_client import Client
from rasterio.enums import Resampling
from shapely.geometry import mapping

from carbonsight.raster import inside_mask, open_raster, polygon_window, read_band

logger = logging.getLogger("carbonsight.sentinel")

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
COLLECTION = "sentinel-2-l2a"
VALID_SCL = {4, 5}  # vegetation, not vegetated
CLOUD_SCL = {3, 8, 9, 10}  # shadow, medium cloud, high cloud, thin cirrus
MAX_PIXELS = 800_000


def boa_offset(baseline) -> float:
    """Processing baseline >= 4.00 stores reflectance as DN = refl*10000 + 1000."""
    try:
        value = float(baseline)
    except (TypeError, ValueError):
        return -1000.0
    return -1000.0 if value >= 4.0 else 0.0


def reflectance(dn: np.ndarray, offset: float) -> np.ndarray:
    refl = (dn.astype("float32") + np.float32(offset)) / np.float32(10000.0)
    refl[dn == 0] = np.nan
    return refl


def spectral_indices(red: np.ndarray, nir: np.ndarray, blue: np.ndarray, scl: np.ndarray) -> dict:
    """Mean NDVI and EVI on SCL vegetation / bare-soil pixels."""
    valid = np.isin(scl, list(VALID_SCL)) & np.isfinite(red) & np.isfinite(nir) & ((red + nir) > 0.01)
    ndvi = np.full(red.shape, np.nan, dtype="float32")
    ndvi[valid] = (nir[valid] - red[valid]) / (nir[valid] + red[valid])
    evi = np.full(red.shape, np.nan, dtype="float32")
    if blue is not None:
        blue_ok = valid & np.isfinite(blue)
        denom = nir + 6.0 * red - 7.5 * blue + 1.0
        evi_ok = blue_ok & (np.abs(denom) > 1e-6)
        evi[evi_ok] = 2.5 * (nir[evi_ok] - red[evi_ok]) / denom[evi_ok]
        evi[(evi < -1.0) | (evi > 1.5)] = np.nan
    cloud = np.isin(scl, list(CLOUD_SCL))
    inside = np.ones(scl.shape, dtype=bool)
    return _summarize(ndvi, evi, valid, cloud, inside)


def _summarize(ndvi, evi, valid, cloud, inside) -> dict:
    n_inside = int(np.count_nonzero(inside))
    if n_inside == 0:
        return {
            "ndvi_mean": None,
            "evi_mean": None,
            "valid_pixel_fraction": 0.0,
            "cloud_pixel_fraction": 0.0,
        }
    ndvi_vals = ndvi[inside & np.isfinite(ndvi)]
    evi_vals = evi[inside & np.isfinite(evi)]
    return {
        "ndvi_mean": float(np.mean(ndvi_vals)) if ndvi_vals.size else None,
        "evi_mean": float(np.mean(evi_vals)) if evi_vals.size else None,
        "valid_pixel_fraction": float(np.count_nonzero(inside & valid) / n_inside),
        "cloud_pixel_fraction": float(np.count_nonzero(inside & cloud) / n_inside),
    }


def quarters(end: datetime, years: float = 2.0) -> list[tuple[str, datetime, datetime]]:
    """Calendar quarters overlapping the trailing window, oldest first."""
    start = end - timedelta(days=round(365.25 * years))
    year = start.year
    quarter = (start.month - 1) // 3
    found = []
    while True:
        q_start = datetime(year, quarter * 3 + 1, 1, tzinfo=timezone.utc)
        if quarter == 3:
            q_end = datetime(year, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
        else:
            nxt = datetime(year, quarter * 3 + 4, 1, tzinfo=timezone.utc)
            q_end = nxt - timedelta(seconds=1)
        if q_start > end:
            break
        label = f"{year}-Q{quarter + 1}"
        found.append((label, max(q_start, start), min(q_end, end)))
        quarter += 1
        if quarter == 4:
            quarter = 0
            year += 1
        if len(found) > 12:
            break
    return found


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _search(polygon, start: datetime, end: datetime, cloud_lt: float, limit: int):
    catalog = Client.open(STAC)
    search = catalog.search(
        collections=[COLLECTION],
        intersects=mapping(polygon),
        datetime=f"{start.date().isoformat()}/{end.date().isoformat()}",
        query={"eo:cloud_cover": {"lt": cloud_lt}},
        max_items=limit,
    )
    return list(search.items())


def _read_scene(item, polygon, timeout: float, with_evi: bool) -> dict | None:
    signed = planetary_computer.sign(item)
    offset = boa_offset(signed.properties.get("s2:processing_baseline"))
    scl_href = signed.assets["SCL"].href
    try:
        with open_raster(scl_href, timeout=timeout) as scl_ds:
            located = polygon_window(scl_ds, polygon)
            if located is None:
                return None
            window, bounds = located
            reduced = None
            native_h = int(np.ceil(window.height))
            native_w = int(np.ceil(window.width))
            if native_h * native_w > MAX_PIXELS:
                scale = (MAX_PIXELS / float(native_h * native_w)) ** 0.5
                reduced = (max(1, int(native_h * scale)), max(1, int(native_w * scale)))
            scl, transform = read_band(
                scl_ds,
                window,
                out_shape=reduced,
                resampling=Resampling.nearest,
            )
            crs = scl_ds.crs
        inside = inside_mask(polygon, crs, transform, scl.shape)

        def _band(name: str) -> np.ndarray:
            with open_raster(signed.assets[name].href, timeout=timeout) as ds:
                band_window_loc = polygon_window(ds, polygon)
                if band_window_loc is None:
                    raise RuntimeError(f"{name} does not cover the polygon")
                band_window, _band_bounds = band_window_loc
                data, _transform = read_band(
                    ds,
                    band_window,
                    out_shape=scl.shape,
                    resampling=Resampling.average,
                )
            return reflectance(data, offset)

        red = _band("B04")
        nir = _band("B08")
        blue = _band("B02") if with_evi else None
    except Exception as exc:
        logger.info("scene read failed for %s: %s", item.id, exc)
        return None
    if red.shape != scl.shape or nir.shape != scl.shape:
        return None
    if blue is not None and blue.shape != scl.shape:
        blue = None
    if blue is None:
        blue = np.full(scl.shape, np.nan, dtype="float32")
    stats = spectral_indices(red, nir, blue, scl)
    # Recompute fractions on the polygon mask rather than the rectangular window.
    valid = np.isin(scl, list(VALID_SCL)) & np.isfinite(red) & np.isfinite(nir) & ((red + nir) > 0.01)
    cloud = np.isin(scl, list(CLOUD_SCL))
    ndvi = np.full(scl.shape, np.nan, dtype="float32")
    use = inside & valid
    ndvi[use] = (nir[use] - red[use]) / (nir[use] + red[use])
    evi = np.full(scl.shape, np.nan, dtype="float32")
    if with_evi and np.isfinite(blue).any():
        denom = nir + 6.0 * red - 7.5 * blue + 1.0
        evi_ok = use & np.isfinite(blue) & (np.abs(denom) > 1e-6)
        evi[evi_ok] = 2.5 * (nir[evi_ok] - red[evi_ok]) / denom[evi_ok]
        evi[(evi < -1.0) | (evi > 1.5)] = np.nan
    n_inside = int(np.count_nonzero(inside))
    if n_inside == 0:
        return None
    ndvi_vals = ndvi[np.isfinite(ndvi)]
    evi_vals = evi[np.isfinite(evi)]
    stats = {
        "ndvi_mean": float(np.mean(ndvi_vals)) if ndvi_vals.size else None,
        "evi_mean": float(np.mean(evi_vals)) if evi_vals.size else None,
        "valid_pixel_fraction": float(np.count_nonzero(use) / n_inside),
        "cloud_pixel_fraction": float(np.count_nonzero(inside & cloud) / n_inside),
    }
    return stats


def _scene_record(item, stats: dict) -> dict:
    when = _aware(item.datetime)
    return {
        "scene_id": item.id,
        "datetime": when.isoformat().replace("+00:00", "Z") if when else None,
        "mgrs_tile": item.properties.get("s2:mgrs_tile"),
        "processing_baseline": item.properties.get("s2:processing_baseline"),
        "cloud_cover_pct": item.properties.get("eo:cloud_cover"),
        **stats,
    }


def load_sentinel(polygon, timeout: float, include_timeseries: bool = True) -> dict | None:
    """Least-cloudy recent scene, plus a quarterly NDVI series for two years."""
    now = datetime.now(timezone.utc)
    try:
        items = _search(polygon, now - timedelta(days=730), now, cloud_lt=80, limit=250)
    except Exception as exc:
        logger.info("STAC search failed: %s", exc)
        return None
    usable = []
    for item in items:
        when = _aware(item.datetime)
        if when is None or when > now:
            continue
        usable.append(item)
    if not usable:
        return None

    recent_cut = now - timedelta(days=150)
    recent = [item for item in usable if _aware(item.datetime) >= recent_cut] or usable
    recent.sort(key=lambda item: item.properties.get("eo:cloud_cover", 999))
    chosen = None
    for item in recent[:3]:
        stats = _read_scene(item, polygon, timeout, with_evi=True)
        if stats is None:
            continue
        if stats["valid_pixel_fraction"] >= 0.2 or chosen is None:
            chosen = (item, stats)
        if stats["valid_pixel_fraction"] >= 0.2:
            break
    if chosen is None:
        return None
    item, stats = chosen
    record = _scene_record(item, stats)
    when = _aware(item.datetime)
    record["age_days"] = (now - when).total_seconds() / 86400.0 if when else None
    record["collection"] = COLLECTION
    record["time_series"] = []
    if include_timeseries:
        record["time_series"] = _time_series(usable, polygon, now, timeout)
    return record


def _time_series(items, polygon, now: datetime, timeout: float) -> list[dict]:
    series = []
    for label, start, end in quarters(now, 2.0):
        candidates = []
        for item in items:
            when = _aware(item.datetime)
            if when is not None and start <= when <= end:
                candidates.append(item)
        point = {
            "period": label,
            "start": start.date().isoformat(),
            "end": end.date().isoformat(),
            "ndvi_mean": None,
            "valid_pixel_fraction": None,
            "cloud_cover_pct": None,
            "scene_id": None,
            "datetime": None,
        }
        if candidates:
            candidates.sort(key=lambda item: item.properties.get("eo:cloud_cover", 999))
            stats = _read_scene(candidates[0], polygon, timeout, with_evi=False)
            best = candidates[0]
            if stats is not None:
                when = _aware(best.datetime)
                point.update(
                    {
                        "ndvi_mean": stats["ndvi_mean"],
                        "valid_pixel_fraction": stats["valid_pixel_fraction"],
                        "cloud_cover_pct": best.properties.get("eo:cloud_cover"),
                        "scene_id": best.id,
                        "datetime": when.isoformat().replace("+00:00", "Z") if when else None,
                    }
                )
        series.append(point)
    return series
