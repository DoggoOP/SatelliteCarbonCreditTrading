import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import type { AnalysisResult } from "../../../shared/contract";
import { Button } from "../../components/ui/Button";

interface Props {
  result: AnalysisResult | null;
  busy: boolean;
  error: string | null;
  onList: () => void;
  listBusy: boolean;
  listNote: string | null;
}

export function ResultsPanel({ result, busy, error, onList, listBusy, listNote }: Props) {
  if (busy && !result) {
    return (
      <aside className="rounded-3xl border border-line bg-paper p-5 shadow-card">
        <p className="text-sm text-muted">Reading live satellite scenes. This usually takes a few seconds.</p>
      </aside>
    );
  }

  if (!result) {
    return (
      <aside className="rounded-3xl border border-dashed border-line bg-paper p-5">
        <h2 className="text-lg font-semibold">No analysis yet</h2>
        <p className="mt-2 text-sm text-muted">
          Pick a forest and run it. Numbers on this page come from the API. The map does not invent them.
        </p>
      </aside>
    );
  }

  const issuable = result.credits.annualIssuableTco2e;
  const canList = issuable != null && issuable > 0 && result.uncertainty.band !== "insufficient";

  return (
    <aside className="space-y-4 rounded-3xl border border-line bg-paper p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">{result.name}</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">
            {issuable == null ? "—" : formatTonnes(issuable)}
            <span className="ml-2 text-base font-normal text-muted">tCO₂e/yr listable</span>
          </h2>
        </div>
        <Confidence score={result.uncertainty.score} band={result.uncertainty.band} />
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="Area" value={`${result.areaHa.toFixed(0)} ha`} />
        <Stat label="Standing stock" value={result.stock.carbonStockTco2e == null ? "—" : `${formatTonnes(result.stock.carbonStockTco2e)} t`} />
        <Stat label="Biomass" value={result.stock.aboveGroundBiomassMgHa == null ? "—" : `${result.stock.aboveGroundBiomassMgHa.toFixed(0)} Mg/ha`} />
        <Stat label="NDVI" value={result.vegetation.ndviMean == null ? "—" : result.vegetation.ndviMean.toFixed(2)} />
      </dl>

      <div className="rounded-2xl bg-canvas p-3">
        <p className="text-xs uppercase tracking-wide text-muted">Listable credits</p>
        <p className="mt-1 text-2xl font-semibold">
          {issuable == null ? "—" : `${issuable.toFixed(0)} tCO₂e/yr`}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted">{result.credits.disclaimer}</p>
      </div>

      {result.vegetation.timeseries.length > 1 ? (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={result.vegetation.timeseries}>
              <YAxis domain={[0, 1]} width={28} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="ndvi" stroke="#146c43" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs text-muted">One vegetation composite so far. A trend appears after more dates land.</p>
      )}

      {result.warnings.length > 0 ? (
        <ul className="space-y-1 text-sm text-copper">
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <ul className="space-y-2">
        {result.sources.map((source) => (
          <li key={source.id} className="text-sm">
            <span className="font-medium">{source.name}</span>
            <span className="ml-2 text-xs uppercase tracking-wide text-muted">{source.status}</span>
            <p className="text-muted">{source.note}</p>
          </li>
        ))}
      </ul>

      {error ? <p className="text-sm text-copper">{error}</p> : null}
      <Button onClick={onList} disabled={!canList || listBusy}>
        {listBusy ? "Listing…" : "List annual credits"}
      </Button>
      {listNote ? <p className="text-sm text-muted">{listNote}</p> : null}
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Confidence({ score, band }: { score: number; band: string }) {
  return (
    <div className="rounded-2xl border border-line px-3 py-2 text-right">
      <p className="text-xs uppercase tracking-wide text-muted">{band}</p>
      <p className="text-xl font-semibold">{score}</p>
    </div>
  );
}

function formatTonnes(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}
