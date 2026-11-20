/**
 * Built-in live estimate.
 *
 * Sentinel-2 L2A NDVI/EVI and SCL come from the Planetary Computer statistics API.
 * Direct biomass is the 300 m Spawn & Gibbs 2010 aboveground biomass carbon map
 * (HGB), checked against Chloris woody biomass (2019, ~4.6 km). GEDI L4A/L4B
 * require a NASA Earthdata login and are not called.
 *
 * Where the biomass layers have no valid pixels, AGB falls back to the quadratic
 * NDVI model in Poudel et al. 2023 (doi:10.1155/2023/5553957).
 */

import { bboxContains, centroid, polygonAreaHa } from "../shared/geo.mjs";
import { ApiError, fetchJson, pool, withTimeout } from "./http.mjs";

const STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search";
const STATS = "https://planetarycomputer.microsoft.com/api/data/v1/item/statistics";
const CARBON_FRACTION = 0.47;
const CO2_FACTOR = 44 / 12;
const HGB_SCALE = 0.1;
const MIN_HA = 1;
const MAX_HA = 15000;
const MERCATOR_PIXEL_M = 4633.12716525001;

const NDVI_EXPR = "(B08-B04)/(B08+B04-2000)";
const EVI_EXPR =
  "(2.5*((B08-1000)-(B04-1000))/10000)/((((B08-1000)+6*(B04-1000)-7.5*(B02-1000))/10000)+1)";

const WORLDCOVER_NAMES = {
  10: "Tree cover",
  20: "Shrubland",
  30: "Grassland",
  40: "Cropland",
  50: "Built-up",
  60: "Bare / sparse",
  70: "Snow and ice",
  80: "Permanent water",
  90: "Herbaceous wetland",
  95: "Mangroves",
  100: "Moss and lichen",
};

export function analyzeLocal(geometry) {
  return withTimeout(
    run(geometry),
    85000,
    "Analysis timed out before every layer returned. Try a smaller polygon.",
  );
}

