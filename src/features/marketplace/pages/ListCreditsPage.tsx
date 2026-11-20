import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { IssuanceBreakdown } from "../components/Breakdowns";
import { tierById } from "../constants";
import { useMarketplace, usePendingAction } from "../context";
import { issueCredits } from "../creditMath";
import { isMarketplaceError } from "../errors";
import { inferRegion } from "../region";
import { SAMPLE_ANALYSIS } from "../catalog";
import { marketplaceBase, marketplaceHref } from "../paths";
import { card, field, label, primaryButton, quietButton } from "../styles";
import type { AnalysisResult, Confidence } from "../types";

interface FormState {
  projectName: string;
  areaHa: string;
  stock: string;
  annual: string;
  confidence: Confidence;
  uncertainty: string;
  sources: string;
  polygon: string;
  price: string;
  vintage: string;
  region: string;
  seller: string;
}

function formFromAnalysis(analysis: AnalysisResult, seller: string): FormState {
  return {
    projectName: analysis.projectName,
    areaHa: String(analysis.areaHa),
    stock: String(analysis.tCO2e),
    annual: String(analysis.annualSequestrationTCO2e),
    confidence: analysis.confidence,
    uncertainty: String(analysis.uncertaintyPct),
    sources: analysis.dataSources.join(", "),
    polygon: JSON.stringify(analysis.polygon, null, 2),
    price: "40",
    vintage: String(new Date().getFullYear()),
    region: "",
    seller,
  };
}

