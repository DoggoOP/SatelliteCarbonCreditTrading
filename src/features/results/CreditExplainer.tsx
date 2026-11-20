import type { AnalysisResult } from "../../../shared/contract";

export function CreditExplainer({ result }: { result: AnalysisResult | null }) {
  const gain = result?.forecast.annualTco2e;
  const stock = result?.stock.carbonStockTco2e;

  return (
    <aside className="rounded-3xl border border-line bg-paper p-5 text-ink">
      <p className="text-[11px] uppercase tracking-[0.18em] text-canopy">In plain language</p>
      <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">What a carbon credit is</h2>
      <div className="mt-4 space-y-4 text-sm leading-6 text-muted">
        <p>
          A credit is a promise that one tonne of CO₂ was taken out of the air and will stay out. A company buys it
          instead of cutting that tonne itself. It is not a deed to the trees.
        </p>
        <p>
          <span className="font-medium text-ink">Already in the forest.</span>{" "}
          {stock == null
            ? "Satellites estimate how much carbon the trunks and branches hold today."
            : `These trees already hold about ${Math.round(stock).toLocaleString()} tonnes. That pile is not for sale. Selling it would count the same carbon twice.`}
        </p>
        <p>
          <span className="font-medium text-ink">What can be sold.</span>{" "}
          {gain == null
            ? "Only new growth, the carbon added since the last check."
            : gain > 0
              ? `This box gained about ${Math.round(gain).toLocaleString()} tonnes in the last measured year. We hold 20% back in case of fire, logging, or a bad reading. The rest can be listed.`
              : `The growth map shows about ${Math.round(gain).toLocaleString()} tonnes for the year. No gain, no credit. The forest can still be healthy. It just did not add carbon we can sell.`}
        </p>
        <p>
          Humboldt redwoods is the demo that lists. The Amazon box is often flat on the coarse growth map, which is why
          it can show a huge stock and zero credits at the same time.
        </p>
      </div>
    </aside>
  );
}