async function run(geometry) {
  assertGeometry(geometry);
  const areaHa = polygonAreaHa(geometry);
  if (areaHa < MIN_HA) {
    throw new ApiError(
      400,
      "TOO_SMALL",
      `This area is ${areaHa.toFixed(2)} ha. Draw at least 1 hectare so Sentinel-2 has pixels to sample.`,
    );
  }
  if (areaHa > MAX_HA) {
    throw new ApiError(
      400,
      "TOO_LARGE",
      `This area is ${Math.round(areaHa).toLocaleString("en-US")} ha. Draw 15,000 ha or less so the live satellite query stays fast.`,
    );
  }

  const [lon, lat] = centroid(geometry);
  const scenes = await searchSentinel(geometry, lon, lat);
  if (!scenes.length) {
    throw new ApiError(
      404,
      "NO_IMAGERY",
      "No low-cloud Sentinel-2 scene in the last 30 months intersects this area.",
    );
  }

  const ndviResults = await pool(scenes, 4, (scene) => sentinelIndex(scene, geometry, NDVI_EXPR));
  const series = [];
  scenes.forEach((scene, i) => {
    const hit = ndviResults[i];
    if (!hit?.ok || !hit.value) return;
    const ndvi = clampIndex(hit.value.median ?? hit.value.mean);
    if (ndvi == null) return;
    series.push({
      date: scene.date.slice(0, 10),
      ndvi: round(ndvi, 3),
      sceneCloud: round(scene.cloud, 1),
      mean: hit.value.mean,
      median: hit.value.median,
      validPercent: hit.value.validPercent,
      scene,
    });
  });
  if (!series.length) {
    throw new ApiError(
      502,
      "NO_IMAGERY",
      "Sentinel-2 scenes were found, but NDVI statistics failed for this polygon.",
    );
  }

  const primaryPoint = pickPrimary(series);
  const primary = primaryPoint.scene;

  const [eviHit, sclHit, hgbHit, chlorisStockHit, chlorisChangeHits, coverHit] = await Promise.all([
    sentinelIndex(primary, geometry, EVI_EXPR).catch(() => null),
    sclStats(primary, geometry).catch(() => null),
    hgbStats(geometry).catch(() => null),
    chlorisStock(geometry).catch(() => null),
    chlorisChanges(geometry).catch(() => []),
    worldcover(geometry, lon, lat).catch(() => null),
  ]);

  const meanNdvi = clampIndex(primaryPoint.mean) ?? primaryPoint.ndvi;
  const medianNdvi = finite(primaryPoint.median) ? clampIndex(primaryPoint.median) : primaryPoint.ndvi;
  const ndviForModel = medianNdvi ?? meanNdvi;
  const meanEvi = eviHit ? saneEvi(eviHit.median ?? eviHit.mean) : null;

  const scl = sclHit ? classifyScl(sclHit) : null;
  const validPixelFraction = scl ? scl.validFraction : null;
  const cloudFraction = scl ? scl.cloudFraction : primary.cloud / 100;

  const cover = coverHit || {
    treeFraction: null,
    shrubFraction: 0,
    majorityClass: null,
    counts: {},
  };
  const treeFraction = cover.treeFraction;
  const ndviAgb = ndviForModel == null ? null : ndviToAgb(ndviForModel);

  const hgb = hgbHit;
  const chlorisAgb = chlorisStockHit?.agbMgHa ?? null;
  const pixelHa = chlorisPixelHa(lat);
  const changeSamples = (chlorisChangeHits || []).filter((v) => finite(v));
  const chlorisTco2eHa =
    changeSamples.length > 0 ? average(changeSamples) / pixelHa : null;

  const hgbCoverage = hgb?.validFraction ?? 0;
  const hgbAgb = hgb ? hgb.carbonMgHa / CARBON_FRACTION : null;

  let density;
  let carbonDensity;
  let coverage;
  let method;
  let methodDetail;

  if (hgb && hgbCoverage >= 0.35 && hgb.carbonMgHa > 0) {
    const gap = ndviAgb ?? hgbAgb;
    density = hgbCoverage * hgbAgb + (1 - hgbCoverage) * gap;
    carbonDensity = hgbCoverage * hgb.carbonMgHa + (1 - hgbCoverage) * gap * CARBON_FRACTION;
    coverage = hgbCoverage;
    method = chlorisAgb != null ? "Hybrid · HGB 2010 + Chloris check" : "HGB 2010 biomass carbon";
    methodDetail =
      "Aboveground biomass carbon is the area-weighted Spawn & Gibbs 2010 300 m map (stored integers × 0.1 = Mg C/ha). " +
      "Uncovered pixels, if any, use the Poudel et al. 2023 NDVI quadratic. " +
      (chlorisAgb != null
        ? `Chloris 2019 woody stock over the same ground is ${chlorisAgb.toFixed(0)} Mg/ha at ~4.6 km.`
        : "Chloris did not return a usable stock for this polygon.");
  } else if (chlorisAgb != null && chlorisAgb > 0) {
    density = chlorisAgb;
    carbonDensity = chlorisAgb * CARBON_FRACTION;
    coverage = Math.min(1, areaHa / pixelHa);
    method = "Chloris woody biomass 2019";
    methodDetail =
      "The 300 m carbon map did not cover enough of the polygon, so stock comes from Chloris tonnes-per-pixel divided by the ground area of the Web Mercator cell. Resolution is about 4.6 km.";
  } else if (ndviAgb != null) {
    density = ndviAgb;
    carbonDensity = ndviAgb * CARBON_FRACTION;
    coverage = 0;
    method = "NDVI quadratic (no biomass pixels)";
    methodDetail =
      "No valid biomass-map pixels fell in this polygon. AGB uses Poudel, Shrestha et al. 2023: 304.00·NDVI² − 125.73·NDVI + 26.676 (Mg/ha), a subtropical forest fit that saturates near 200 Mg/ha.";
  } else {
    throw new ApiError(502, "NO_IMAGERY", "Neither biomass layers nor NDVI produced a number for this polygon.");
  }

  const totalMg = density * areaHa;
  const stockTC = carbonDensity * areaHa;
  const stockTCo2e = stockTC * CO2_FACTOR;

  const ipcc = ipccGrowth(lat, lon, treeFraction ?? 0, cover.shrubFraction ?? 0);
  let seqTdmHa = ipcc.rate;
  let seqTco2eHa = ipcc.rate * CARBON_FRACTION * CO2_FACTOR;
  let sequestrationMethod = `Tier-1 default growth (${ipcc.label}). Existing tree cover is treated as primary or older than 20 years. This is not a measured flux.`;

  if (chlorisTco2eHa != null && changeSamples.length >= 2 && Math.abs(chlorisTco2eHa) >= 0.75) {
    seqTco2eHa = chlorisTco2eHa;
    seqTdmHa = chlorisTco2eHa / (CARBON_FRACTION * CO2_FACTOR);
    sequestrationMethod =
      "Chloris annual stock change, averaged across 2016–2019 and converted from tonnes CO₂e per ~4.6 km pixel to a per-hectare flux. Negative values are a net source.";
  }

  const uncertainty = buildUncertainty({
    density,
    carbonDensity,
    areaHa,
    coverage,
    validPixelFraction,
    cloudFraction,
    sceneAgeDays: (Date.now() - Date.parse(primary.date)) / 86400000,
    hgb,
    hgbAgb,
    chlorisAgb,
    ndviAgb,
    gediCoverage: 0,
  });

  const ndviTile = ndviTileTemplate(primary.id);
  const limitations = [
    "Screening estimate for a hackathon demo. It is not a verified carbon credit, a registry issuance, or a substitute for a plot inventory.",
    "GEDI L4A footprints and L4B 1 km AGBD were not used. NASA Earthdata / ORNL DAAC require an authenticated download, which this anonymous deployment does not have.",
    "Spawn & Gibbs (2010) is a 300 m carbon-density map for a single year, with a large per-pixel standard error. Chloris woody biomass is annual through 2019 but about 4.6 km.",
    "Sentinel-2 NDVI uses the processing-baseline offset (reflectance = (DN − 1000) / 10000) and scene selection plus the SCL cloud fraction. Pixels are not individually masked inside the NDVI expression.",
    "The NDVI regression (Poudel et al. 2023, Chure, Nepal) is only the gap-fill. It saturates well below Amazon or redwood stocks.",
    "IPCC Tier-1 growth rates are ecological-zone defaults for natural forest older than 20 years. They are not observed net ecosystem exchange.",
    "Chloris is CC BY-NC-SA 4.0. The harmonized biomass map is read through Microsoft Planetary Computer.",
  ];
  if (chlorisTco2eHa != null) {
    limitations.push(
      `Chloris net change over this cell averages ${chlorisTco2eHa.toFixed(2)} tCO₂e/ha/yr. Values near zero are common for intact forest at 4.6 km because gains and losses cancel.`,
    );
  }

  return {
    engine: "builtin",
    generatedAt: new Date().toISOString(),
    areaHa: round(areaHa, 1),
    centroid: [round(lon, 5), round(lat, 5)],
    meanNdvi: meanNdvi == null ? null : round(meanNdvi, 3),
    medianNdvi: medianNdvi == null ? null : round(medianNdvi, 3),
    meanEvi: meanEvi == null ? null : round(meanEvi, 3),
    ndviSeries: series
      .map((p) => ({ date: p.date, ndvi: p.ndvi, sceneCloud: p.sceneCloud }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    biomass: {
      densityMgHa: round(density, 1),
      totalMg: round(totalMg, 0),
      coverage: round(coverage, 3),
      gediCoverage: 0,
      method,
      methodDetail,
      hgbDensityMgHa: hgbAgb == null ? null : round(hgbAgb, 1),
      chlorisDensityMgHa: chlorisAgb == null ? null : round(chlorisAgb, 1),
      ndviDensityMgHa: ndviAgb == null ? null : round(ndviAgb, 1),
      hgbYear: hgb ? 2010 : null,
      chlorisYear: chlorisAgb == null ? null : 2019,
    },
    carbon: {
      stockTC: round(stockTC, 0),
      stockTCo2e: round(stockTCo2e, 0),
      annualSequestrationTdmHa: round(seqTdmHa, 2),
      annualSequestrationTCo2eHa: round(seqTco2eHa, 2),
      annualSequestrationTCo2e: round(seqTco2eHa * areaHa, 0),
      sequestrationMethod,
      carbonFraction: CARBON_FRACTION,
    },
    uncertainty,
    quality: {
      validPixelFraction: validPixelFraction == null ? null : round(validPixelFraction, 3),
      cloudFraction: cloudFraction == null ? null : round(cloudFraction, 3),
      sceneId: primary.id,
      sceneDate: primary.date.slice(0, 10),
      sceneCloudCover: round(primary.cloud, 1),
    },
    landcover: {
      treeFraction: treeFraction == null ? null : round(treeFraction, 3),
      majorityClass: cover.majorityClass,
      ipccZone: ipcc.label,
    },
    overlay: { tileUrl: ndviTile },
    sources: [
      {
        name: "Sentinel-2 L2A",
        detail: `${primary.id} (${primary.date.slice(0, 10)}), Microsoft Planetary Computer STAC + statistics API. NDVI = (B08−B04)/(B08+B04−2000) after the −1000 baseline offset. EVI uses B02, B04, B08 in reflectance.`,
      },
      {
        name: "Harmonized global biomass carbon, 2010",
        detail:
          "Spawn, S.A. & Gibbs, H.K. Scientific Data (2020), doi:10.1038/s41597-020-0444-4. 300 m aboveground living biomass carbon. Raster values × 0.1 = Mg C/ha.",
      },
      {
        name: "Chloris Global Biomass",
        detail:
          "Annual woody aboveground stock through 2019 in tonnes per ~4.6 km pixel, and annual change in tonnes CO₂e per pixel. Planetary Computer collection chloris-biomass.",
      },
      {
        name: "ESA WorldCover 2021",
        detail: "10 m land cover, used only to choose an IPCC growth class and to report tree fraction.",
      },
      {
        name: "NDVI gap-fill",
        detail:
          "Poudel, A., Shrestha, H.L., et al. (2023). Modeling and mapping of aboveground biomass using Sentinel-2 in the Chure region, Nepal. International Journal of Forestry Research, 5553957. AGB = 304.00·NDVI² − 125.73·NDVI + 26.676.",
      },
      {
        name: "IPCC 2006",
        detail:
          "Carbon fraction 0.47 (Vol. 4, Ch. 4). tCO₂e = tC × 44/12. Growth rates from Table 4.9, natural forest, stands over 20 years.",
      },
    ],
    limitations,
  };
}

function assertGeometry(geometry) {
  if (!geometry || geometry.type !== "Polygon" || !Array.isArray(geometry.coordinates)) {
    throw new ApiError(400, "BAD_GEOMETRY", "Draw a polygon or rectangle on the map first.");
  }
  const ring = geometry.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) {
    throw new ApiError(400, "BAD_GEOMETRY", "The polygon needs at least three corners.");
  }
  let count = 0;
  const walk = (coords) => {
    if (typeof coords[0] === "number") {
      count += 1;
      const [lon, lat] = coords;
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -85 || lat > 85) {
        throw new ApiError(400, "BAD_GEOMETRY", "The polygon has coordinates outside the map.");
      }
      return;
    }
    for (const c of coords) walk(c);
  };
  walk(geometry.coordinates);
  if (count > 400) {
    throw new ApiError(400, "BAD_GEOMETRY", "Use a simpler polygon (fewer than 400 vertices).");
  }
}

