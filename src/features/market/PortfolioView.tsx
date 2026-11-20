import { useEffect, useState } from "react";
import { getPortfolio } from "../../api/client";
import type { PortfolioSnapshot } from "../../../shared/contract";

export function PortfolioView() {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPortfolio()
      .then(setSnapshot)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load portfolio"));
  }, []);

  if (error) return <p className="break-words text-sm text-copper">{error}</p>;
  if (!snapshot) return <p className="text-sm text-muted">Loading portfolio…</p>;

  const cards = [
    ["Listed tonnes", `${formatTonnes(snapshot.totals.listedTco2e)} t`],
    ["Tonnes still for sale", `${formatTonnes(snapshot.totals.remainingTco2e)} t`],
    ["Tonnes purchased", `${formatTonnes(snapshot.totals.purchasedTco2e)} t`],
    ["Fees", usd(snapshot.totals.feeUsd)],
  ];

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
        <p className="mt-1 text-sm text-muted">Listed tonnes, what is still for sale, and what buyers have taken.</p>
      </header>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-3xl border border-line bg-paper p-4">
            <dt className="break-words text-xs uppercase tracking-wide text-muted">{label}</dt>
            <dd className="mt-1 break-words text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="min-w-0 rounded-3xl border border-line bg-paper p-4">
        <h2 className="font-semibold">Purchases</h2>
        {snapshot.purchases.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No purchases yet.</p>
        ) : (
          <ul className="mt-1 divide-y divide-line">
            {snapshot.purchases.map((purchase) => (
              <li key={purchase.id} className="flex flex-wrap gap-x-6 gap-y-2 py-3 text-sm">
                <Cell label="Buyer" value={purchase.buyerName} />
                <Cell label="Project" value={purchase.projectName} />
                <Cell label="Tonnes" value={`${formatTonnes(purchase.tco2e)} t`} />
                <Cell label="Dollars" value={usd(purchase.grossUsd)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0 max-w-full">
      <span className="block text-xs uppercase tracking-wide text-muted">{label}</span>
      <span className="break-words font-medium">{value}</span>
    </span>
  );
}

function formatTonnes(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function usd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
