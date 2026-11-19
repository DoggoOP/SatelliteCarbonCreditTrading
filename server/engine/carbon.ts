import { NON_PERMANENCE_BUFFER, type ConfidenceBand } from "../../shared/contract";

/** IPCC 2006 default carbon fraction of aboveground dry biomass. */
export const IPCC_CARBON_FRACTION = 0.47;
export const CO2_PER_CARBON = 44 / 12;

/**
 * Chloris biomass_change is tonnes of CO2e for one ~4.6 km pixel, not per hectare.
 * Ground sample distance from the collection's proj:transform (metres).
 */
export const CHLORIS_GSD_M = 4633.12716525;

export function chlorisPixelHectares(): number {
  return (CHLORIS_GSD_M * CHLORIS_GSD_M) / 10_000;
}

export function biomassToCarbon(agbMgHa: number, areaHa: number): {
  carbonDensityTco2eHa: number;
  carbonStockTco2e: number;
} {
  const carbonDensityTco2eHa = agbMgHa * IPCC_CARBON_FRACTION * CO2_PER_CARBON;
  return {
    carbonDensityTco2eHa,
    carbonStockTco2e: carbonDensityTco2eHa * areaHa,
  };
}

/** Scale a per-pixel Chloris CO2e change down to the drawn polygon. */
export function chlorisChangeToAnnualTco2e(meanPixelTco2e: number, areaHa: number): number {
  return meanPixelTco2e * (areaHa / chlorisPixelHectares());
}

export function bufferedIssuance(annualTco2e: number): number {
  if (!Number.isFinite(annualTco2e) || annualTco2e <= 0) return 0;
  return annualTco2e * (1 - NON_PERMANENCE_BUFFER);
}

/**
 * MODIS VI COGs store NDVI and EVI as int16. STAC scale is 0.0001.
 * Planetary Computer statistics with unscale=false returns those integers.
 */
export function modisViToUnit(rawMean: number): number {
  if (Math.abs(rawMean) > 2) return rawMean * 0.0001;
  return rawMean;
}

export function suggestedPrice(band: ConfidenceBand): number | null {
  if (band === "high") return 18;
  if (band === "medium") return 12;
  if (band === "low") return 8;
  return null;
}
