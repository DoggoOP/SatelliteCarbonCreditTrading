const STAC = "https://planetarycomputer.microsoft.com/api/stac/v1";
const DATA = "https://planetarycomputer.microsoft.com/api/data/v1";

export interface StacFeature {
  id: string;
  properties: Record<string, unknown>;
  assets?: Record<string, { href?: string }>;
}

export interface BandStat {
  min: number;
  max: number;
  mean: number;
  std: number;
  valid_percent: number;
  valid_pixels: number;
  count: number;
}

interface SearchResponse {
  features?: StacFeature[];
}

async function readError(response: Response): Promise<string> {
  const text = await response.text();
  return text.slice(0, 240);
}

export async function postJson<T>(url: string, body: unknown, timeoutMs = 14_000): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`POST ${response.status} ${await readError(response)}`);
  }
  return (await response.json()) as T;
}

export async function searchStac(body: unknown, timeoutMs = 14_000): Promise<StacFeature[]> {
  const payload = await postJson<SearchResponse>(`${STAC}/search`, body, timeoutMs);
  return payload.features ?? [];
}

export async function itemStatistics(
  collection: string,
  item: string,
  assets: string[],
  geometry: unknown,
): Promise<Record<string, BandStat>> {
  const params = new URLSearchParams({ collection, item, unscale: "false", max_size: "256" });
  for (const asset of assets) params.append("assets", asset);
  const url = `${DATA}/item/statistics?${params.toString()}`;
  const feature = { type: "Feature", properties: {}, geometry };
  const payload = await postJson<{ properties?: { statistics?: Record<string, BandStat> } }>(url, feature);
  return payload.properties?.statistics ?? {};
}

export function stat(stats: Record<string, BandStat>, asset: string): BandStat | null {
  return stats[`${asset}_b1`] ?? stats[asset] ?? null;
}

export function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function sentinelTileTemplate(itemId: string): string {
  const params = new URLSearchParams({
    collection: "sentinel-2-l2a",
    item: itemId,
    assets: "visual",
    asset_bidx: "visual|1,2,3",
    nodata: "0",
  });
  return `${DATA}/item/tiles/WebMercatorQuad/{z}/{x}/{y}.png?${params.toString()}`;
}