async function searchSentinel(geometry, lon, lat) {
  const end = new Date();
  const start = new Date();
  start.setUTCMonth(start.getUTCMonth() - 30);
  const body = await fetchJson(STAC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collections: ["sentinel-2-l2a"],
      intersects: geometry,
      datetime: `${start.toISOString()}/${end.toISOString()}`,
      limit: 80,
      query: { "eo:cloud_cover": { lt: 40 } },
      sortby: [{ field: "properties.datetime", direction: "desc" }],
      fields: {
        include: ["id", "bbox", "properties.datetime", "properties.eo:cloud_cover"],
        exclude: ["links", "assets", "geometry", "stac_extensions"],
      },
    }),
  });
  const features = (body?.features || []).filter((f) => f?.id && f.properties?.datetime);
  const containing = features.filter((f) => bboxContains(f.bbox, lon, lat));
  const poolFeatures = containing.length ? containing : features;
  const byQuarter = new Map();
  for (const feature of poolFeatures) {
    const cloud = Number(feature.properties["eo:cloud_cover"]);
    if (!Number.isFinite(cloud)) continue;
    const key = quarterKey(feature.properties.datetime);
    const prev = byQuarter.get(key);
    if (!prev || cloud < prev.cloud) {
      byQuarter.set(key, {
        id: feature.id,
        date: feature.properties.datetime,
        cloud,
      });
    }
  }
  return [...byQuarter.values()]
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .slice(-8);
}

