import assert from "node:assert/strict";
import test from "node:test";
import {
  biomassToCarbon,
  bufferedIssuance,
  chlorisChangeToAnnualTco2e,
  chlorisPixelHectares,
  modisViToUnit,
} from "./carbon";

test("biomass uses the IPCC 0.47 fraction and 44/12", () => {
  const result = biomassToCarbon(100, 10);
  const expectedDensity = 100 * 0.47 * (44 / 12);
  assert.ok(Math.abs(result.carbonDensityTco2eHa - expectedDensity) < 1e-9);
  assert.ok(Math.abs(result.carbonStockTco2e - expectedDensity * 10) < 1e-9);
});

test("chloris change is scaled by polygon area over one 4.6 km pixel", () => {
  const pixelHa = chlorisPixelHectares();
  assert.ok(pixelHa > 2000 && pixelHa < 2300);
  const annual = chlorisChangeToAnnualTco2e(pixelHa, pixelHa / 2);
  assert.ok(Math.abs(annual - pixelHa / 2) < 1e-6);
});

test("buffer keeps 80 percent of positive removals and drops losses", () => {
  assert.ok(Math.abs(bufferedIssuance(100) - 80) < 1e-9);
  assert.equal(bufferedIssuance(-40), 0);
});

test("MODIS digital numbers convert with the 0.0001 scale", () => {
  assert.ok(Math.abs(modisViToUnit(8761) - 0.8761) < 1e-9);
  assert.ok(Math.abs(modisViToUnit(0.42) - 0.42) < 1e-9);
});
