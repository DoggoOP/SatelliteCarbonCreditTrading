import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalysisResult, TimeSeriesPoint } from "../../../shared/contract";
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
      <aside className="min-w-0 rounded-lg border border-line bg-paper p-5 text-ink shadow-card">
        <p className="text-[11px] uppercase tracking-[0.18em] text-canopy">Reading satellites</p>
        <p className="mt-2 break-words text-sm leading-6 text-muted">
          Reading live satellite scenes. This usually takes a few seconds.
        </p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-canopy" />
        </div>
      </aside>
    );
  }

  if (!result) {
    return (
      <aside className="min-w-0 rounded-lg border border-dashed border-line bg-paper p-5 text-ink">
        <h2 className="font-display text-lg font-semibold">No analysis yet</h2>
        <p className="mt-2 break-words text-sm leading-6 text-muted">
          Pick a forest and run it. Numbers on this page come from the API. The map does not invent them.
        </p>
        {error ? <p className="mt-3 break-words text-sm text-copper">{error}</p> : null}
      </aside>
    );
  }

  const issuable = result.credits.annualIssuableTco2e;
  const canList = issuable != null && issuable > 0 && result.uncertainty.band !== "insufficient";
  const stock = result.stock.carbonStockTco2e;

  return (
    <aside className="min-w-0 rounded-lg border border-line bg-paper text-ink shadow-card">
      <div className="space-y-4 border-b border-line bg-canvas px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="min-w-0 flex-1 break-words text-[11px] uppercase tracking-[0.18em] text-muted">{result.name}</p>
          <Confidence score={result.uncertainty.score} band={result.uncertainty.band} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-copper">
            {issuable != null && issuable > 0 ? "Listable this year" : "Not a credit yet"}
          </p>
          <h2 className="mt-2 break-words font-display text-4xl font-semibold leading-none tracking-tight text-ink min-[480px]:text-5xl">
            {issuable != null && issuable > 0 ? formatTonnes(issuable) : "No sale"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {issuable != null && issuable > 0
              ? "Tonnes of new growth a buyer could purchase, after holding 20% back."
              : "The trees are still there. A credit is only for carbon the forest added. This box did not show a clear gain."}
          </p>
        </div>
        <p className="break-words text-xs leading-5 text-muted">{result.credits.disclaimer}</p>
      </div>

      <div className="space-y-4 p-5">
        {busy ? <p className="text-[11px] uppercase tracking-[0.16em] text-canopy">Updating this stand</p> : null}

        <div className="min-w-0 rounded-lg border border-line px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Standing stock</p>
          <p className="mt-1 break-words text-xl font-semibold tabular-nums tracking-tight text-ink">
            {stock == null ? "—" : formatTonnes(stock)}
            <span className="ml-2 text-sm font-normal text-muted">tCO₂e</span>
          </p>
        </div>

        <dl className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-3">
          <Stat label="Area" value={`${result.areaHa.toFixed(0)} ha`} />
          <Stat
            label="Biomass"
            value={result.stock.aboveGroundBiomassMgHa == null ? "—" : `${result.stock.aboveGroundBiomassMgHa.toFixed(0)} Mg/ha`}
          />
          <Stat label="NDVI" value={result.vegetation.ndviMean == null ? "—" : result.vegetation.ndviMean.toFixed(2)} />
        </dl>

        <section className="min-w-0">
          <h3 className="font-display text-sm font-semibold text-ink">Vegetation</h3>
          <div className="mt-2">
            {result.vegetation.timeseries.length > 1 ? (
              <NdviChart points={result.vegetation.timeseries} />
            ) : (
              <p className="break-words text-xs text-muted">
                One vegetation composite so far. A trend appears after more dates land.
              </p>
            )}
          </div>
        </section>

        {result.warnings.length > 0 ? (
          <ul className="space-y-2">
            {result.warnings.map((warning) => (
              <li key={warning} className="break-words rounded-lg bg-copper/10 px-3 py-2 text-sm leading-5 text-copper">
                {warning}
              </li>
            ))}
          </ul>
        ) : null}

        <section className="min-w-0 space-y-2">
          <h3 className="font-display text-sm font-semibold text-ink">Sources</h3>
          <ul className="space-y-2">
            {result.sources.map((source) => (
              <li key={source.id} className="min-w-0 rounded-lg border border-line px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="min-w-0 break-words font-medium text-ink">{source.name}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusClass(source.status)}`}
                  >
                    {source.status}
                  </span>
                </div>
                <p className="mt-1 break-words text-sm leading-5 text-muted">{source.note}</p>
              </li>
            ))}
          </ul>
        </section>

        {error ? <p className="break-words text-sm text-copper">{error}</p> : null}
        {result.credits.suggestedPriceUsdPerTonne != null ? (
          <p className="break-words text-sm text-muted">
            Suggested {formatUsd(result.credits.suggestedPriceUsdPerTonne)} / tCO₂e
          </p>
        ) : null}
        <Button type="button" onClick={onList} disabled={!canList || listBusy} className="w-full">
          {listBusy ? "Listing…" : "List annual credits"}
        </Button>
        {listNote ? <p className="break-words text-sm text-muted">{listNote}</p> : null}
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-canvas px-3 py-2">
      <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-1 break-words font-medium tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function Confidence({ score, band }: { score: number; band: string }) {
  const tone = confidenceTone(band);
  const clamped = clampScore(score);
  return (
    <div className="ml-auto w-full max-w-[9.5rem] shrink">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${tone.pill}`}>
          {tone.label}
        </span>
        <span className="text-xs tabular-nums text-muted">{Math.round(clamped)}</span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"
        role="meter"
        aria-label={`${tone.label} confidence`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
      >
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function NdviChart({ points }: { points: TimeSeriesPoint[] }) {
  return (
    <div className="h-44 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#E4E1D8" />
          <XAxis
            dataKey="date"
            tickFormatter={formatAxisDate}
            tick={{ fontSize: 11, fill: "#6F6E69" }}
            tickMargin={8}
            axisLine={false}
            tickLine={false}
            minTickGap={20}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 1]}
            width={32}
            tick={{ fontSize: 11, fill: "#6F6E69" }}
            tickFormatter={(value) => Number(value).toFixed(1)}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#FAF9F5",
              border: "1px solid #E4E1D8",
              borderRadius: 8,
              fontSize: 12,
              color: "#141413",
            }}
            labelFormatter={(label) => formatTooltipDate(label)}
            formatter={(value) => [formatNdvi(value), "NDVI"]}
          />
          <Line type="monotone" dataKey="ndvi" stroke="#141413" strokeWidth={1.75} dot={false} activeDot={{ r: 4, fill: "#D97757" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function confidenceTone(band: string): { label: string; pill: string; bar: string } {
  switch (band) {
    case "high":
      return { label: "High", pill: "bg-canopy text-paper", bar: "bg-canopy" };
    case "medium":
      return { label: "Medium", pill: "bg-ink text-paper", bar: "bg-ink" };
    case "low":
      return { label: "Low", pill: "bg-copper text-paper", bar: "bg-copper" };
    case "insufficient":
      return { label: "Insufficient", pill: "bg-muted text-paper", bar: "bg-muted" };
    default:
      return { label: band, pill: "bg-muted text-paper", bar: "bg-muted" };
  }
}

function statusClass(status: string): string {
  if (status === "ok") return "bg-canopy/10 text-canopy";
  if (status === "partial") return "bg-copper/10 text-copper";
  return "bg-line text-muted";
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
}

function formatTonnes(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatNdvi(value: unknown): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toFixed(2);
}

function formatAxisDate(value: unknown): string {
  const date = parseChartDate(value);
  if (!date) return String(value ?? "");
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatTooltipDate(value: unknown): string {
  const date = parseChartDate(value);
  if (!date) return String(value ?? "");
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function parseChartDate(value: unknown): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}
