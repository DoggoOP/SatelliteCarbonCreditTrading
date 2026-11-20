import express from "express";
import { analyzeLocal } from "./analyze.mjs";
import { ApiError } from "./http.mjs";
import {
  dataEngineAlive,
  dataEngineBase,
  fetchDataEngineAnalysis,
  normalizeDataEngine,
} from "./dataEngine.mjs";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res) => {
  const alive = await dataEngineAlive();
  res.json({
    ok: true,
    builtin: true,
    dataEngine: alive ? dataEngineBase() : null,
  });
});

app.get("/api/geocode", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) return res.json({ results: [] });
  if (q.length > 120) {
    return res.status(400).json({ error: "Search query is too long.", code: "BAD_QUERY" });
  }
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    url.searchParams.set("q", q);
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "CarbonSight/0.1 (hackathon demo; educational)",
      },
    });
    if (!response.ok) {
      return res.status(502).json({ error: "Place search failed.", code: "UPSTREAM" });
    }
    const rows = await response.json();
    const results = (Array.isArray(rows) ? rows : []).map((row) => ({
      label: row.display_name,
      lat: Number(row.lat),
      lon: Number(row.lon),
      bbox: Array.isArray(row.boundingbox) ? row.boundingbox.map(Number) : null,
    }));
    res.json({ results });
  } catch {
    res.status(502).json({ error: "Place search is unreachable.", code: "UPSTREAM" });
  }
});

app.post("/api/analyze", async (req, res) => {
  const geometry = req.body?.geometry;
  const engine = req.body?.engine || "auto";
  try {
    const result = await analyzeAuto(geometry, engine);
    res.json(result);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const code = error instanceof ApiError ? error.code : "ERROR";
    const message = error instanceof Error ? error.message : "Analysis failed.";
    if (status >= 500) console.error("analyze failed", code, message);
    res.status(status).json({ error: message, code });
  }
});

async function analyzeAuto(geometry, engine) {
  if (engine === "data-engine") {
    const alive = await dataEngineAlive();
    if (!alive) {
      throw new ApiError(503, "DATA_ENGINE", `data-engine is not reachable at ${dataEngineBase()}.`);
    }
    const raw = await fetchDataEngineAnalysis(geometry);
    const normalized = normalizeDataEngine(raw);
    if (!normalized) {
      throw new ApiError(502, "DATA_ENGINE", "data-engine responded without a usable estimate.");
    }
    return normalized;
  }
  return analyzeLocal(geometry);
}

const port = Number(process.env.PORT || 8787);
app.listen(port, "0.0.0.0", () => {
  console.log(`CarbonSight API on http://127.0.0.1:${port}`);
});
