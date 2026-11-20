/**
 * Cross-check against the Python data-engine (ESA CCI Biomass v7, 100 m).
 * A miss or a timeout leaves the built-in HGB / Chloris estimate in place.
 */

import { dataEngineAlive, dataEngineBase } from "./dataEngine.mjs";

function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function fetchEsaCrossCheck(geometry) {
  const alive = await dataEngineAlive();
  if (!alive) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 100000);
  try {
    const url = `${dataEngineBase()}/analyze?timeseries=false&timeout_s=90`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(geometry),
      signal: ctrl.signal,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.error) return null;
    const agbd = num(body.biomass?.agbd_mg_ha);
    if (agbd == null || agbd < 0) return null;
    const range = body.estimate?.agbd_mg_ha_range;
    return {
      agbd,
      sd: num(body.biomass?.agbd_sd_mg_ha),
      coverage: num(body.biomass?.coverage_fraction) ?? 0,
      year: body.biomass?.year ?? null,
      tiles: Array.isArray(body.biomass?.tiles) ? body.biomass.tiles : [],
      seqHa: num(body.estimate?.sequestration_tco2e_per_ha_per_year),
      seqConfidence: body.estimate?.sequestration_confidence ?? null,
      confidence: body.estimate?.confidence ?? null,
      confidenceScore: num(body.estimate?.confidence_score),
      range:
        Array.isArray(range) && range.length >= 2 && range.every((n) => typeof n === "number")
          ? [range[0], range[1]]
          : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
