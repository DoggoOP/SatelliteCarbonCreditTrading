import { useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { FeeBreakdown } from "../components/Breakdowns";
import { ConfidenceBadge, DemoBadge } from "../components/ConfidenceBadge";
import { tierById } from "../constants";
import { useMarketplace, usePendingAction } from "../context";
import { quotePurchase } from "../fees";
import { formatHa, formatPercent, formatTonnes, formatUsd } from "../money";
import { marketplaceBase, marketplaceHref } from "../paths";
import { card, field, label, primaryButton, quietButton } from "../styles";
import type { PurchaseQuote } from "../types";

export function ListingDetailPage() {
  const { listingId = "" } = useParams();
  const { snapshot, status, store } = useMarketplace();
  const { pathname } = useLocation();
  const base = marketplaceBase(pathname);
  const listing = snapshot.listings.find((item) => item.id === listingId);
  const tier = tierById(snapshot.organization.tierId);
  const [quantity, setQuantity] = useState("10");
  const [receipt, setReceipt] = useState<string | null>(null);
  const { error, pending, run } = usePendingAction();

  const quote = useMemo<PurchaseQuote | null>(() => {
    if (!listing) return null;
    try {
      return quotePurchase(Number(quantity), listing.pricePerTCO2e, tier.successFeePct);
    } catch {
      return null;
    }
  }, [listing, quantity, tier.successFeePct]);

  if (status !== "ready") return <p className="text-sm text-stone-500">Loading the book…</p>;
  if (!listing) {
    return (
      <div className={`${card} p-8`}>
        <h1 className="font-serif text-3xl">Listing unavailable</h1>
        <p className="mt-2 text-sm text-stone-600">It is not in this browser’s book.</p>
        <Link to={marketplaceHref(base, "")} className="mt-4 inline-block text-sm text-emerald-900 underline">
          Return to browse
        </Link>
      </div>
    );
  }

  const soldOut = listing.availableTCO2e <= 0;

  async function buy(event: FormEvent) {
    event.preventDefault();
    setReceipt(null);
    const txn = await run(() => store.purchase(listing!.id, Number(quantity)));
    if (txn) {
      setReceipt(
        `Purchased ${formatTonnes(txn.quantityTCO2e)} for ${formatUsd(txn.buyerPaysUsd)}. Success fee ${formatPercent(txn.successFeePct)} (${formatUsd(txn.successFeeUsd)}) stays with CarbonSight; the seller receives ${formatUsd(txn.sellerNetUsd)}.`,
      );
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <article className="space-y-6">
        <div>
          <Link to={marketplaceHref(base, "")} className="text-sm text-stone-500 hover:text-stone-800">
            ← Book
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {listing.demo ? <DemoBadge /> : null}
            <ConfidenceBadge confidence={listing.confidence} />
          </div>
          <h1 className="mt-3 font-serif text-4xl tracking-tight text-[#10241c]">{listing.projectName}</h1>
          <p className="mt-2 text-sm text-stone-600">
            {listing.sellerName} · {listing.region} · Vintage {listing.vintage}
          </p>
        </div>

        <dl className="grid gap-px overflow-hidden rounded-md border border-stone-200 bg-stone-200 sm:grid-cols-3">
          <Metric name="Available" value={formatTonnes(listing.availableTCO2e)} />
          <Metric name="Price" value={formatUsd(listing.pricePerTCO2e)} />
          <Metric name="Area" value={formatHa(listing.areaHa)} />
          <Metric name="Buffer" value={`${formatPercent(listing.bufferPct)} · ${formatTonnes(listing.bufferTCO2e)}`} />
          <Metric name="Standing stock" value={formatTonnes(listing.stockTCO2e, 0)} />
          <Metric name="Uncertainty" value={formatPercent(listing.uncertaintyPct)} />
        </dl>

        <section className={`${card} p-5`}>
          <p className={label}>Issuance rule</p>
          <p className="mt-2 text-sm leading-6 text-stone-700">{listing.rule}</p>
          <p className="mt-3 text-sm text-stone-600">
            Gross sequestration {formatTonnes(listing.grossTCO2e)}. Bankable {formatTonnes(listing.bankableTCO2e)}.
          </p>
        </section>

        <section>
          <p className={label}>Data sources</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {listing.dataSources.map((source) => (
              <li key={source} className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700">
                {source}
              </li>
            ))}
          </ul>
        </section>
      </article>

      <aside className={`${card} h-fit p-5 lg:sticky lg:top-6`}>
        <p className={label}>Buy</p>
        <h2 className="mt-2 font-serif text-2xl">Take delivery</h2>
        <form className="mt-4 space-y-4" onSubmit={buy}>
          <label className="block">
            <span className={label}>Quantity (tCO₂e)</span>
            <input
              className={`${field} mt-2`}
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          <div className="flex gap-2">
            {[10, 100].map((amount) => (
              <button key={amount} type="button" className={quietButton} onClick={() => setQuantity(String(amount))}>
                {amount}
              </button>
            ))}
            <button
              type="button"
              className={quietButton}
              onClick={() => setQuantity(String(listing.availableTCO2e))}
            >
              All
            </button>
          </div>
          {quote ? <FeeBreakdown quote={quote} /> : <p className="text-sm text-stone-500">Enter a quantity above zero.</p>}
          {error ? (
            <p className="text-sm text-rose-800" role="alert">
              {error}
            </p>
          ) : null}
          {receipt ? (
            <p className="text-sm leading-6 text-emerald-950" role="status">
              {receipt}{" "}
              <Link to={marketplaceHref(base, "portfolio")} className="underline">
                Open the portfolio
              </Link>
              .
            </p>
          ) : null}
          <button className={`${primaryButton} w-full`} type="submit" disabled={soldOut || pending || !quote}>
            {soldOut ? "Sold out" : pending ? "Buying…" : "Buy credits"}
          </button>
          <p className="text-xs leading-5 text-stone-500">
            {tier.name} success fee is {tier.successFeePct}%.
            {tier.monthlyPurchaseCapTCO2e != null
              ? ` Purchases are capped at ${formatTonnes(tier.monthlyPurchaseCapTCO2e, 0)} per calendar month.`
              : " This plan has no monthly purchase cap."}
          </p>
        </form>
      </aside>
    </div>
  );
}

function Metric({ name, value }: { name: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <dt className={label}>{name}</dt>
      <dd className="mt-1 text-sm font-medium tabular-nums text-stone-900">{value}</dd>
    </div>
  );
}
