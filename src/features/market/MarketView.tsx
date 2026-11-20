import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listCredits, purchaseCredit } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { PLATFORM_FEE_FRACTION, type CreditListing, type Purchase } from "../../../shared/contract";

const DEFAULT_BUYER = "Northwind Climate Desk";
const FEE_PERCENT = Math.round(PLATFORM_FEE_FRACTION * 100);

export function MarketView() {
  const [listings, setListings] = useState<CreditListing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState(DEFAULT_BUYER);
  const [purchase, setPurchase] = useState<Purchase | null>(null);

  async function refresh() {
    const next = await listCredits();
    setListings(next);
  }

  useEffect(() => {
    refresh().catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : "Could not load listings");
    });
  }, []);

  async function buy(listing: CreditListing, tonnes: number) {
    setError(null);
    try {
      const receipt = await purchaseCredit(listing.id, { buyerName: buyerName.trim(), tco2e: tonnes });
      setPurchase(receipt.purchase);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Purchase failed");
    }
  }

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">Marketplace</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Every tonne here is a buffered annual removal. The platform keeps {FEE_PERCENT}% of the trade. Standing
            stock is not a credit.
          </p>
        </div>
        <label className="block w-full min-w-0 text-sm text-muted sm:w-72">
          Buyer
          <input
            value={buyerName}
            onChange={(event) => setBuyerName(event.target.value)}
            className="mt-1 block w-full max-w-full rounded-full border border-line bg-paper px-3 py-2 text-ink"
          />
        </label>
      </header>

      {error ? <p className="break-words text-sm text-copper">{error}</p> : null}

      {purchase ? <PurchaseConfirmation purchase={purchase} /> : null}

      {listings.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-paper p-6">
          <p className="text-base text-ink">Analyze Humboldt redwoods, then list annual credits.</p>
          <Link
            to="/analyze?preset=redwoods"
            className="mt-4 inline-flex max-w-full items-center justify-center rounded-full bg-canopy px-4 py-2 text-sm font-medium text-white"
          >
            Analyze Humboldt redwoods
          </Link>
        </div>
      ) : (
        <ul className="grid min-w-0 gap-3">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} buyerName={buyerName} onBuy={buy} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PurchaseConfirmation({ purchase }: { purchase: Purchase }) {
  return (
    <section className="min-w-0 rounded-3xl border border-line bg-paper p-4">
      <h2 className="text-lg font-semibold">Purchase confirmed</h2>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label="Buyer" value={purchase.buyerName} />
        <Fact label="Tonnes" value={`${formatTonnes(purchase.tco2e)} t`} />
        <Fact label="Dollars" value={usd(purchase.grossUsd)} />
        <Fact label="Fee" value={usd(purchase.feeUsd)} />
      </dl>
      <p className="mt-3 break-words text-sm">
        Gross {usd(purchase.grossUsd)}. Fee {usd(purchase.feeUsd)}. Project developer receives{" "}
        {usd(purchase.developerProceedsUsd)}.
      </p>
      <Link to="/portfolio" className="mt-3 inline-flex text-sm font-medium text-canopy underline">
        Portfolio
      </Link>
    </section>
  );
}

function ListingCard({
  listing,
  buyerName,
  onBuy,
}: {
  listing: CreditListing;
  buyerName: string;
  onBuy: (listing: CreditListing, tonnes: number) => Promise<void>;
}) {
  const [tonnes, setTonnes] = useState(defaultTonnes(listing.remainingTco2e));
  const [busy, setBusy] = useState(false);
  const soldOut = listing.status === "sold_out" || listing.remainingTco2e <= 0;
  const gross = tonnes * listing.pricePerTonneUsd;
  const fee = gross * PLATFORM_FEE_FRACTION;
  const developerReceives = gross - fee;
  const tonnesReady = Number.isFinite(tonnes) && tonnes > 0 && tonnes <= listing.remainingTco2e + 1e-6;
  const buyerReady = buyerName.trim().length > 0;
  const canBuy = !soldOut && !busy && tonnesReady && buyerReady;

  useEffect(() => {
    if (listing.remainingTco2e <= 0) return;
    setTonnes((current) => Math.min(current, listing.remainingTco2e));
  }, [listing.remainingTco2e]);

  return (
    <li className="min-w-0 rounded-3xl border border-line bg-paper p-4 shadow-card">
      <h2 className="break-words text-2xl font-semibold tracking-tight">{listing.projectName}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-2 min-[480px]:grid-cols-4">
        <Fact label="Confidence" value={listing.confidence} />
        <Fact label="Hectares" value={`${listing.areaHa.toFixed(0)} ha`} />
        <Fact label="Price per tonne" value={`${usd(listing.pricePerTonneUsd)} / t`} />
        <Fact label="Tonnes left" value={`${formatTonnes(listing.remainingTco2e)} t`} />
      </dl>
      <p className="mt-3 break-words text-sm leading-5 text-muted">{listing.methodNote}</p>

      {soldOut ? (
        <Button className="mt-4 w-full py-3 text-base" disabled>
          Sold out
        </Button>
      ) : (
        <>
          <div className="mt-4 min-w-0 rounded-2xl bg-canvas p-3">
            <p className="break-words text-sm font-medium">
              {formatTonnes(tonnes)} t × {usd(listing.pricePerTonneUsd)} / t
            </p>
            <dl className="mt-2 space-y-1 text-sm">
              <MoneyRow label="Gross" value={usd(gross)} />
              <MoneyRow label={`Fee (${FEE_PERCENT}%)`} value={usd(fee)} />
              <MoneyRow label="Project developer receives" value={usd(developerReceives)} />
            </dl>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-0 text-sm text-muted">
              Tonnes
              <input
                type="number"
                min={1}
                step={1}
                value={Number.isFinite(tonnes) ? tonnes : ""}
                onChange={(event) => setTonnes(event.target.value === "" ? Number.NaN : Number(event.target.value))}
                className="mt-1 block w-28 max-w-full rounded-full border border-line bg-paper px-3 py-2 text-ink"
              />
            </label>
          </div>
          {!tonnesReady ? (
            <p className="mt-2 break-words text-sm text-copper">
              {listing.remainingTco2e.toFixed(1)} tCO₂e left on this listing.
            </p>
          ) : null}
          <Button
            className="mt-3 w-full py-3 text-base"
            disabled={!canBuy}
            onClick={() => {
              setBusy(true);
              void onBuy(listing, tonnes).finally(() => setBusy(false));
            }}
          >
            {busy ? "Buying…" : "Buy"}
          </Button>
        </>
      )}
    </li>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </div>
  );
}

function MoneyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function defaultTonnes(remaining: number): number {
  return Math.min(100, Math.max(1, Math.round(remaining)));
}

function formatTonnes(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function usd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