function pickPrimary(series) {
  const covered = series.filter((point) => (point.validPercent ?? 0) >= 0.55);
  const pool = covered.length ? covered : series;
  const recent = [...pool].reverse().find((point) => point.scene.cloud <= 30);
  if (recent) return recent;
  return [...pool].sort(
    (a, b) => (b.validPercent ?? 0) - (a.validPercent ?? 0) || a.scene.cloud - b.scene.cloud,
  )[0];
}

async function sentinelIndex(scene, geometry, expression) {
  const stats = await itemStats(
    "sentinel-2-l2a",
    scene.id,
    {
      expression,
      asset_as_band: "true",
      nodata: "0",
      max_size: "512",
    },
    geometry,
  );
  const stat = firstStat(stats);
  if (!stat || !stat.count) return null;
  return {
    mean: Number(stat.mean),
    median: Number(stat.median),
    validPercent: Number(stat.valid_percent ?? 0) / 100,
  };
}

async function sclStats(scene, geometry) {
  const stats = await itemStats(
    "sentinel-2-l2a",
    scene.id,
    {
      assets: "SCL",
      categorical: "true",
      resampling: "nearest",
      max_size: "384",
    },
    geometry,
  );
  return firstStat(stats);
}

function classifyScl(stat) {
  const counts = histogramCounts(stat);
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  if (!total) return null;
  const cloud = (counts[3] || 0) + (counts[8] || 0) + (counts[9] || 0) + (counts[10] || 0);
  const invalid = (counts[0] || 0) + (counts[1] || 0) + cloud;
  return {
    cloudFraction: cloud / total,
    validFraction: Math.max(0, (total - invalid) / total),
  };
}

