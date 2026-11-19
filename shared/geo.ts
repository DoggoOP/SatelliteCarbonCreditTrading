import type { Polygon } from "./contract";

const EARTH_RADIUS_M = 6378137;

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function areaHectares(polygon: Polygon): number {
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) return 0;
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];
    total += (toRad(lng2) - toRad(lng1)) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  const squareMeters = Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
  return squareMeters / 10_000;
}

export function bboxOf(polygon: Polygon): [number, number, number, number] {
  const ring = polygon.coordinates[0] ?? [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [lng, lat] of ring) {
    minX = Math.min(minX, lng);
    minY = Math.min(minY, lat);
    maxX = Math.max(maxX, lng);
    maxY = Math.max(maxY, lat);
  }
  return [minX, minY, maxX, maxY];
}

export function centroidOf(polygon: Polygon): [number, number] {
  const ring = polygon.coordinates[0] ?? [];
  const points = ring.length > 1 ? ring.slice(0, -1) : ring;
  if (points.length === 0) return [0, 0];
  const lng = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const lat = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  return [lng, lat];
}

export function isClosedRing(polygon: Polygon): boolean {
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) return false;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return Math.abs(first[0] - last[0]) < 1e-8 && Math.abs(first[1] - last[1]) < 1e-8;
}
