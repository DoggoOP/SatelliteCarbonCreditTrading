import { useEffect, useMemo, useState } from "react";
import presetsJson from "../../shared/presets.json";
import { polygonAreaHa, rectangle } from "../../shared/geo.mjs";
import { MapView } from "../components/MapView";
import { ResultsPanel } from "../components/ResultsPanel";
import { analyzeArea, searchPlaces } from "../lib/api";
import { fmt } from "../lib/format";
import type { AnalysisResult, GeocodeHit, Polygon } from "../lib/types";

type Preset = {
  id: string;
  label: string;
  detail: string;
  west: number;
  south: number;
  east: number;
  north: number;
};

const presets = Object.values(presetsJson) as Preset[];
type DrawMode = "idle" | "polygon" | "rectangle";

export function AnalyzePage() {
  const [mode, setMode] = useState<DrawMode>("polygon");
  const [aoi, setAoi] = useState<Polygon | null>(null);
  const [focus, setFocus] = useState<{ west: number; south: number; east: number; north: number; token: number } | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [showNdvi, setShowNdvi] = useState(true);

  const areaHa = useMemo(() => (aoi ? polygonAreaHa(aoi) : null), [aoi]);

  useEffect(() => {
    if (query.trim().length < 3) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(() => {
      searchPlaces(query.trim()).then(setHits).catch(() => setHits([]));
    }, 350);
    return () => window.clearTimeout(handle);
  }, [query]);

  function applyPreset(preset: Preset) {
    const geometry = rectangle(preset.west, preset.south, preset.east, preset.north) as Polygon;
    setAoi(geometry);
    setMode("idle");
    setFocus({ ...preset, token: Date.now() });
    setResult(null);
    setError(null);
  }

  function flyToHit(hit: GeocodeHit) {
    setHits([]);
    setQuery(hit.label.split(",")[0] || hit.label);
    if (hit.bbox && hit.bbox.length === 4) {
      const [south, north, west, east] = hit.bbox;
      setFocus({ west, south, east, north, token: Date.now() });
    } else {
      const pad = 0.08;
      setFocus({
        west: hit.lon - pad,
        east: hit.lon + pad,
        south: hit.lat - pad,
        north: hit.lat + pad,
        token: Date.now(),
      });
    }
  }

  async function onAnalyze() {
    if (!aoi || loading) return;
    setLoading(true);
    setError(null);
    try {
      const next = await analyzeArea(aoi, "auto");
      setResult(next);
      sessionStorage.setItem("carbonsight:last-analysis", JSON.stringify(next));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  const tooSmall = areaHa != null && areaHa < 1;
  const tooLarge = areaHa != null && areaHa > 15000;

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <div className="relative min-h-[420px] flex-1">
        <MapView
          aoi={aoi}
          mode={mode}
          focus={focus}
          ndviTiles={result?.overlay.tileUrl ?? null}
          showNdvi={showNdvi && Boolean(result?.overlay.tileUrl)}
          onAoi={(geometry) => {
            setAoi(geometry);
            setResult(null);
            setError(null);
            if (geometry) setMode("idle");
          }}
        />

        <div className="absolute left-3 top-3 z-10 w-[min(100%-1.5rem,340px)] space-y-2">
          <div className="rounded-2xl border border-white/40 bg-paper/95 p-2 shadow-panel backdrop-blur">
            <label className="sr-only" htmlFor="place-search">
              Search a place
            </label>
            <input
              id="place-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a place"
              className="w-full rounded-xl bg-white px-3 py-2 text-sm outline-none ring-1 ring-line focus:ring-moss"
            />
            {hits.length > 0 && (
              <ul className="mt-1 max-h-48 overflow-auto rounded-xl bg-white text-sm ring-1 ring-line">
                {hits.map((hit) => (
                  <li key={`${hit.lat}-${hit.lon}-${hit.label}`}>
                    <button
                      type="button"
                      className="block w-full truncate px-3 py-2 text-left hover:bg-paper"
                      onClick={() => flyToHit(hit)}
                    >
                      {hit.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-pine ring-1 ring-line hover:ring-moss"
                  title={preset.detail}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Tool active={mode === "polygon"} onClick={() => setMode("polygon")}>
              Polygon
            </Tool>
            <Tool active={mode === "rectangle"} onClick={() => setMode("rectangle")}>
              Rectangle
            </Tool>
            <Tool
              active={false}
              onClick={() => {
                setAoi(null);
                setResult(null);
                setError(null);
                setMode("polygon");
              }}
            >
              Clear
            </Tool>
            {result?.overlay.tileUrl && (
              <Tool active={showNdvi} onClick={() => setShowNdvi((value) => !value)}>
                NDVI overlay
              </Tool>
            )}
          </div>
        </div>

        <div className="absolute bottom-4 left-3 z-10 flex max-w-[min(100%-1.5rem,520px)] flex-wrap items-center gap-2">
          <div className="rounded-full bg-pine/95 px-3 py-2 text-sm text-paper shadow-panel">
            {areaHa == null && "No area yet"}
            {areaHa != null && `${fmt(areaHa, areaHa < 10 ? 2 : 0)} ha`}
            {tooSmall && " · too small"}
            {tooLarge && " · too large"}
          </div>
          <button
            type="button"
            disabled={!aoi || loading || tooSmall || tooLarge}
            onClick={onAnalyze}
            className="rounded-full bg-moss px-4 py-2 text-sm font-semibold text-white shadow-panel disabled:cursor-not-allowed disabled:bg-ink/30"
          >
            {loading ? "Analyzing…" : "Analyze with Satellites"}
          </button>
          <p className="hidden text-xs text-white drop-shadow sm:block">
            {mode === "polygon" ? "Click corners, then click the first point." : mode === "rectangle" ? "Drag a rectangle." : "Area ready."}
          </p>
        </div>
      </div>

      <ResultsPanel result={result} polygon={aoi} error={error} loading={loading} areaHa={areaHa} />
    </div>
  );
}

function Tool({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium shadow-sm ${
        active ? "bg-pine text-paper" : "bg-paper/95 text-ink ring-1 ring-line"
      }`}
    >
      {children}
    </button>
  );
}
