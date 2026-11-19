import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { analyzeArea, createListing } from "../api/client";
import { MapWorkbench } from "../features/map/MapWorkbench";
import { ResultsPanel } from "../features/results/ResultsPanel";
import type { AnalysisResult, Polygon } from "../../shared/contract";
import { presetById } from "../../shared/presets";

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

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
      <MapWorkbench
        name={name}
        geometry={geometry}
        busy={busy}
        onChange={(next) => {
          setName(next.name);
          setGeometry(next.geometry);
          setResult(null);
        }}
        onAnalyze={() => void run()}
      />
      <ResultsPanel
        result={result}
        busy={busy}
        error={error}
        onList={() => void listCredits()}
        listBusy={listBusy}
        listNote={listNote}
      />
    </div>
  );
}