async function hgbStats(geometry) {
  const stats = await itemStats(
    "hgb",
    "hgb",
    {
      assets: ["aboveground", "aboveground_uncertainty"],
      resampling: "nearest",
      max_size: "512",
    },
    geometry,
  );
  const bag = stats?.properties?.statistics || {};
  const stock = bag.aboveground_b1 || bag.aboveground;
  const uncert = bag.aboveground_uncertainty_b1 || bag.aboveground_uncertainty;
  if (!stock?.count) return null;
  const validFraction = Number(stock.valid_percent ?? 0) / 100;
  return {
    carbonMgHa: Number(stock.mean) * HGB_SCALE,
    carbonSe: uncert?.mean != null ? Number(uncert.mean) * HGB_SCALE : Number(stock.std) * HGB_SCALE,
    spatialStd: Number(stock.std) * HGB_SCALE,
    validFraction,
  };
}

async function chlorisStock(geometry) {
  const stats = await itemStats(
    "chloris-biomass",
    "chloris_biomass_50km_2019",
    {
      assets: "biomass",
      nodata: "2147483647",
      resampling: "nearest",
      max_size: "64",
    },
    geometry,
  );
  const stat = firstStat(stats);
  if (!stat?.count || !Number.isFinite(stat.mean) || stat.mean <= 0 || stat.mean > 5e7) return null;
  const lat = centroid(geometry)[1];
  return { agbMgHa: Number(stat.mean) / chlorisPixelHa(lat), tonnes: Number(stat.mean) };
}

