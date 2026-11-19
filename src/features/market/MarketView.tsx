import { useEffect, useState } from "react";
import { listCredits, purchaseCredit } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { PLATFORM_FEE_FRACTION, type CreditListing } from "../../../shared/contract";

export function MarketView() {
  const [listings, setListings] = useState<CreditListing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState("Northwind Climate Desk");
  const [notice, setNotice] = useState<string | null>(null);

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
    setNotice(null);
    setError(null);
    try {
      const receipt = await purchaseCredit(listing.id, { buyerName, tco2e: tonnes });
      setNotice(
        `${receipt.purchase.buyerName} bought ${receipt.purchase.tco2e.toFixed(1)} t. Fee $${receipt.purchase.feeUsd.toFixed(0)}. Developer receives $${receipt.purchase.developerProceedsUsd.toFixed(0)}.`,
      );
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Purchase failed");
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Marketplace</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Every tonne here is a buffered annual removal from a satellite analysis. The platform keeps{" "}
            {Math.round(PLATFORM_FEE_FRACTION * 100)}% of the trade. Nothing here is a registry issuance.
          </p>
        </div>
        <label className="text-sm text-muted">
          Buyer
          <input
            value={buyerName}
            onChange={(event) => setBuyerName(event.target.value)}
            className="mt-1 block rounded-full border border-line bg-paper px-3 py-2 text-ink"
          />
        </label>
      </header>
      {error ? <p className="text-sm text-copper">{error}</p> : null}
      {notice ? <p className="text-sm text-canopy">{notice}</p> : null}
      {listings.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-paper p-6 text-sm text-muted">
          No listings yet. Analyze a forest and list its annual removals.
        </p>
      ) : (
        <ul className="grid gap-3">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} onBuy={buy} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ListingCard({
  listing,
  onBuy,
}: {
  listing: CreditListing;
  onBuy: (listing: CreditListing, tonnes: number) => Promise<void>;
}) {
  const [tonnes, setTonnes] = useState(Math.min(100, Math.max(1, Math.round(listing.remainingTco2e))));
  const [busy, setBusy] = useState(false);
  const gross = tonnes * listing.pricePerTonneUsd;

  return (
    <li className="rounded-3xl border border-line bg-paper p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{listing.projectName}</h2>
          <p className="text-sm text-muted">
            {listing.vintageYear} · {listing.confidence} confidence · {listing.areaHa.toFixed(0)} ha
          </p>
        </div>
        <p className="text-right">
          <span className="text-2xl font-semibold">${listing.pricePerTonneUsd}</span>
          <span className="text-sm text-muted"> / t</span>
        </p>
      </div>
      <p className="mt-2 text-sm text-muted">{listing.methodNote}</p>
      <p className="mt-2 text-sm">
        {listing.remainingTco2e.toFixed(1)} of {listing.annualTco2e.toFixed(1)} tCO₂e still available
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={1}
          step={1}
          value={tonnes}
          onChange={(event) => setTonnes(Number(event.target.value))}
          className="w-28 rounded-full border border-line px-3 py-2"
          disabled={listing.status === "sold_out"}
        />
        <Button
          disabled={busy || listing.status === "sold_out"}
          onClick={() => {
            setBusy(true);
            void onBuy(listing, tonnes).finally(() => setBusy(false));
          }}
        >
          {listing.status === "sold_out" ? "Sold out" : busy ? "Buying…" : `Buy · $${gross.toFixed(0)}`}
        </Button>
      </div>
    </li>
  );
}
