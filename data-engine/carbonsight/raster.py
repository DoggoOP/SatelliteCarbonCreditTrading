"""Windowed reads of remote GeoTIFFs, masked to a polygon."""

from __future__ import annotations

import math
from contextlib import contextmanager

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.features import geometry_mask
from rasterio.transform import from_bounds as transform_from_bounds
from rasterio.warp import transform_bounds, transform_geom
from rasterio.windows import Window, bounds as window_bounds, from_bounds
from shapely.geometry import mapping

import carbonsight.gdalenv  # noqa: F401  (configure GDAL on import)


@contextmanager
def open_raster(url: str, *, token: str | None = None, timeout: float = 25):
    """Open a remote GeoTIFF. An Earthdata bearer token stays inside this env."""
    options = {
        "GDAL_HTTP_TIMEOUT": str(max(5, int(timeout))),
        "GDAL_HTTP_MAX_RETRY": "2",
    }
    if token:
        # Sent only to this open. GDAL drops the header if Earthdata redirects
        # to a different host (the usual presigned-URL hop).
        options["GDAL_HTTP_HEADERS"] = f"Authorization: Bearer {token}"
        options["GDAL_HTTP_AUTH"] = "BEARER"
        options["GDAL_HTTP_BEARER"] = token
    path = url if url.startswith("/vsi") else "/vsicurl/" + url
    with rasterio.Env(**options):
        with rasterio.open(path) as dataset:
            yield dataset


def polygon_window(dataset, polygon) -> tuple[Window, tuple[float, float, float, float]] | None:
    """Pixel window covering the polygon bounds, clipped to the raster."""
    minx, miny, maxx, maxy = polygon.bounds
    left, bottom, right, top = transform_bounds(
        "EPSG:4326", dataset.crs, minx, miny, maxx, maxy, densify_pts=21
    )
    window = from_bounds(left, bottom, right, top, dataset.transform)
    window = window.round_offsets(op="floor").round_lengths(op="ceil")
    window = window.intersection(Window(0, 0, dataset.width, dataset.height))
    if window.width < 1 or window.height < 1:
        return None
    return window, window_bounds(window, dataset.transform)


def read_band(dataset, window: Window, *, out_shape: tuple[int, int] | None, resampling) -> tuple[np.ndarray, object]:
    """Read one band. out_shape resamples the window onto that grid."""
    if out_shape is None:
        data = dataset.read(1, window=window)
        transform = dataset.window_transform(window)
        return data, transform
    height, width = out_shape
    data = dataset.read(1, window=window, out_shape=(height, width), resampling=resampling)
    left, bottom, right, top = window_bounds(window, dataset.transform)
    transform = transform_from_bounds(left, bottom, right, top, width, height)
    return data, transform


def maybe_downsample_shape(height: int, width: int, max_pixels: int | None) -> tuple[int, int] | None:
    """Return a smaller (height, width) when the native window is too large."""
    if not max_pixels or height * width <= max_pixels:
        return None
    scale = math.sqrt(max_pixels / float(height * width))
    return max(1, int(height * scale)), max(1, int(width * scale))


def inside_mask(polygon, crs, transform, shape: tuple[int, int]) -> np.ndarray:
    projected = transform_geom("EPSG:4326", crs, mapping(polygon))
    return geometry_mask(
        [projected],
        out_shape=shape,
        transform=transform,
        invert=True,
        all_touched=True,
    )


def cap_shape(window: Window, max_pixels: int | None) -> tuple[int, int] | None:
    height = int(math.ceil(window.height))
    width = int(math.ceil(window.width))
    reduced = maybe_downsample_shape(height, width, max_pixels)
    if reduced is None:
        return None
    return reduced
