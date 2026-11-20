import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { analyzeArea, createListing } from "../api/client";
import { MapWorkbench } from "../features/map/MapWorkbench";
import { BestCreditFinder } from "../features/results/BestCreditFinder";
import { CreditExplainer } from "../features/results/CreditExplainer";
import { ResultsPanel } from "../features/results/ResultsPanel";
import type { AnalysisResult, Polygon } from "../../shared/contract";
import { presetById, type ForestPreset } from "../../shared/presets";

export function AnalyzePage() {
  const [params] = useSearchParams();
  const initial = useMemo(() => presetById(params.get("preset")), [params]);
  const navigate = useNavigate();
  const [name, setName] = useState(initial.name);
  const [geometry, setGeometry] = useState<Polygon>(initial.geometry);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listBusy, setListBusy] = useState(false);
  const [listNote, setListNote] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setListNote(null);
    try {
      const next = await analyzeArea({ name, geometry });
      setResult(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  function showForest(preset: ForestPreset, next: AnalysisResult) {
    setName(preset.name);
    setGeometry(preset.geometry);
    setResult(next);
    setError(null);
  }

  async function listCredits() {
    if (!result) return;
    setListBusy(true);
    setListNote(null);
    try {
      const listing = await createListing({ analysis: result });
      setListNote(`Listed ${listing.annualTco2e.toFixed(0)} tCO₂e/yr.`);
      navigate("/market");
    } catch (caught) {
      setListNote(caught instanceof Error ? caught.message : "Could not list");
    } finally {
      setListBusy(false);
    }
  }

  const issuable = result?.credits.annualIssuableTco2e ?? null;
  const headline = !result
    ? null
    : issuable != null && issuable > 0
      ? `${Math.round(issuable).toLocaleString()} tCO₂e/yr can be listed from ${result.name}`
      : `${result.name} is storing carbon, but there is no measured gain to sell.`;

  return (
    <div className="space-y-4">
      <BestCreditFinder onChoose={showForest} />
      <div className="rounded-2xl border border-line bg-paper px-4 py-3">
        {busy ? (
          <p className="text-sm font-medium">Reading live satellite data…</p>
        ) : error ? (
          <p className="text-sm font-medium text-copper">{error}</p>
        ) : headline ? (
          <p className="text-sm font-medium">{headline}</p>
        ) : (
          <p className="text-sm text-muted">Pick one forest, then analyze it.</p>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
      <MapWorkbench
        name={name}
        geometry={geometry}
        busy={busy}
        sentinelTileTemplate={result?.map.sentinelTileTemplate}
        onChange={(next) => {
          setName(next.name);
          setGeometry(next.geometry);
          setResult(null);
        }}
        onAnalyze={() => void run()}
      />
      <div className="space-y-4">
        <ResultsPanel
          result={result}
          busy={busy}
          error={error}
          onList={() => void listCredits()}
          listBusy={listBusy}
          listNote={listNote}
        />
        <CreditExplainer result={result} />
      </div>
      </div>
    </div>
  );
}
