import assert from "node:assert/strict";
import { analyzeArea } from "../server/engine/analyze";
import { PRESETS } from "../shared/presets";

const preset = PRESETS.find((item) => item.id === "redwoods");
assert.ok(preset, "redwoods preset missing");

const result = await analyzeArea({ name: preset.name, geometry: preset.geometry });

assert.equal(result.liveData, true, "expected live biomass and NDVI");
assert.ok(result.areaHa > 200 && result.areaHa < 800, `unexpected area ${result.areaHa}`);
assert.ok((result.stock.carbonStockTco2e ?? 0) > 1000, "stock should be a real tonne figure");
assert.ok((result.vegetation.ndviMean ?? -1) > 0.2 && (result.vegetation.ndviMean ?? 2) < 1, "NDVI out of range");
assert.ok((result.forecast.annualTco2e ?? 0) !== 0, "chloris change should produce a rate");
assert.ok(result.sources.filter((source) => source.status === "ok").length >= 3, "expected three live sources");

console.log(
  JSON.stringify(
    {
      areaHa: Math.round(result.areaHa),
      agb: result.stock.aboveGroundBiomassMgHa?.toFixed(1),
      stockTco2e: result.stock.carbonStockTco2e?.toFixed(0),
      annualTco2e: result.forecast.annualTco2e?.toFixed(1),
      issuable: result.credits.annualIssuableTco2e?.toFixed(1),
      ndvi: result.vegetation.ndviMean?.toFixed(3),
      band: result.uncertainty.band,
      sentinel: result.map.sentinelItemId,
    },
    null,
    2,
  ),
);
