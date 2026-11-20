import {
  CREDIT_DISCLAIMER,
  NON_PERMANENCE_BUFFER,
  type AnalysisRequest,
  type AnalysisResult,
  type ConfidenceBand,
  type DataSourceCitation,
  type Polygon,
  type TimeSeriesPoint,
} from "../../shared/contract";
import { areaHectares, bboxOf, centroidOf, isClosedRing } from "../../shared/geo";
import { HttpError } from "../http";
import {
  biomassToCarbon,
  bufferedIssuance,
  chlorisChangeToAnnualTco2e,
  chlorisPixelHectares,
  modisViToUnit,
  suggestedPrice,
} from "./carbon";
import { asNumber, isoDaysAgo, itemStatistics, searchStac, sentinelTileTemplate, stat, type StacFeature } from "./pc";

const MIN_HA = 5;
const MAX_HA = 20_000;

function citation(
  id: string,
  name: string,
  url: string,
  status: DataSourceCitation["status"],
  note: string,
): DataSourceCitation {
  return { id, name, url, retrievedAt: new Date().toISOString(), status, note };
}

function validate(geometry: Polygon): number {
  if (geometry?.type !== "Polygon" || !Array.isArray(geometry.coordinates)) {
    throw new HttpError(400, "geometry must be a GeoJSON Polygon");
  }
  const ring = geometry.coordinates[0] ?? [];
  if (!isClosedRing(geometry)) {
    throw new HttpError(400, "polygon ring must be closed (first point equals last point)");
  }
  if (ring.length > 500) {
    throw new HttpError(400, "polygon has too many vertices (max 500)");
  }
  const area = areaHectares(geometry);
  if (area < MIN_HA) {
    throw new HttpError(400, `polygon is ${area.toFixed(1)} ha. Draw at least ${MIN_HA} ha so the satellite pixels mean something.`);
  }
  if (area > MAX_HA) {
    throw new HttpError(400, `polygon is ${Math.round(area)} ha. Keep it under ${MAX_HA.toLocaleString()} ha for a live demo.`);
  }
  return area;
}

