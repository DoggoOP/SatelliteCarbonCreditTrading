import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createListingFromAnalysis } from "../features/marketplace";
import { MARKET_ANALYSIS_KEY } from "../integrations/MarketplaceGate";
import { toMarketAnalysis } from "../integrations/toMarketAnalysis";
import { fmt, pct } from "../lib/format";
import type { AnalysisResult, Polygon } from "../lib/types";

type Props = {
  result: AnalysisResult | null;
  polygon: Polygon | null;
  error: string | null;
  loading: boolean;
  areaHa: number | null;
};

const levelTone: Record<string, string> = {
  High: "bg-moss text-white",
  Medium: "bg-gold text-white",
  Low: "bg-ink/80 text-white",
};

export function ResultsPanel({ result, polygon, error, loading, areaHa }: Props) {
  const navigate = useNavigate();
  const [listNote, setListNote] = useState<string | null>(null);

  function listCredits() {
    if (!result || !polygon) return;
    const analysis = toMarketAnalysis(result, polygon);
    try {
      createListingFromAnalysis(analysis, {
        pricePerTCO2e: 40,
        vintage: new Date().getFullYear(),
        sellerName: "CarbonSight desk",
      });
    } catch (caught) {
      setListNote(caught instanceof Error ? caught.message : "This result cannot be listed.");
      return;
    }
    sessionStorage.setItem("carbonsight:last-analysis", JSON.stringify(result));
    sessionStorage.setItem(MARKET_ANALYSIS_KEY, JSON.stringify(analysis));
    setListNote(null);
    navigate("/marketplace/list", { state: { analysis } });
  }

  return (
    <aside className="cs-scroll flex h-full w-full flex-col overflow-y-auto border-l border-line bg-[#f7f5ef] md:w-[420px]">
      <div className="border-b border-line px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">Estimate</p>
        <h2 className="mt-1 font-serif text-2xl text-pine">Above-ground carbon</h2>
        <p className="mt-1 text-sm text-ink/60">
          {areaHa != null ? `${fmt(areaHa, areaHa < 10 ? 1 : 0)} ha selected` : "Draw an area on the map"}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-4">
        {loading && (
          <div className="rounded-2xl border border-line bg-white px-4 py-4">
            <p className="font-medium text-pine">Pulling live satellite layers</p>
            <p className="mt-1 text-sm leading-relaxed text-ink/70">
              Sentinel-2, the 2010 biomass-carbon map, and Chloris woody biomass. Clear scenes usually
              return in 15–40 seconds.
            </p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-line">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-moss" />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
        )}

        {!result && !loading && !error && (
          <div className="rounded-2xl border border-dashed border-line bg-white/70 px-4 py-5 text-sm leading-relaxed text-ink/70">
            Search a place or drop one of the forest presets, draw a polygon or rectangle, then run
            <span className="font-medium text-ink"> Analyze with Satellites</span>. Numbers come from
            live public imagery, not a canned sample.
          </div>
        )}

        {result && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${levelTone[result.uncertainty.level]}`}>
                {result.uncertainty.level} confidence · {result.uncertainty.score}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs text-ink/70 ring-1 ring-line">
                {result.engine === "data-engine"
                  ? "data-engine"
                  : result.engine === "builtin+esa-cci"
                    ? "ESA CCI + built-in"
                    : "built-in engine"}
              </span>
            </div>

            <div className="rounded-3xl bg-pine px-5 py-5 text-paper shadow-panel">
              <p className="text-[11px] uppercase tracking-[0.16em] text-paper/60">Stock in the AOI</p>
              <p className="mt-2 font-serif text-4xl leading-none">{fmt(result.carbon.stockTCo2e)} </p>
              <p className="mt-1 text-sm text-paper/75">tCO₂e · {fmt(result.carbon.stockTC)} tC</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-paper/55">Biomass density</p>
                  <p className="font-medium">{fmt(result.biomass.densityMgHa, 1)} Mg/ha</p>
                </div>
                <div>
                  <p className="text-paper/55">Sequestration</p>
                  <p className="font-medium">{fmt(result.carbon.annualSequestrationTCo2e)} tCO₂e/yr</p>
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-2 text-sm">
              <Stat label="Area" value={`${fmt(result.areaHa, result.areaHa < 10 ? 1 : 0)} ha`} />
              <Stat label="Mean NDVI" value={fmt(result.meanNdvi, 2)} hint={result.medianNdvi != null ? `median ${fmt(result.medianNdvi, 2)}` : undefined} />
              <Stat label="EVI" value={fmt(result.meanEvi, 2)} />
              <Stat label="Tree cover" value={pct(result.landcover.treeFraction)} hint={result.landcover.majorityClass || undefined} />
              <Stat label="Clear pixels" value={pct(result.quality.validPixelFraction)} />
              <Stat label="Cloud / shadow" value={pct(result.quality.cloudFraction)} hint={result.quality.sceneDate || undefined} />
              <Stat
                label="ESA CCI v7"
                value={result.biomass.esaDensityMgHa != null ? `${fmt(result.biomass.esaDensityMgHa, 0)} Mg/ha` : "—"}
                hint={result.biomass.esaYear ? String(result.biomass.esaYear) : "100 m cross-check"}
              />
              <Stat label="GEDI coverage" value={pct(result.biomass.gediCoverage)} />
              <Stat label="Biomass coverage" value={pct(result.biomass.coverage)} />
            </dl>

            <div className="rounded-2xl border border-line bg-white px-3 py-3">
              <div className="mb-2 flex items-baseline justify-between px-1">
                <p className="text-sm font-medium text-pine">NDVI, last clear quarters</p>
                <p className="text-[11px] text-ink/45">{result.ndviSeries.length} scenes</p>
              </div>
              {result.ndviSeries.length >= 2 ? (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={result.ndviSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="#eeeae2" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#5c675f" }} tickMargin={6} />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: "#5c675f" }} ticks={[0, 0.25, 0.5, 0.75, 1]} />
                      <Tooltip labelStyle={{ color: "#14221c" }} />
                      <Line type="monotone" dataKey="ndvi" stroke="#1c6b45" strokeWidth={2.2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="px-1 pb-2 text-sm text-ink/60">Only one clear scene was available, so there is no trend line yet.</p>
              )}
            </div>

            <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm">
              <p className="font-medium text-pine">Uncertainty range</p>
              <p className="mt-1 text-ink/80">
                {fmt(result.uncertainty.agbdLow, 0)}–{fmt(result.uncertainty.agbdHigh, 0)} Mg/ha biomass ·{" "}
                {fmt(result.uncertainty.carbonTCLow)}–{fmt(result.uncertainty.carbonTCHigh)} tC
              </p>
              <ul className="mt-2 space-y-1 text-ink/65">
                {result.uncertainty.notes.slice(0, 3).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm">
              <p className="font-medium text-pine">{result.biomass.method}</p>
              <p className="mt-1 leading-relaxed text-ink/75">{result.biomass.methodDetail}</p>
              <p className="mt-2 leading-relaxed text-ink/75">{result.carbon.sequestrationMethod}</p>
              <p className="mt-2 text-ink/60">
                Total biomass {fmt(result.biomass.totalMg)} Mg. Carbon = AGB × {result.carbon.carbonFraction}. tCO₂e = tC × 44/12.
                {result.biomass.esaDensityMgHa != null && ` ESA CCI ${fmt(result.biomass.esaDensityMgHa, 0)} Mg/ha.`}
                {result.biomass.hgbDensityMgHa != null && ` HGB ${fmt(result.biomass.hgbDensityMgHa, 0)} Mg/ha.`}
                {result.biomass.chlorisDensityMgHa != null && ` Chloris ${fmt(result.biomass.chlorisDensityMgHa, 0)} Mg/ha.`}
                {result.biomass.ndviDensityMgHa != null && ` NDVI model ${fmt(result.biomass.ndviDensityMgHa, 0)} Mg/ha.`}
              </p>
              <p className="mt-2 text-ink/50">Zone used for growth: {result.landcover.ipccZone}.</p>
            </div>

            <details className="rounded-2xl border border-line bg-white px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-pine">Sources and limits</summary>
              <ul className="mt-3 space-y-2 text-ink/75">
                {result.sources.map((source) => (
                  <li key={source.name}>
                    <span className="font-medium text-ink">{source.name}. </span>
                    {source.detail}
                  </li>
                ))}
              </ul>
              <ul className="mt-3 list-disc space-y-1 pl-4 text-ink/60">
                {result.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>

            <button
              type="button"
              onClick={listCredits}
              disabled={!polygon}
              className="rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-pine disabled:cursor-not-allowed disabled:bg-ink/30"
            >
              List credits
            </button>
            {listNote && <p className="text-sm text-red-800">{listNote}</p>}
            <p className="pb-4 text-xs leading-relaxed text-ink/45">
              Screening estimate for discussion. Not a verified credit and not an offer to sell one.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-3 py-2.5">
      <dt className="text-[11px] uppercase tracking-wide text-ink/45">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
      {hint && <p className="text-[11px] text-ink/45">{hint}</p>}
    </div>
  );
}
