"""HTTP API. POST /analyze with a GeoJSON polygon."""

from __future__ import annotations

import logging

from fastapi import Body, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from carbonsight.analyze import analyze
from carbonsight.errors import DataEngineError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("carbonsight.app")

app = FastAPI(
    title="CarbonSight data engine",
    version="1.0.0",
    description="Live aboveground biomass, Sentinel-2 NDVI, and a CO2e estimate for one polygon.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
def post_analyze(
    payload: dict = Body(...),
    timeout_s: float = Query(90, ge=10, le=180),
    timeseries: bool = Query(True),
):
    """GeoJSON Polygon, MultiPolygon, Feature, or FeatureCollection in WGS84."""
    try:
        return analyze(payload, timeout_s=timeout_s, include_timeseries=timeseries)
    except DataEngineError as exc:
        return JSONResponse(exc.to_dict(), status_code=exc.status_code)
    except Exception as exc:  # noqa: BLE001
        logger.exception("unhandled analysis error")
        return JSONResponse(
            {"error": "upstream_failure", "message": f"{exc.__class__.__name__}: {exc}"},
            status_code=502,
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
