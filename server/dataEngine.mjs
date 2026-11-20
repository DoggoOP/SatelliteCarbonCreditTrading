/**
 * Optional switch to the standalone data-engine service
 * (POST /analyze on DATA_ENGINE_URL, default http://127.0.0.1:8090).
 * The built-in analyzer always remains available.
 */

import { ApiError } from "./http.mjs";

const DEFAULT_BASE = "http://127.0.0.1:8090";
let healthCache = { at: 0, base: "", alive: false };

export function dataEngineBase() {
  const raw = process.env.DATA_ENGINE_URL || DEFAULT_BASE;
  return raw.replace(/\/$/, "");
}

async function ping(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function dataEngineAlive() {
  const base = dataEngineBase();
  if (healthCache.base === base && Date.now() - healthCache.at < 12000) {
    return healthCache.alive;
  }
  const alive =
    (await ping(`${base}/health`, 700)) ||
    (await ping(`${base}/openapi.json`, 700)) ||
    (await ping(`${base}/docs`, 700));
  healthCache = { at: Date.now(), base, alive };
  return alive;
}

export async function fetchDataEngineAnalysis(geometry) {
  const base = dataEngineBase();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55000);
  try {
    const res = await fetch(`${base}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ geometry }),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      throw new ApiError(502, "DATA_ENGINE", "data-engine returned a non-JSON body.");
    }
    if (!res.ok) {
      const message = body?.error || body?.detail || `data-engine returned ${res.status}`;
      throw new ApiError(502, "DATA_ENGINE", String(message));
    }
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.name === "AbortError") {
      throw new ApiError(504, "TIMEOUT", "data-engine timed out.");
    }
    throw new ApiError(502, "DATA_ENGINE", "data-engine request failed.");
  } finally {
    clearTimeout(timer);
  }
}

function num(value) {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function isMock(body) {
  if (!body || typeof body !== "object") return true;
  if (body.mock === true || body.mocked === true || body.demo === true) return true;
  const blob = JSON.stringify(body.sources || body.method || "").toLowerCase();
  return blob.includes("mock");
}

/**
 * Map a data-engine payload onto the CarbonSight analysis schema.
 * Returns null when the payload is not a real estimate we can show.
 */
export function normalizeDataEngine(body) {
  if (!body || typeof body !== "object" || isMock(body)) return null;
  const payload = body.result && typeof body.result === "object" ? body.result : body;

  if (
    num(payload.areaHa) != null &&
    payload.carbon &&
    payload.biomass &&
    payload.uncertainty &&
    num(payload.carbon.stockTC ?? payload.carbon.stockTc) != null
  ) {
    return {
      ...payload,
      engine: "data-engine",
      generatedAt: payload.generatedAt || new Date().toISOString(),
    };
  }

  const areaHa = num(payload.areaHa ?? payload.area_ha ?? payload.area?.hectares);
  const agbd = num(
    payload.biomass?.densityMgHa ??
      payload.agbd_mg_ha ??
      payload.agbd ??
      payload.mean_agbd,
  );
  const carbonTC = num(
    payload.carbon?.stockTC ??
      payload.carbon_tc ??
      payload.carbonStockTC ??
      (agbd != null && areaHa != null ? agbd * 0.47 * areaHa : null),
  );
  if (areaHa == null || carbonTC == null) return null;

  const co2 = num(payload.carbon?.stockTCo2e ?? payload.co2e_t ?? payload.tco2e) ?? carbonTC * (44 / 12);
  const seq = num(
    payload.carbon?.annualSequestrationTCo2e ?? payload.sequestration_tco2e ?? payload.annual_tco2e,
  );
  const ndvi = num(payload.meanNdvi ?? payload.mean_ndvi ?? payload.ndvi);
  const levelRaw = String(payload.uncertainty?.level ?? payload.confidence ?? "Medium");
  const level = ["High", "Medium", "Low"].includes(levelRaw) ? levelRaw : "Medium";
  const gedi = num(payload.biomass?.gediCoverage ?? payload.gedi_coverage) ?? 0;
  const coverage = num(payload.biomass?.coverage ?? payload.biomass_coverage) ?? (gedi > 0 ? gedi : 0);
  const valid = num(payload.quality?.validPixelFraction ?? payload.valid_fraction);
  const cloud = num(payload.quality?.cloudFraction ?? payload.cloud_fraction);
  const low = num(payload.uncertainty?.agbdLow) ?? (agbd != null ? agbd * 0.7 : 0);
  const high = num(payload.uncertainty?.agbdHigh) ?? (agbd != null ? agbd * 1.3 : 0);

  return {
    engine: "data-engine",
    generatedAt: new Date().toISOString(),
    areaHa,
    centroid: payload.centroid ?? null,
    meanNdvi: ndvi,
    medianNdvi: num(payload.medianNdvi) ?? ndvi,
    meanEvi: num(payload.meanEvi ?? payload.evi),
    ndviSeries: Array.isArray(payload.ndviSeries) ? payload.ndviSeries : [],
    biomass: {
      densityMgHa: agbd ?? carbonTC / Math.max(areaHa, 1e-6) / 0.47,
      totalMg: num(payload.biomass?.totalMg) ?? (agbd != null ? agbd * areaHa : carbonTC / 0.47),
      coverage,
      gediCoverage: gedi,
      method: String(payload.biomass?.method ?? payload.method ?? "data-engine"),
      methodDetail: String(payload.biomass?.methodDetail ?? payload.method_detail ?? "data-engine estimate"),
      hgbDensityMgHa: num(payload.biomass?.hgbDensityMgHa),
      chlorisDensityMgHa: num(payload.biomass?.chlorisDensityMgHa),
      ndviDensityMgHa: num(payload.biomass?.ndviDensityMgHa),
      hgbYear: payload.biomass?.hgbYear ?? null,
      chlorisYear: payload.biomass?.chlorisYear ?? null,
    },
    carbon: {
      stockTC: carbonTC,
      stockTCo2e: co2,
      annualSequestrationTdmHa: num(payload.carbon?.annualSequestrationTdmHa) ?? 0,
      annualSequestrationTCo2eHa:
        num(payload.carbon?.annualSequestrationTCo2eHa) ?? (seq != null ? seq / areaHa : 0),
      annualSequestrationTCo2e: seq ?? 0,
      sequestrationMethod: String(
        payload.carbon?.sequestrationMethod ?? payload.sequestration_method ?? "data-engine",
      ),
      carbonFraction: 0.47,
    },
    uncertainty: {
      level,
      score: num(payload.uncertainty?.score ?? payload.confidence_score) ?? (level === "High" ? 80 : level === "Low" ? 35 : 55),
      agbdLow: low,
      agbdHigh: high,
      carbonTCLow: num(payload.uncertainty?.carbonTCLow) ?? low * 0.47 * areaHa,
      carbonTCHigh: num(payload.uncertainty?.carbonTCHigh) ?? high * 0.47 * areaHa,
      notes: Array.isArray(payload.uncertainty?.notes) ? payload.uncertainty.notes : [],
    },
    quality: {
      validPixelFraction: valid,
      cloudFraction: cloud,
      sceneId: payload.quality?.sceneId ?? payload.scene_id ?? null,
      sceneDate: payload.quality?.sceneDate ?? payload.scene_date ?? null,
      sceneCloudCover: num(payload.quality?.sceneCloudCover ?? payload.scene_cloud),
    },
    landcover: payload.landcover ?? {
      treeFraction: null,
      majorityClass: null,
      ipccZone: "data-engine",
    },
    overlay: payload.overlay ?? { tileUrl: null },
    sources: Array.isArray(payload.sources)
      ? payload.sources.map((s) =>
          typeof s === "string" ? { name: s, detail: "" } : { name: s.name, detail: s.detail || "" },
        )
      : [{ name: "data-engine", detail: dataEngineBase() }],
    limitations: Array.isArray(payload.limitations) ? payload.limitations : [],
  };
}