async function chlorisChanges(geometry) {
  const years = [2017, 2018, 2019];
  const hits = await pool(years, 3, async (year) => {
    const stats = await itemStats(
      "chloris-biomass",
      `chloris_biomass_50km_${year}`,
      {
        assets: "biomass_change",
        nodata: "-32768",
        resampling: "nearest",
        max_size: "64",
      },
      geometry,
    );
    const stat = firstStat(stats);
    if (!stat?.count || !Number.isFinite(stat.mean)) return null;
    if (Math.abs(stat.mean) > 1e6) return null;
    return Number(stat.mean);
  });
  return hits.filter((h) => h.ok).map((h) => h.value);
}

async function worldcover(geometry, lon, lat) {
  const body = await fetchJson(STAC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      collections: ["esa-worldcover"],
      intersects: geometry,
      datetime: "2021-01-01/2021-12-31",
      limit: 12,
    }),
  });
  const features = body?.features || [];
  const tile =
    features.find((f) => bboxContains(f.bbox, lon, lat) && String(f.id).includes("2021")) ||
    features.find((f) => bboxContains(f.bbox, lon, lat)) ||
    features[0];
  if (!tile) return null;
  const stats = await itemStats(
    "esa-worldcover",
    tile.id,
    { assets: "map", categorical: "true", resampling: "nearest", max_size: "384" },
    geometry,
  );
  const stat = firstStat(stats);
  const counts = histogramCounts(stat);
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  if (!total) {
    const code = Math.round(Number(stat?.majority ?? stat?.mean));
    return {
      treeFraction: code === 10 || code === 95 ? 1 : 0,
      shrubFraction: code === 20 ? 1 : 0,
      majorityClass: WORLDCOVER_NAMES[code] || null,
      counts,
    };
  }
  let bestCode = null;
  let best = -1;
  for (const [code, n] of Object.entries(counts)) {
    if (n > best) {
      best = n;
      bestCode = Number(code);
    }
  }
  return {
    treeFraction: ((counts[10] || 0) + (counts[95] || 0)) / total,
    shrubFraction: (counts[20] || 0) / total,
    majorityClass: WORLDCOVER_NAMES[bestCode] || null,
    counts,
  };
}

async function itemStats(collection, item, query, geometry) {
  const url = new URL(STATS);
  url.searchParams.set("collection", collection);
  url.searchParams.set("item", item);
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach((part) => url.searchParams.append(key, String(part)));
    else url.searchParams.set(key, String(value));
  }
  const feature = { type: "Feature", properties: {}, geometry };
  return fetchJson(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(feature),
    },
    32000,
  );
}

function firstStat(payload) {
  const stats = payload?.properties?.statistics;
  if (!stats) return null;
  const key = Object.keys(stats)[0];
  return key ? stats[key] : null;
}

