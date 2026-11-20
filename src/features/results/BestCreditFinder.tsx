import { useEffect, useRef, useState } from "react";
import { analyzeArea } from "../../api/client";
import type { AnalysisResult } from "../../../shared/contract";
import { PRESETS, type ForestPreset } from "../../../shared/presets";

interface Row {
  preset: ForestPreset;
  result: AnalysisResult | null;
  error: string | null;
}

export function BestCreditFinder({
  onChoose,
}: {
  onChoose: (preset: ForestPreset, result: AnalysisResult) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [scanning, setScanning] = useState(true);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void scan();
  }, []);

  async function scan() {
    setScanning(true);
    const next = await Promise.all(
      PRESETS.map(async (preset) => {
        try {
          const result = await analyzeArea({ name: preset.name, geometry: preset.geometry });
          return { preset, result, error: null };
        } catch (caught) {
          return {
            preset,
            result: null,
            error: caught instanceof Error ? caught.message : "Scan failed",
          };
        }
      }),
    );
    next.sort((a, b) => score(b) - score(a));
    setRows(next);
    setScanning(false);
    const best = next.find((row) => (row.result?.credits.annualIssuableTco2e ?? 0) > 0);
    if (best?.result) onChoose(best.preset, best.result);
  }

  const winner = rows.find((row) => (row.result?.credits.annualIssuableTco2e ?? 0) > 0);

  return (
    <section className="rounded-3xl border border-line bg-paper p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-canopy">Where to buy</p>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Best credit right now</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            A buyer does not get the land or the trees. They buy the tonnes of CO₂ that forest removed this year, and retire them against their own emissions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void scan()}
          disabled={scanning}
          className="rounded-full bg-canopy px-4 py-2 text-sm font-medium text-paper disabled:bg-muted"
        >
          {scanning ? "Checking forests…" : "Check again"}
        </button>
      </div>
      {scanning && rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Comparing Humboldt, the Amazon, and the Sierra on live satellite data.</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {rows.map((row, index) => {
            const tonnes = row.result?.credits.annualIssuableTco2e ?? null;
            const buyable = tonnes != null && tonnes > 0;
            const isWinner = winner?.preset.id === row.preset.id;
            return (
              <li key={row.preset.id}>
                <button
                  type="button"
                  disabled={!row.result}
                  onClick={() => row.result && onChoose(row.preset, row.result)}
                  className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-3 text-left ${
                    isWinner ? "border-canopy bg-canvas" : "border-line"
                  }`}
                >
                  <span>
                    <span className="font-medium">{index === 0 && buyable ? "Buy this. " : ""}{row.preset.name}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {row.error
                        ? row.error
                        : buyable
                          ? `${row.result?.uncertainty.band} confidence. Enough measured growth to list.`
                          : "No measured growth, so there is nothing to buy here."}
                    </span>
                  </span>
                  <span className="text-sm font-semibold">
                    {buyable ? `${Math.round(tonnes).toLocaleString()} t/yr` : "Skip"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function score(row: Row): number {
  const tonnes = row.result?.credits.annualIssuableTco2e ?? 0;
  const confidence = row.result?.uncertainty.score ?? 0;
  return tonnes * 1000 + confidence;
}
