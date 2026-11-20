import { readFileSync } from "node:fs";
import { analyzeLocal } from "./analyze.mjs";
import { rectangle } from "../shared/geo.mjs";

const presets = JSON.parse(readFileSync(new URL("../shared/presets.json", import.meta.url)));
const name = process.argv[2] || "manaus";
const preset = presets[name];
if (!preset) {
  console.error(`Unknown preset "${name}". Use: ${Object.keys(presets).join(", ")}`);
  process.exit(1);
}

const geometry = rectangle(preset.west, preset.south, preset.east, preset.north);
console.error(`Analyzing ${preset.label}…`);
const started = Date.now();
try {
  const result = await analyzeLocal(geometry);
  const summary = {
    areaHa: result.areaHa,
    meanNdvi: result.meanNdvi,
    medianNdvi: result.medianNdvi,
    meanEvi: result.meanEvi,
    series: result.ndviSeries.length,
    densityMgHa: result.biomass.densityMgHa,
    hgb: result.biomass.hgbDensityMgHa,
    chloris: result.biomass.chlorisDensityMgHa,
    ndviModel: result.biomass.ndviDensityMgHa,
    stockTC: result.carbon.stockTC,
    stockTCo2e: result.carbon.stockTCo2e,
    seqTco2e: result.carbon.annualSequestrationTCo2e,
    seqHa: result.carbon.annualSequestrationTCo2eHa,
    level: result.uncertainty.level,
    score: result.uncertainty.score,
    range: [result.uncertainty.agbdLow, result.uncertainty.agbdHigh],
    cloud: result.quality.cloudFraction,
    valid: result.quality.validPixelFraction,
    scene: result.quality.sceneDate,
    tree: result.landcover.treeFraction,
    zone: result.landcover.ipccZone,
    method: result.biomass.method,
    seconds: Math.round((Date.now() - started) / 100) / 10,
  };
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(error.code || "ERROR", error.message);
  process.exit(1);
}
