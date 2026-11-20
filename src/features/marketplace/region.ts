import type { AnalysisPolygon, GeoJsonPolygon, GeoJsonPosition } from "./types";

interface RegionBox {
  name: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

const REGIONS: readonly RegionBox[] = [
  { name: "Pacific Northwest", minLat: 42, maxLat: 50, minLon: -125, maxLon: -116 },
  { name: "Scandinavia", minLat: 55, maxLat: 71, minLon: 5, maxLon: 25 },
  { name: "Amazon Basin", minLat: -12, maxLat: 2, minLon: -78, maxLon: -50 },
  { name: "Congo Basin", minLat: -5, maxLat: 5, minLon: 12, maxLon: 28 },
  { name: "Southeast Asia", minLat: -8, maxLat: 8, minLon: 95, maxLon: 120 },
  { name: "Atlantic Forest", minLat: -30, maxLat: -15, minLon: -50, maxLon: -39 },
];

function ringCentroid(ring: readonly GeoJsonPosition[]): [number, number] | null {
  if (ring.length === 0) return null;
  let area = 0;
  let lonAcc = 0;
  let latAcc = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    lonAcc += (x1 + x2) * cross;
    latAcc += (y1 + y2) * cross;
  }
  if (Math.abs(area) < 1e-12) {
    const lon = ring.reduce((sum, point) => sum + point[0], 0) / ring.length;
    const lat = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
    return [lon, lat];
  }
  const factor = 1 / (3 * area);
  return [lonAcc * factor, latAcc * factor];
}

function polygonCentroid(polygon: GeoJsonPolygon): [number, number] | null {
  const ring = polygon.coordinates[0];
  if (!ring) return null;
  return ringCentroid(ring);
}

export function centroidOf(polygon: AnalysisPolygon): [number, number] | null {
  if (polygon.type === "Feature") {
    if (!polygon.geometry) return null;
    return centroidOf(polygon.geometry);
  }
  if (polygon.type === "Polygon") {
    return polygonCentroid(polygon);
  }
  let best: [number, number] | null = null;
  let bestArea = -1;
  for (const coordinates of polygon.coordinates) {
    const candidate = polygonCentroid({ type: "Polygon", coordinates });
    const ring = coordinates[0];
    if (!candidate || !ring) continue;
    const area = Math.abs(ringArea(ring));
    if (area > bestArea) {
      best = candidate;
      bestArea = area;
    }
  }
  return best;
}

function ringArea(ring: readonly GeoJsonPosition[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum / 2;
}

function fallbackRegion(lat: number): string {
  if (lat >= 50) return "Boreal";
  if (lat >= 23.5) return "Temperate north";
  if (lat >= -23.5) return "Tropics";
  if (lat >= -50) return "Temperate south";
  return "Austral";
}

export function inferRegion(polygon: AnalysisPolygon): string {
  const centroid = centroidOf(polygon);
  if (!centroid) return "Unspecified region";
  const [lon, lat] = centroid;
  const match = REGIONS.find(
    (region) =>
      lat >= region.minLat && lat <= region.maxLat && lon >= region.minLon && lon <= region.maxLon,
  );
  return match?.name ?? fallbackRegion(lat);
}

function coord(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

export function squarePolygon(lon: number, lat: number, delta = 0.2): GeoJsonPolygon {
  const west = coord(lon - delta);
  const east = coord(lon + delta);
  const south = coord(lat - delta);
  const north = coord(lat + delta);
  return {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}
