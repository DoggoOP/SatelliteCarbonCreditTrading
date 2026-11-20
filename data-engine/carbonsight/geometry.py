"""GeoJSON polygon parsing, geodesic area, and size limits."""

from __future__ import annotations

import math

from pyproj import Geod
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.ops import unary_union
from shapely.validation import make_valid

from carbonsight.errors import DataEngineError

# A 500 km² polygon is about 22 km on a side: small enough for a windowed
# Sentinel-2 read and large enough for a stand or a small project area.
MAX_AREA_HA = 50_000.0
MIN_AREA_HA = 1.0
MAX_BBOX_SPAN_DEG = 1.0
MAX_VERTICES = 10_000

_GEOD = Geod(ellps="WGS84")


def parse_geojson(payload: dict) -> Polygon | MultiPolygon:
    """Accept a Geometry, a Feature, or a FeatureCollection of polygons."""
    if not isinstance(payload, dict):
        raise DataEngineError(
            "invalid_geometry",
            "Body must be a GeoJSON Polygon, MultiPolygon, Feature, or FeatureCollection.",
        )
    crs = payload.get("crs")
    if isinstance(crs, dict):
        raise DataEngineError(
            "invalid_geometry",
            "Only RFC 7946 WGS84 coordinates are accepted. Remove the legacy crs member.",
        )
    try:
        geom = _extract(payload)
    except DataEngineError:
        raise
    except Exception as exc:
        raise DataEngineError(
            "invalid_geometry",
            f"Could not parse the GeoJSON geometry ({exc.__class__.__name__}).",
        ) from exc
    if geom.is_empty or geom.geom_type not in ("Polygon", "MultiPolygon"):
        raise DataEngineError(
            "invalid_geometry",
            "The geometry must be a Polygon or MultiPolygon.",
        )
    if not geom.is_valid:
        geom = make_valid(geom)
        if geom.geom_type == "GeometryCollection":
            parts = [g for g in geom.geoms if g.geom_type in ("Polygon", "MultiPolygon")]
            geom = unary_union(parts) if parts else geom
    if geom.geom_type not in ("Polygon", "MultiPolygon") or geom.is_empty:
        raise DataEngineError(
            "invalid_geometry",
            "The geometry is invalid and could not be repaired into a polygon.",
        )
    vertices = _vertex_count(geom)
    if vertices > MAX_VERTICES:
        raise DataEngineError(
            "polygon_too_complex",
            f"The polygon has {vertices} vertices, above the limit of {MAX_VERTICES}.",
            vertex_count=vertices,
            max_vertices=MAX_VERTICES,
        )
    return geom


def validate_limits(geom: Polygon | MultiPolygon) -> float:
    """Return geodesic area in hectares, or raise if the polygon is out of bounds."""
    minx, miny, maxx, maxy = geom.bounds
    if minx < -180 or maxx > 180 or miny < -90 or maxy > 90:
        raise DataEngineError(
            "invalid_geometry",
            "Coordinates must be longitude/latitude in WGS84, within -180..180 and -90..90.",
        )
    if (maxx - minx) > 180:
        raise DataEngineError(
            "invalid_geometry",
            "Polygons that cross the antimeridian are not supported. Split the geometry.",
        )
    if (maxx - minx) > MAX_BBOX_SPAN_DEG or (maxy - miny) > MAX_BBOX_SPAN_DEG:
        raise DataEngineError(
            "polygon_too_large",
            f"The bounding box spans more than {MAX_BBOX_SPAN_DEG} degrees. "
            "Draw a smaller polygon.",
            max_bbox_span_deg=MAX_BBOX_SPAN_DEG,
        )
    area_ha = geodesic_area_ha(geom)
    if not math.isfinite(area_ha) or area_ha < MIN_AREA_HA:
        raise DataEngineError(
            "polygon_too_small",
            f"The polygon area is {area_ha:.3f} ha. The minimum is {MIN_AREA_HA:.0f} ha.",
            area_ha=round(area_ha, 3) if math.isfinite(area_ha) else None,
            min_area_ha=MIN_AREA_HA,
        )
    if area_ha > MAX_AREA_HA:
        raise DataEngineError(
            "polygon_too_large",
            f"The polygon area is {area_ha:.0f} ha, above the limit of {MAX_AREA_HA:.0f} ha.",
            area_ha=round(area_ha, 1),
            max_area_ha=MAX_AREA_HA,
        )
    return area_ha


def geodesic_area_ha(geom: Polygon | MultiPolygon) -> float:
    area_m2, _ = _GEOD.geometry_area_perimeter(geom)
    return abs(area_m2) / 10_000.0


def bbox(geom: Polygon | MultiPolygon) -> list[float]:
    minx, miny, maxx, maxy = geom.bounds
    return [float(minx), float(miny), float(maxx), float(maxy)]


def to_geojson(geom: Polygon | MultiPolygon) -> dict:
    return mapping(geom)


def _extract(payload: dict):
    kind = payload.get("type")
    if kind == "Feature":
        geometry = payload.get("geometry")
        if not isinstance(geometry, dict):
            raise DataEngineError("invalid_geometry", "Feature.geometry is missing.")
        return _extract(geometry)
    if kind == "FeatureCollection":
        features = payload.get("features") or []
        if not features:
            raise DataEngineError("invalid_geometry", "FeatureCollection has no features.")
        geoms = [_extract(feature) for feature in features]
        return unary_union(geoms)
    if kind in ("Polygon", "MultiPolygon"):
        return shape(payload)
    raise DataEngineError(
        "invalid_geometry",
        "Unsupported GeoJSON type. Send a Polygon, MultiPolygon, Feature, or FeatureCollection.",
        geojson_type=kind,
    )


def _vertex_count(geom: Polygon | MultiPolygon) -> int:
    polygons = [geom] if isinstance(geom, Polygon) else list(geom.geoms)
    total = 0
    for poly in polygons:
        total += len(poly.exterior.coords)
        total += sum(len(ring.coords) for ring in poly.interiors)
    return total
