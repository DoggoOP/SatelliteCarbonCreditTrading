import type { AnalysisResult, GeocodeHit, Polygon } from "./types";

export type EngineChoice = "auto" | "builtin" | "data-engine";

/**
 * The browser always talks to this app's API. The server prefers a running
 * data-engine (DATA_ENGINE_URL or http://127.0.0.1:8090/analyze) when `engine`
 * is "auto" and that service returns a real estimate. Otherwise it uses the
 * built-in Planetary Computer path.
 */
export async function analyzeArea(geometry: Polygon, engine: EngineChoice = "auto"): Promise<AnalysisResult> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ geometry, engine }),
    signal: AbortSignal.timeout(150000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.error === "string" ? body.error : "Analysis failed.";
    const error = new Error(message) as Error & { code?: string };
    error.code = body.code;
    throw error;
  }
  return body as AnalysisResult;
}

export async function searchPlaces(query: string): Promise<GeocodeHit[]> {
  const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  if (!response.ok) return [];
  const body = await response.json();
  return Array.isArray(body.results) ? body.results : [];
}
