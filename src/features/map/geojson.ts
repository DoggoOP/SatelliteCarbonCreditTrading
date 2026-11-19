import type { Polygon } from "../../../shared/contract";

interface FeatureLike {
  type?: string;
  geometry?: Polygon;
  features?: FeatureLike[];
}

export function parsePolygon(text: string): Polygon | null {
  const parsed = JSON.parse(text) as Polygon | FeatureLike;
  if (parsed.type === "Polygon" && Array.isArray((parsed as Polygon).coordinates)) {
    return parsed as Polygon;
  }
  if (parsed.type === "Feature" && parsed.geometry?.type === "Polygon") {
    return parsed.geometry;
  }
  if (parsed.type === "FeatureCollection") {
    const feature = parsed.features?.find((item) => item.geometry?.type === "Polygon");
    return feature?.geometry ?? null;
  }
  return null;
}