function histogramCounts(stat) {
  const hist = stat?.histogram;
  if (!Array.isArray(hist) || hist.length < 2) return {};
  const counts = hist[0] || [];
  const edges = hist[1] || [];
  const map = {};
  const n = Math.min(counts.length, edges.length);
  for (let i = 0; i < n; i += 1) {
    const code = Math.round(Number(edges[i]));
    map[code] = (map[code] || 0) + Number(counts[i] || 0);
  }
  return map;
}

function ndviToAgb(ndvi) {
  const x = Math.max(-0.2, Math.min(1, ndvi));
  if (x < 0.2) {
    const at = 26.676 - 125.73 * 0.2 + 304 * 0.2 * 0.2;
    return Math.max(0, (x / 0.2) * at);
  }
  const agb = 26.676 - 125.73 * x + 304 * x * x;
  return Math.max(0, agb);
}

function chlorisPixelHa(latDeg) {
  const side = MERCATOR_PIXEL_M * Math.cos((latDeg * Math.PI) / 180);
  return (side * side) / 10000;
}

function ipccGrowth(lat, lon, treeFraction, shrubFraction) {
  if (treeFraction < 0.25) {
    if (shrubFraction >= 0.3) {
      return { rate: 1, label: "shrubland, approximate IPCC tropical shrubland increment" };
    }
    return { rate: 0, label: "little or no tree cover, woody increment set to zero" };
  }
  const region = ipccRegion(lon);
  const abs = Math.abs(lat);
  if (abs <= 12) {
    if (region === "americas") {
      return {
        rate: 1,
        label: "IPCC 2019 Table 4.9 tropical rainforest, North and South America, primary, 1.0 t dry matter/ha/yr",
      };
    }
    const rates = {
      africa: 3.1,
      "asia continental": 2.2,
      "asia insular": 3.4,
    };
    return { rate: rates[region], label: `IPCC 2006 Table 4.9 tropical rainforest, ${region}, >20 years` };
  }
  if (abs <= 25) {
    const rates = { africa: 1.3, "asia continental": 2, "asia insular": 3, americas: 2 };
    return { rate: rates[region], label: `tropical moist deciduous forest, ${region}, >20 years` };
  }
  if (abs <= 35) {
    const rates = { africa: 2, "asia continental": 2, "asia insular": 3, americas: 2 };
    return { rate: rates[region], label: `subtropical humid forest, ${region}, >20 years` };
  }
  if (lon < -122 && lat > 32 && lat < 52) {
    return { rate: 15, label: "temperate oceanic forest, North America" };
  }
  if (lon >= -12 && lon < 20 && lat > 42 && lat < 62) {
    return { rate: 2.3, label: "temperate oceanic forest, Europe" };
  }
  if (lat < -34 && lon > 165) {
    return { rate: 3.5, label: "temperate oceanic forest, New Zealand" };
  }
  if (abs > 55) {
    return { rate: 1.3, label: "boreal mountain systems, Asia/Europe/North America, >20 years" };
  }
  return { rate: 4, label: "temperate continental forest, Asia/Europe/North America, >20 years" };
}

function ipccRegion(lon) {
  if (lon >= -30 && lon < 60) return "africa";
  if (lon >= 60 && lon < 100) return "asia continental";
  if (lon >= 100) return "asia insular";
  return "americas";
}