export function ListCreditsPage({ initialAnalysis }: { initialAnalysis?: AnalysisResult }) {
  const { snapshot, status, store } = useMarketplace();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const base = marketplaceBase(pathname);
  const { error, pending, run } = usePendingAction();
  const [polygonError, setPolygonError] = useState<string | null>(null);
  const [sourceNote, setSourceNote] = useState(initialAnalysis ? "Passed in from the analysis app." : "Sample analysis — not a live satellite pull.");
  const [form, setForm] = useState<FormState>(() =>
    formFromAnalysis(initialAnalysis ?? SAMPLE_ANALYSIS, snapshot.organization.name),
  );

  useEffect(() => {
    if (!initialAnalysis) return;
    setForm(formFromAnalysis(initialAnalysis, snapshot.organization.name));
    setSourceNote("Passed in from the analysis app.");
  }, [initialAnalysis, snapshot.organization.name]);

  const tier = tierById(snapshot.organization.tierId);
  const preview = useMemo(() => {
    const annual = Number(form.annual);
    if (!Number.isFinite(annual)) return { issuance: null, error: "Enter annual sequestration in tonnes." };
    try {
      return { issuance: issueCredits(annual, form.confidence), error: null };
    } catch (caught) {
      return { issuance: null, error: isMarketplaceError(caught) ? caught.message : "Cannot preview issuance." };
    }
  }, [form.annual, form.confidence]);

  const inferred = useMemo(() => {
    try {
      return inferRegion(JSON.parse(form.polygon) as AnalysisResult["polygon"]);
    } catch {
      return "Unspecified region";
    }
  }, [form.polygon]);

  if (status !== "ready") return <p className="text-sm text-stone-500">Loading the book…</p>;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPolygonError(null);
    let polygon: AnalysisResult["polygon"];
    try {
      polygon = JSON.parse(form.polygon) as AnalysisResult["polygon"];
    } catch {
      setPolygonError("Polygon is not valid JSON.");
      return;
    }
    const listing = await run(() =>
      store.publish(
        {
          projectName: form.projectName,
          polygon,
          areaHa: Number(form.areaHa),
          tCO2e: Number(form.stock),
          annualSequestrationTCO2e: Number(form.annual),
          confidence: form.confidence,
          uncertaintyPct: Number(form.uncertainty),
          dataSources: form.sources.split(",").map((source) => source.trim()).filter(Boolean),
        },
        {
          pricePerTCO2e: Number(form.price),
          vintage: Number(form.vintage),
          sellerName: form.seller,
          region: form.region.trim() || undefined,
        },
      ),
    );
    if (listing) navigate(marketplaceHref(base, `listing/${listing.id}`));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <p className={label}>Issuance</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight text-[#10241c]">List a vintage</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">
            {sourceNote} Publishing withholds the buffer, then places the bankable vintage on the book.
          </p>
        </div>

        {!tier.canList ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            {tier.name} can browse and buy. Listing a project requires Growth ({"$"}149/mo) or Enterprise.
            Change the desk plan in the portfolio. This preview still shows the buffer math.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={quietButton}
            onClick={() => {
              setForm(formFromAnalysis(SAMPLE_ANALYSIS, snapshot.organization.name));
              setSourceNote("Sample analysis — not a live satellite pull.");
            }}
          >
            Load sample analysis
          </button>
        </div>

        <div className={`${card} grid gap-4 p-5 md:grid-cols-2`}>
          <label className="block md:col-span-2">
            <span className={label}>Project</span>
            <input className={`${field} mt-2`} value={form.projectName} onChange={(event) => update("projectName", event.target.value)} required />
          </label>
          <label className="block">
            <span className={label}>Area (ha)</span>
            <input className={`${field} mt-2`} inputMode="decimal" value={form.areaHa} onChange={(event) => update("areaHa", event.target.value)} required />
          </label>
          <label className="block">
            <span className={label}>Standing stock (tCO₂e)</span>
            <input className={`${field} mt-2`} inputMode="decimal" value={form.stock} onChange={(event) => update("stock", event.target.value)} required />
          </label>
          <label className="block">
            <span className={label}>Annual sequestration</span>
            <input className={`${field} mt-2`} inputMode="decimal" value={form.annual} onChange={(event) => update("annual", event.target.value)} required />
          </label>
          <label className="block">
            <span className={label}>Confidence</span>
            <select className={`${field} mt-2`} value={form.confidence} onChange={(event) => update("confidence", event.target.value as Confidence)}>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </label>
          <label className="block">
            <span className={label}>Uncertainty %</span>
            <input className={`${field} mt-2`} inputMode="decimal" value={form.uncertainty} onChange={(event) => update("uncertainty", event.target.value)} required />
          </label>
          <label className="block md:col-span-2">
            <span className={label}>Data sources</span>
            <input className={`${field} mt-2`} value={form.sources} onChange={(event) => update("sources", event.target.value)} required />
          </label>
          <label className="block md:col-span-2">
            <span className={label}>Polygon GeoJSON</span>
            <textarea className={`${field} mt-2 min-h-36 font-mono text-xs`} value={form.polygon} onChange={(event) => update("polygon", event.target.value)} required />
          </label>
        </div>

        <div className={`${card} grid gap-4 p-5 md:grid-cols-2`}>
          <label className="block">
            <span className={label}>Price per tCO₂e (USD)</span>
            <input className={`${field} mt-2`} inputMode="decimal" value={form.price} onChange={(event) => update("price", event.target.value)} required />
          </label>
          <label className="block">
            <span className={label}>Vintage</span>
            <input className={`${field} mt-2`} inputMode="numeric" value={form.vintage} onChange={(event) => update("vintage", event.target.value)} required />
          </label>
          <label className="block">
            <span className={label}>Seller</span>
            <input className={`${field} mt-2`} value={form.seller} onChange={(event) => update("seller", event.target.value)} required />
          </label>
          <label className="block">
            <span className={label}>Region override</span>
            <input
              className={`${field} mt-2`}
              placeholder={inferred}
              value={form.region}
              onChange={(event) => update("region", event.target.value)}
            />
          </label>
        </div>

        {polygonError || error ? (
          <p className="text-sm text-rose-800" role="alert">
            {polygonError || error}
          </p>
        ) : null}

        <button className={primaryButton} type="submit" disabled={!tier.canList || pending}>
          {pending ? "Publishing…" : tier.canList ? "Publish listing" : "Listing locked on this plan"}
        </button>
      </form>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <section className={`${card} p-5`}>
          <p className={label}>Buffer pool</p>
          <h2 className="mt-2 font-serif text-2xl">What can be sold</h2>
          <p className="mt-3 text-xs leading-5 text-stone-500">
            Bankable credits equal annual sequestration minus a confidence-scaled buffer. High 10%, Medium 20%, Low 30%.
            Standing stock is disclosed and is not issued.
          </p>
          <div className="mt-4">
            {preview.issuance ? <IssuanceBreakdown issuance={preview.issuance} /> : null}
            {preview.error ? <p className="text-sm text-rose-800">{preview.error}</p> : null}
          </div>
        </section>
        <p className="text-xs leading-5 text-stone-500">
          Region from the polygon: {form.region.trim() || inferred}. The success fee ({tier.successFeePct}% on {tier.name}) is charged when a buyer takes the vintage, not when it is issued.
        </p>
        <Link to={marketplaceHref(base, "")} className="text-sm text-emerald-900 underline-offset-2 hover:underline">
          Back to the book
        </Link>
      </aside>
    </div>
  );
}
