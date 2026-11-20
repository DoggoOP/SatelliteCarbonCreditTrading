"""Process-wide GDAL settings for remote Cloud Optimized GeoTIFFs.

Imported for side effects. Tokens are never placed here; callers that talk to
Earthdata pass a bearer token only inside a short-lived rasterio.Env.
"""

from __future__ import annotations

import os

_CONFIGURED = False


def configure() -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return
    defaults = {
        "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
        "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif,.TIF,.tiff,.TIFF",
        "VSI_CACHE": "TRUE",
        "VSI_CACHE_SIZE": "33554432",
        "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES",
        "GDAL_HTTP_MULTIPLEX": "YES",
        "GDAL_HTTP_VERSION": "1.1",
        "GDAL_HTTP_TIMEOUT": "60",
        "GDAL_HTTP_MAX_RETRY": "3",
        "GDAL_HTTP_RETRY_DELAY": "2",
        "GDAL_HTTP_USERAGENT": "CarbonSight-data-engine/1.0",
        "GDAL_INGESTED_BYTES_AT_OPEN": "32768",
        "PROJ_NETWORK": "OFF",
        "GDAL_NUM_THREADS": "1",
    }
    for key, value in defaults.items():
        os.environ.setdefault(key, value)
    _CONFIGURED = True


configure()