function bandFor(score: number, stockKnown: boolean): ConfidenceBand {
  if (!stockKnown) return "insufficient";
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function featureTime(feature: StacFeature): string {
  const datetime = feature.properties.datetime ?? feature.properties.start_datetime;
  if (typeof datetime === "string" && datetime.length > 0) return datetime;
  const ordinal = feature.id.match(/A(\d{4})(\d{3})/);
  if (!ordinal) return "";
  const date = new Date(Date.UTC(Number(ordinal[1]), 0, Number(ordinal[2])));
  return date.toISOString();
}

function newest(features: StacFeature[]): StacFeature | null {
  if (features.length === 0) return null;
  return [...features].sort((a, b) => featureTime(b).localeCompare(featureTime(a)))[0];
}

export async function analyzeArea(request: AnalysisRequest): Promise<AnalysisResult> {
  const name = request.name?.trim() || "Untitled stand";
  const geometry = request.geometry;
  const areaHa = validate(geometry);
  const warnings: string[] = [];
  const sources: DataSourceCitation[] = [];

  const modisPromise = (async (): Promise<TimeSeriesPoint[]> => {
    const features = await searchStac({
      collections: ["modis-13Q1-061"],
      intersects: geometry,
      datetime: `${isoDaysAgo(540)}/..`,
      limit: 8,
    });
    const sorted = [...features].sort((a, b) => featureTime(b).localeCompare(featureTime(a)));
    const scenes = await Promise.all(
      sorted.slice(0, 4).map(async (item) => {
        try {
          const stats = await itemStatistics(
            "modis-13Q1-061",
            item.id,
            ["250m_16_days_NDVI", "250m_16_days_EVI"],
            geometry,
          );
          const ndviStat = stat(stats, "250m_16_days_NDVI");
          const eviStat = stat(stats, "250m_16_days_EVI");
          const valid = ndviStat?.valid_percent ?? 0;
          if (!ndviStat || valid < 30) return null;
          const point: TimeSeriesPoint = {
            date: featureTime(item).slice(0, 10),
            ndvi: modisViToUnit(ndviStat.mean),
            evi: eviStat ? modisViToUnit(eviStat.mean) : null,
            cloudFraction: null,
            validPercent: valid,
          };
          return point;
        } catch {
          return null;
        }
      }),
    );
    return scenes.filter((scene): scene is TimeSeriesPoint => scene != null);
  })().catch((error: unknown) => {
    warnings.push(`MODIS vegetation index failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return [] as TimeSeriesPoint[];
  });

  const hgbPromise = (async () => {
    const stats = await itemStatistics("hgb", "hgb", ["aboveground", "aboveground_uncertainty"], geometry);
    return stats;
  })().catch((error: unknown) => {
    warnings.push(`Biomass layer failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return null;
  });

  const chlorisPromise = (async () => {
    const features = await searchStac({
      collections: ["chloris-biomass"],
      intersects: geometry,
      limit: 8,
    });
    const withChange = features.filter((feature) => feature.assets?.biomass_change);
    const item = newest(withChange.length > 0 ? withChange : features);
    if (!item) return null;
    const stats = await itemStatistics("chloris-biomass", item.id, ["biomass_change"], geometry);
    return { feature: item, stats };
  })().catch((error: unknown) => {
    warnings.push(`Chloris change layer failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return null;
  });

  const sentinelPromise = (async () => {
    const features = await searchStac({
      collections: ["sentinel-2-l2a"],
      intersects: geometry,
      datetime: `${isoDaysAgo(180)}/..`,
      query: { "eo:cloud_cover": { lt: 60 } },
      limit: 12,
    });
    const ranked = [...features].sort((a, b) => {
      const aCloud = asNumber(a.properties["eo:cloud_cover"]) ?? 100;
      const bCloud = asNumber(b.properties["eo:cloud_cover"]) ?? 100;
      return aCloud - bCloud;
    });
    return ranked[0] ?? null;
  })().catch((error: unknown) => {
    warnings.push(`Sentinel-2 search failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return null;
  });

  const [modisScenes, hgbStats, chloris, sentinel] = await Promise.all([
    modisPromise,
    hgbPromise,
    chlorisPromise,
    sentinelPromise,
  ]);

  const timeseries = [...modisScenes].sort((a, b) => a.date.localeCompare(b.date));
  const latest = modisScenes[0] ?? null;
  const ndviMean = latest?.ndvi ?? null;
  const eviMean = latest?.evi ?? null;

  sources.push(
    citation(
      "modis-13Q1-061",
      "MODIS vegetation indices (13Q1)",
      "https://planetarycomputer.microsoft.com/dataset/modis-13Q1-061",
      timeseries.length > 0 ? "ok" : "unavailable",
      timeseries.length > 0
        ? `Used ${timeseries.length} live scenes.`
        : "No usable MODIS composite for this polygon.",
    ),
  );

  const agb = hgbStats ? stat(hgbStats, "aboveground") : null;
  const agbUncertainty = hgbStats ? stat(hgbStats, "aboveground_uncertainty") : null;
  let aboveGroundBiomassMgHa: number | null = null;
  let uncertaintyMgHa: number | null = null;
  if (agb && agb.valid_percent >= 30 && agb.mean > 0 && agb.mean < 5000) {
    aboveGroundBiomassMgHa = agb.mean;
    uncertaintyMgHa = agbUncertainty?.mean ?? null;
    sources.push(
      citation(
        "hgb",
        "Harmonized Global Biomass 2010",
        "https://planetarycomputer.microsoft.com/dataset/hgb",
        "ok",
        `Mean aboveground biomass ${agb.mean.toFixed(0)} Mg/ha across ${agb.valid_pixels} sample pixels.`,
      ),
    );
  } else {
    sources.push(
      citation(
        "hgb",
        "Harmonized Global Biomass 2010",
        "https://planetarycomputer.microsoft.com/dataset/hgb",
        "unavailable",
        "Aboveground biomass statistics were missing or outside a physical range.",
      ),
    );
    warnings.push("No biomass stock. Credits cannot be estimated without it.");
  }

  const carbon = aboveGroundBiomassMgHa == null ? null : biomassToCarbon(aboveGroundBiomassMgHa, areaHa);

  let annualTco2e: number | null = null;
  let forecastMethod = "Not computed.";
  if (chloris?.stats) {
    const change = stat(chloris.stats, "biomass_change");
    if (change && change.valid_percent >= 30 && Number.isFinite(change.mean)) {
      annualTco2e = chlorisChangeToAnnualTco2e(change.mean, areaHa);
      const year = String(chloris.feature.properties.datetime ?? "").slice(0, 4);
      forecastMethod = `Chloris biomass change for ${year || "the latest year"}, scaled from a ${Math.round(chlorisPixelHectares())} ha pixel to this polygon.`;
      sources.push(
        citation(
          "chloris-biomass",
          "Chloris aboveground biomass change",
          "https://planetarycomputer.microsoft.com/dataset/chloris-biomass",
          "ok",
          `${annualTco2e.toFixed(0)} tCO2e/year before buffer. Pixel values are totals, not per-hectare rates.`,
        ),
      );
      const tonnesPerHectare = annualTco2e / areaHa;
      if (areaHa < chlorisPixelHectares()) {
        warnings.push("The growth map is one pixel about 5 km wide, so this box is only a sample of it.");
      }
      if (annualTco2e < 0 && Math.abs(tonnesPerHectare) < 0.25) {
        warnings.push(
          `No clear gain or loss (about ${annualTco2e.toFixed(0)} tCO₂e/year). A credit needs a measured gain, so nothing is listed. Humboldt redwoods is gaining.`,
        );
      } else if (annualTco2e < 0) {
        warnings.push(
          `This area lost about ${Math.abs(annualTco2e).toFixed(0)} tCO₂e in the last measured year. A credit pays for carbon removed, so a loss cannot be sold.`,
        );
      }
    }
  }
  if (annualTco2e == null) {
    sources.push(
      citation(
        "chloris-biomass",
        "Chloris aboveground biomass change",
        "https://planetarycomputer.microsoft.com/dataset/chloris-biomass",
        "unavailable",
        "No change pixel for this polygon.",
      ),
    );
    warnings.push("Sequestration is unavailable, so nothing can be listed. Standing stock is not a credit.");
  }

  let sentinelItemId: string | null = null;
  let sentinelTileTemplateValue: string | null = null;
  let sentinelCloudCover: number | null = null;
  if (sentinel) {
    sentinelItemId = sentinel.id;
    sentinelCloudCover = asNumber(sentinel.properties["eo:cloud_cover"]);
    sentinelTileTemplateValue = sentinelTileTemplate(sentinel.id);
    const when = String(sentinel.properties.datetime ?? "").slice(0, 10);
    sources.push(
      citation(
        "sentinel-2-l2a",
        "Sentinel-2 Level-2A",
        "https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a",
        "ok",
        `Clearest scene ${when || sentinel.id}, scene cloud cover ${sentinelCloudCover?.toFixed(1) ?? "unknown"}%.`,
      ),
    );
  } else {
    sources.push(
      citation(
        "sentinel-2-l2a",
        "Sentinel-2 Level-2A",
        "https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a",
        "unavailable",
        "No scene under 60% cloud cover in the last 180 days.",
      ),
    );
  }

  const drivers: string[] = [];
  let score = 35;
  if (aboveGroundBiomassMgHa != null) {
    score += 15;
    drivers.push("Biomass layer returned a physical stock.");
  } else {
    drivers.push("Biomass layer missing.");
  }
  if (uncertaintyMgHa != null && aboveGroundBiomassMgHa) {
    const relative = uncertaintyMgHa / aboveGroundBiomassMgHa;
    if (relative < 0.35) {
      score += 10;
      drivers.push("Biomass uncertainty is under 35% of the mean.");
    } else {
      score -= 5;
      drivers.push(`Biomass uncertainty is ${Math.round(relative * 100)}% of the mean.`);
    }
  }
  if (ndviMean != null && ndviMean > 0.4) {
    score += 10;
    drivers.push("Latest NDVI shows active vegetation.");
  } else if (ndviMean == null) {
    score -= 10;
    drivers.push("No usable NDVI composite.");
  }
  if ((sentinelCloudCover ?? 100) < 15) {
    score += 10;
    drivers.push("A recent Sentinel-2 scene is nearly cloud-free.");
  }
  if (annualTco2e != null && annualTco2e > 0) {
    score += 10;
    drivers.push("A published biomass-change layer supplied the removal rate.");
  }
  if (areaHa < chlorisPixelHectares()) {
    score = Math.min(score, 68);
    drivers.push("Polygon is finer than the sequestration grid.");
  }
  if (timeseries.length < 2) {
    drivers.push("Vegetation time series is still a single composite. Trend is not yet estimated.");
  } else if (timeseries.length < 4) {
    drivers.push("Vegetation time series has fewer than four dates. Trend is not yet estimated.");
  }
  score = Math.max(0, Math.min(100, score));
  const confidenceBand = bandFor(score, aboveGroundBiomassMgHa != null);
  const annualIssuable = annualTco2e == null ? null : bufferedIssuance(annualTco2e);

  return {
    id: `an_${crypto.randomUUID().slice(0, 8)}`,
    name,
    areaHa,
    analyzedAt: new Date().toISOString(),
    centroid: centroidOf(geometry),
    bbox: bboxOf(geometry),
    stock: {
      aboveGroundBiomassMgHa,
      carbonDensityTco2eHa: carbon?.carbonDensityTco2eHa ?? null,
      carbonStockTco2e: carbon?.carbonStockTco2e ?? null,
      uncertaintyMgHa,
      method: "HGB aboveground biomass (Mg/ha) × 0.47 carbon fraction × 44/12, times polygon area.",
    },
    forecast: {
      annualTco2e,
      fiveYearTco2e: annualTco2e == null ? null : annualTco2e * 5,
      method: forecastMethod,
    },
    vegetation: {
      ndviMean,
      eviMean,
      ndviTrendPerYear: null,
      forestFraction: null,
      timeseries,
    },
    uncertainty: {
      score,
      band: confidenceBand,
      drivers,
      clearObservationCount: timeseries.filter((point) => point.ndvi != null).length,
    },
    credits: {
      annualIssuableTco2e: annualIssuable,
      bufferFraction: NON_PERMANENCE_BUFFER,
      suggestedPriceUsdPerTonne: suggestedPrice(confidenceBand),
      disclaimer: CREDIT_DISCLAIMER,
    },
    map: {
      sentinelItemId,
      sentinelTileTemplate: sentinelTileTemplateValue,
      sentinelCloudCover,
      ndviTileTemplate: null,
    },
    sources,
    warnings,
    liveData: aboveGroundBiomassMgHa != null && ndviMean != null,
  };
}
