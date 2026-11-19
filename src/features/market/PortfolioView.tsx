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

  if (error) return <p className="text-sm text-copper">{error}</p>;
  if (!snapshot) return <p className="text-sm text-muted">Loading portfolio…</p>;

  const cards = [
    ["Listed", `${snapshot.totals.listedTco2e.toFixed(0)} t`],
    ["Still for sale", `${snapshot.totals.remainingTco2e.toFixed(0)} t`],
    ["Purchased", `${snapshot.totals.purchasedTco2e.toFixed(0)} t`],
    ["Fees earned", `$${snapshot.totals.feeUsd.toFixed(0)}`],
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
        <p className="mt-1 text-sm text-muted">Listings you issued and tonnes a buyer has taken.</p>
      </header>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-3xl border border-line bg-paper p-4">
            <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="rounded-3xl border border-line bg-paper p-4">
        <h2 className="font-semibold">Purchases</h2>
        {snapshot.purchases.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No purchases yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {snapshot.purchases.map((purchase) => (
              <li key={purchase.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span>
                  {purchase.buyerName} · {purchase.projectName}
                </span>
                <span>
                  {purchase.tco2e.toFixed(1)} t · ${purchase.grossUsd.toFixed(0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
