import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ConfidenceBadge, DemoBadge } from "../components/ConfidenceBadge";
import { useMarketplace } from "../context";
import { applyListingFilters, regionsIn, EMPTY_FILTERS } from "../filters";
import { formatHa, formatTonnes, formatUsd } from "../money";
import { marketplaceBase, marketplaceHref } from "../paths";
import { card, field, label, quietButton } from "../styles";
import type { Confidence, CreditListing, ListingFilters } from "../types";

const BANDS: readonly Confidence[] = ["High", "Medium", "Low"];

export function BrowsePage() {
  const { snapshot, status } = useMarketplace();
  const { pathname } = useLocation();
  const base = marketplaceBase(pathname);
  const [filters, setFilters] = useState<ListingFilters>(EMPTY_FILTERS);

  const regions = useMemo(() => regionsIn(snapshot.listings), [snapshot.listings]);
  const visible = useMemo(
    () =>
      applyListingFilters(snapshot.listings, filters).sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt) || a.projectName.localeCompare(b.projectName),
      ),
    [snapshot.listings, filters],
  );

  if (status !== "ready") return <p className="text-sm text-stone-500">Loading the book…</p>;

  const available = snapshot.listings.reduce((sum, listing) => sum + listing.availableTCO2e, 0);
  const notional = snapshot.listings.reduce(
    (sum, listing) => sum + listing.availableTCO2e * listing.pricePerTCO2e,
    0,
  );
  const average = available > 0 ? notional / available : 0;

  function toggleConfidence(confidence: Confidence) {
    setFilters((current) => {
      const has = current.confidences.includes(confidence);
      return {
        ...current,
        confidences: has
          ? current.confidences.filter((item) => item !== confidence)
          : [...current.confidences, confidence],
      };
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          <p className={label}>Secondary book</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight text-[#10241c]">Credits from forest analysis</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Each listing is a vintage of bankable tonnes: annual sequestration minus the confidence buffer.
            Demo listings are marked and live only in this browser.
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-stone-200 bg-stone-200 text-sm">
          <Stat label="Available" value={formatTonnes(available, 0)} />
          <Stat label="Avg. price" value={formatUsd(average)} />
          <Stat label="Projects" value={String(snapshot.listings.length)} />
        </dl>
      </div>

      <form className={`${card} grid gap-4 p-4 md:grid-cols-[1.4fr_1fr_0.7fr_0.7fr_auto] md:items-end`}>
        <fieldset>
          <legend className={label}>Confidence</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {BANDS.map((confidence) => {
              const active = filters.confidences.includes(confidence);
              return (
                <button
                  key={confidence}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleConfidence(confidence)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    active
                      ? "border-[#10241c] bg-[#10241c] text-white"
                      : "border-stone-300 bg-white text-stone-700"
                  }`}
                >
                  {confidence}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className="block">
          <span className={label}>Region</span>
          <select
            className={`${field} mt-2`}
            value={filters.region ?? ""}
            onChange={(event) =>
              setFilters((current) => ({ ...current, region: event.target.value || null }))
            }
          >
            <option value="">All regions</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>Min price</span>
          <input
            className={`${field} mt-2`}
            inputMode="decimal"
            value={filters.minPrice ?? ""}
            placeholder="0"
            onChange={(event) =>
              setFilters((current) => ({ ...current, minPrice: parseOptional(event.target.value) }))
            }
          />
        </label>
        <label className="block">
          <span className={label}>Max price</span>
          <input
            className={`${field} mt-2`}
            inputMode="decimal"
            value={filters.maxPrice ?? ""}
            placeholder="Any"
            onChange={(event) =>
              setFilters((current) => ({ ...current, maxPrice: parseOptional(event.target.value) }))
            }
          />
        </label>
        <button type="button" className={quietButton} onClick={() => setFilters(EMPTY_FILTERS)}>
          Reset
        </button>
      </form>

      {visible.length === 0 ? (
        <p className={`${card} p-8 text-sm text-stone-600`}>No listings match these filters.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((listing) => (
            <li key={listing.id}>
              <ListingCard listing={listing} href={marketplaceHref(base, `listing/${listing.id}`)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label: name, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <dt className={label}>{name}</dt>
      <dd className="mt-1 font-serif text-xl tabular-nums text-[#10241c]">{value}</dd>
    </div>
  );
}

function ListingCard({ listing, href }: { listing: CreditListing; href: string }) {
  const soldOut = listing.availableTCO2e <= 0;
  return (
    <Link to={href} className={`${card} flex h-full flex-col p-5 transition hover:border-stone-400`}>
      <div className="flex flex-wrap items-center gap-2">
        {listing.demo ? <DemoBadge /> : null}
        <ConfidenceBadge confidence={listing.confidence} />
        {soldOut ? <span className="text-xs font-medium text-stone-500">Sold out</span> : null}
      </div>
      <h2 className="mt-4 font-serif text-2xl leading-tight tracking-tight">{listing.projectName}</h2>
      <p className="mt-2 text-sm text-stone-600">
        {listing.region} · Vintage {listing.vintage}
      </p>
      <p className="mt-1 text-sm text-stone-500">{listing.sellerName}</p>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={label}>Price</p>
          <p className="mt-1 font-serif text-2xl tabular-nums">{formatUsd(listing.pricePerTCO2e)}</p>
          <p className="text-xs text-stone-500">per tCO₂e</p>
        </div>
        <div className="text-right">
          <p className={label}>Available</p>
          <p className="mt-1 text-sm font-medium tabular-nums">{formatTonnes(listing.availableTCO2e)}</p>
          <p className="text-xs text-stone-500">{formatHa(listing.areaHa)} · ±{listing.uncertaintyPct}%</p>
        </div>
      </div>
    </Link>
  );
}

function parseOptional(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
