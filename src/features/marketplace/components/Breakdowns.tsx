import { formatPercent, formatTonnes, formatUsd } from "../money";
import type { Issuance, PurchaseQuote } from "../types";
import { label } from "../styles";

export function IssuanceBreakdown({ issuance }: { issuance: Issuance }) {
  const rows = [
    ["Gross sequestration", formatTonnes(issuance.grossTCO2e)],
    [`Buffer reserve (${formatPercent(issuance.bufferPct)})`, formatTonnes(issuance.bufferTCO2e)],
    ["Bankable credits", formatTonnes(issuance.bankableTCO2e)],
  ] as const;
  return (
    <dl className="space-y-2 text-sm">
      {rows.map(([name, value]) => (
        <div key={name} className="flex items-baseline justify-between gap-4">
          <dt className="text-stone-600">{name}</dt>
          <dd className={`tabular-nums ${name.startsWith("Bankable") ? "font-medium text-stone-950" : "text-stone-800"}`}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function FeeBreakdown({ quote }: { quote: PurchaseQuote }) {
  const rows = [
    ["Volume", formatTonnes(quote.quantityTCO2e)],
    ["Price", `${formatUsd(quote.pricePerTCO2e)} / tCO₂e`],
    ["Buyer pays", formatUsd(quote.buyerPaysUsd)],
    [`Success fee (${formatPercent(quote.successFeePct)})`, formatUsd(quote.successFeeUsd)],
    ["Seller receives", formatUsd(quote.sellerNetUsd)],
  ] as const;
  return (
    <div>
      <p className={label}>This sale</p>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(([name, value]) => (
          <div key={name} className="flex items-baseline justify-between gap-4">
            <dt className="text-stone-600">{name}</dt>
            <dd className="tabular-nums font-medium text-stone-950">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-5 text-stone-500">
        The buyer pays the listed price. CarbonSight retains the success fee from seller proceeds.
      </p>
    </div>
  );
}
