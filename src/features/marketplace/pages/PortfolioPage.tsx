import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { ConfidenceBadge } from "../components/ConfidenceBadge";
import { SUBSCRIPTION_TIERS, tierById } from "../constants";
import { useMarketplace, usePendingAction } from "../context";
import { formatDate, formatTonnes, formatUsd } from "../money";
import { marketplaceBase, marketplaceHref } from "../paths";
import { card, field, label, primaryButton, quietButton } from "../styles";
import type { Holding, LedgerTransaction } from "../types";

export function PortfolioPage() {
  const { snapshot, status, store } = useMarketplace();
  const { pathname } = useLocation();
  const base = marketplaceBase(pathname);
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (status !== "ready") return <p className="text-sm text-stone-500">Loading the book…</p>;

  const held = snapshot.holdings.reduce((sum, holding) => sum + holding.quantityTCO2e, 0);
  const retired = snapshot.holdings.reduce((sum, holding) => sum + holding.retiredTCO2e, 0);
  const spent = snapshot.transactions
    .filter((txn) => txn.kind === "purchase")
    .reduce((sum, txn) => sum + txn.buyerPaysUsd, 0);
  const fees = snapshot.transactions.reduce((sum, txn) => sum + txn.successFeeUsd, 0);
  const tier = tierById(snapshot.organization.tierId);
  const active = snapshot.holdings.filter((holding) => holding.quantityTCO2e > 0);
  const closed = snapshot.holdings.filter((holding) => holding.quantityTCO2e <= 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={label}>Desk</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight text-[#10241c]">Portfolio</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">
            Holdings, retirements, and the success fee on every transaction. This book is stored in the browser until a backend replaces the repository.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={quietButton} onClick={() => void store.restoreDemoListings()}>
            Restore demo listings
          </button>
          <button
            type="button"
            className={quietButton}
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                return;
              }
              setConfirmReset(false);
              void store.resetDemo();
            }}
          >
            {confirmReset ? "Confirm reset" : "Reset browser data"}
          </button>
        </div>
      </div>

      <dl className="grid gap-px overflow-hidden rounded-md border border-stone-200 bg-stone-200 sm:grid-cols-4">
        <Tile name="Held" value={formatTonnes(held)} />
        <Tile name="Retired" value={formatTonnes(retired)} />
        <Tile name="Spent" value={formatUsd(spent)} />
        <Tile name="Fees paid" value={formatUsd(fees)} />
      </dl>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-2xl">Plan</h2>
          <p className="text-xs text-stone-500">Demo switch — billing is not connected.</p>
        </div>
        <ul className="mt-4 grid gap-3 lg:grid-cols-3">
          {SUBSCRIPTION_TIERS.map((plan) => {
            const current = plan.id === tier.id;
            return (
              <li key={plan.id} className={`${card} flex flex-col p-5 ${current ? "border-[#10241c]" : ""}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-serif text-2xl">{plan.name}</h3>
                  <p className="tabular-nums text-sm">{formatUsd(plan.monthlyUsd)}/mo</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-600">{plan.summary}</p>
                <ul className="mt-4 space-y-1 text-sm text-stone-700">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`${current ? quietButton : primaryButton} mt-5`}
                  disabled={current}
                  onClick={() => void store.setTier(plan.id)}
                >
                  {current ? "Current plan" : `Use ${plan.name}`}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Holdings</h2>
        {notice ? (
          <p className="text-sm text-emerald-950" role="status">
            {notice}
          </p>
        ) : null}
        {active.length === 0 ? (
          <p className={`${card} p-6 text-sm text-stone-600`}>
            No tonnes on the desk.{" "}
            <Link to={marketplaceHref(base, "")} className="text-emerald-900 underline">
              Browse the book
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-3">
            {active.map((holding) => (
              <HoldingRow
                key={holding.id}
                holding={holding}
                canRetire={tier.canRetire}
                tierName={tier.name}
                onNotice={setNotice}
              />
            ))}
          </ul>
        )}
        {closed.length > 0 ? (
          <div className="pt-2">
            <p className={label}>Fully retired</p>
            <ul className="mt-2 space-y-2">
              {closed.map((holding) => (
                <li key={holding.id} className="text-sm text-stone-600">
                  {holding.projectName} · vintage {holding.vintage} · {formatTonnes(holding.retiredTCO2e)} retired
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="font-serif text-2xl">Transactions</h2>
        {snapshot.transactions.length === 0 ? (
          <p className={`${card} mt-3 p-6 text-sm text-stone-600`}>No transactions yet.</p>
        ) : (
          <ol className="mt-3 divide-y divide-stone-200 overflow-hidden rounded-md border border-stone-200 bg-white">
            {snapshot.transactions.map((txn) => (
              <TransactionRow key={txn.id} txn={txn} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Tile({ name, value }: { name: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <dt className={label}>{name}</dt>
      <dd className="mt-1 font-serif text-2xl tabular-nums text-[#10241c]">{value}</dd>
    </div>
  );
}

function HoldingRow({
  holding,
  canRetire,
  tierName,
  onNotice,
}: {
  holding: Holding;
  canRetire: boolean;
  tierName: string;
  onNotice: (message: string) => void;
}) {
  const { store } = useMarketplace();
  const [quantity, setQuantity] = useState(String(holding.quantityTCO2e));
  const [beneficiary, setBeneficiary] = useState("Corporate claim");
  const [note, setNote] = useState<string | null>(null);
  const { error, pending, run } = usePendingAction();

  async function onRetire(event: FormEvent) {
    event.preventDefault();
    const txn = await run(() => store.retire(holding.id, Number(quantity), beneficiary));
    if (txn) {
      const message = `Retired ${formatTonnes(txn.quantityTCO2e)} against ${txn.counterparty}. Success fee ${formatUsd(txn.successFeeUsd)}.`;
      setNote(message);
      onNotice(message);
    }
  }

  return (
    <li className={`${card} grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_280px]`}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <ConfidenceBadge confidence={holding.confidence} />
          <span className="text-xs text-stone-500">Vintage {holding.vintage}</span>
        </div>
        <h3 className="mt-2 font-serif text-2xl">{holding.projectName}</h3>
        <p className="mt-1 text-sm text-stone-600">
          {holding.region} · bought {formatDate(holding.acquiredAt)} at {formatUsd(holding.pricePerTCO2e)}
        </p>
        <p className="mt-3 text-sm">
          <span className="font-medium tabular-nums">{formatTonnes(holding.quantityTCO2e)}</span> held
          {holding.retiredTCO2e > 0 ? ` · ${formatTonnes(holding.retiredTCO2e)} retired` : ""}
        </p>
      </div>
      <form className="space-y-2" onSubmit={onRetire}>
        <label className="block">
          <span className={label}>Retire</span>
          <input className={`${field} mt-1`} inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        </label>
        <label className="block">
          <span className={label}>Beneficiary</span>
          <input className={`${field} mt-1`} value={beneficiary} onChange={(event) => setBeneficiary(event.target.value)} />
        </label>
        <button className={`${primaryButton} w-full`} type="submit" disabled={!canRetire || pending}>
          {canRetire ? (pending ? "Retiring…" : "Retire credits") : `Retirement needs Growth`}
        </button>
        {!canRetire ? <p className="text-xs text-stone-500">{tierName} keeps a record of purchases. Retirement starts on Growth.</p> : null}
        {error ? <p className="text-xs text-rose-800">{error}</p> : null}
        {note ? <p className="text-xs text-emerald-900">{note}</p> : null}
      </form>
    </li>
  );
}

function TransactionRow({ txn }: { txn: LedgerTransaction }) {
  const title =
    txn.kind === "purchase" ? "Purchase" : txn.kind === "retirement" ? "Retirement" : "Issuance";
  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          {title} · {txn.projectName}
        </p>
        <p className="tabular-nums text-stone-700">{formatTonnes(txn.quantityTCO2e)}</p>
      </div>
      <p className="mt-1 text-xs text-stone-500">
        {formatDate(txn.at)} · {txn.counterparty}
      </p>
      <p className="mt-2 text-stone-700">
        Subtotal {formatUsd(txn.subtotalUsd)} · Success fee {txn.successFeePct}% ({formatUsd(txn.successFeeUsd)}) · Seller net{" "}
        {formatUsd(txn.sellerNetUsd)} · Buyer pays {formatUsd(txn.buyerPaysUsd)}
      </p>
      <p className="mt-1 text-xs leading-5 text-stone-500">{txn.note}</p>
    </li>
  );
}