function buildUncertainty({
  density,
  carbonDensity,
  areaHa,
  coverage,
  validPixelFraction,
  cloudFraction,
  sceneAgeDays,
  hgb,
  hgbAgb,
  chlorisAgb,
  ndviAgb,
  gediCoverage,
}) {
  const valid = validPixelFraction ?? 0.5;
  const cloud = cloudFraction ?? 0.4;
  let score = 0;
  score += Math.max(0, Math.min(30, coverage * 30));
  score += gediCoverage > 0 ? 10 : 0;
  score += Math.max(0, Math.min(20, valid * 20));
  score += cloud <= 0.1 ? 15 : cloud <= 0.25 ? 10 : cloud <= 0.45 ? 4 : 0;
  score += sceneAgeDays <= 90 ? 12 : sceneAgeDays <= 200 ? 8 : sceneAgeDays <= 400 ? 4 : 1;

  let agreement = null;
  if (hgbAgb && chlorisAgb) {
    agreement = 1 - Math.min(1, Math.abs(hgbAgb - chlorisAgb) / ((hgbAgb + chlorisAgb) / 2));
  } else if (hgbAgb && ndviAgb) {
    if (hgbAgb > 180 && ndviAgb > 120) agreement = 0.55;
    else agreement = 1 - Math.min(1, Math.abs(hgbAgb - ndviAgb) / Math.max(1, (hgbAgb + ndviAgb) / 2));
  }
  if (agreement != null) score += agreement * 13;
  score = Math.round(Math.max(0, Math.min(100, score)));

  const pixelSeCarbon = hgb?.carbonSe ?? carbonDensity * 0.45;
  const crossCheck = chlorisAgb != null ? Math.abs(carbonDensity - chlorisAgb * CARBON_FRACTION) : pixelSeCarbon;
  const halfCarbon = Math.max(pixelSeCarbon, crossCheck * 0.5);
  const halfAgb = halfCarbon / CARBON_FRACTION;
  const rel = carbonDensity > 0 ? halfCarbon / carbonDensity : 1;

  let level = "Low";
  if (score >= 72 && coverage >= 0.65 && valid >= 0.7 && cloud <= 0.2 && rel <= 0.4) level = "High";
  else if (score >= 48 && coverage >= 0.3 && valid >= 0.45) level = "Medium";
  if (rel > 0.7) level = "Low";
  else if (rel > 0.45 && level === "High") level = "Medium";

  const notes = [
    gediCoverage > 0
      ? `GEDI shots cover ${(gediCoverage * 100).toFixed(0)}% of the area.`
      : "GEDI coverage is 0%. Footprints were not available without NASA Earthdata credentials.",
    `Biomass-map coverage of the AOI is ${(coverage * 100).toFixed(0)}%.`,
    `Sentinel-2 clear-pixel fraction is ${(valid * 100).toFixed(0)}% and cloud/shadow is ${(cloud * 100).toFixed(0)}%. Scene age is ${Math.round(sceneAgeDays)} days.`,
  ];
  if (agreement != null) {
    notes.push(`Agreement score between the biomass layers (or the NDVI gap-fill) is ${(agreement * 100).toFixed(0)}%.`);
  }
  if (hgb?.carbonSe) {
    notes.push(
      `The mapped range uses the HGB per-pixel standard error (about ${hgb.carbonSe.toFixed(0)} Mg C/ha), which is wider than the uncertainty of a polygon mean.`,
    );
  }

  return {
    level,
    score,
    agbdLow: round(Math.max(0, density - halfAgb), 1),
    agbdHigh: round(density + halfAgb, 1),
    carbonTCLow: round(Math.max(0, (carbonDensity - halfCarbon) * areaHa), 0),
    carbonTCHigh: round((carbonDensity + halfCarbon) * areaHa, 0),
    notes,
  };
}

function ndviTileTemplate(itemId) {
  const expr = encodeURIComponent(NDVI_EXPR);
  return (
    "https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}.png" +
    `?collection=sentinel-2-l2a&item=${encodeURIComponent(itemId)}` +
    `&asset_as_band=true&nodata=0&expression=${expr}&rescale=0,0.9&colormap_name=rdylgn`
  );
}

function quarterKey(iso) {
  const d = new Date(iso);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}`;
}

function clampIndex(value) {
  if (!Number.isFinite(value)) return null;
  if (value < -1 || value > 1) return null;
  return value;
}

function saneEvi(value) {
  if (!Number.isFinite(value) || value < -0.2 || value > 1.2) return null;
  return value;
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function average(values) {
  return values.reduce((s, n) => s + n, 0) / values.length;
}

function round(value, digits) {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}
