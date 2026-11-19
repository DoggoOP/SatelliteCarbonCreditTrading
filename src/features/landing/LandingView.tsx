import { Link } from "react-router-dom";
import { PLATFORM_FEE_FRACTION } from "../../../shared/contract";

const tiers = [
  { name: "Scout", price: 49, who: "Landowners checking one property" },
  { name: "Project", price: 149, who: "Developers running a portfolio of stands" },
  { name: "Desk", price: 299, who: "Buyers and validators comparing claims" },
];

export function LandingView() {
  return (
    <div className="space-y-14">
      <section className="grid items-end gap-8 pt-6 md:grid-cols-[1.4fr_0.8fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-canopy">For project developers and credit buyers</p>
          <h1 className="mt-3 max-w-xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            Satellite carbon, checked before anyone gets paid.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            Draw a forest. CarbonSight reads live public satellite data and returns standing carbon, a removal
            forecast, and a confidence score. Listing uses the forecast, never the standing stock.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/analyze?preset=redwoods"
              className="inline-flex items-center justify-center rounded-full bg-canopy px-4 py-2 text-sm font-medium text-white"
            >
              Analyze the redwoods
            </Link>
            <Link
              to="/market"
              className="inline-flex items-center justify-center rounded-full border border-line px-4 py-2 text-sm font-medium"
            >
              See the marketplace
            </Link>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 rounded-3xl border border-line bg-paper p-5 shadow-card">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Field inventory</dt>
            <dd className="mt-1 text-2xl font-semibold">6–18 mo</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Typical cost</dt>
            <dd className="mt-1 text-2xl font-semibold">$20–100k</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">CarbonSight</dt>
            <dd className="mt-1 text-2xl font-semibold">Minutes</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Success fee</dt>
            <dd className="mt-1 text-2xl font-semibold">{Math.round(PLATFORM_FEE_FRACTION * 100)}%</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["01 Draw", "A boundary, a preset forest, or a GeoJSON upload. Area is measured on the globe, not a flat map."],
          ["02 Read", "MODIS greenness, Harmonized Global Biomass, Chloris change, and a recent Sentinel-2 scene."],
          ["03 List", "Only buffered annual removals can be listed. Buyers see the method, the gaps, and the fee."],
        ].map(([title, copy]) => (
          <article key={title} className="rounded-3xl border border-line bg-paper p-5">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
          </article>
        ))}
      </section>

      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Two ways this becomes a business</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {tiers.map((tier) => (
            <article key={tier.name} className="rounded-3xl border border-line bg-paper p-5">
              <p className="text-sm text-muted">{tier.name}</p>
              <p className="mt-2 text-3xl font-semibold">${tier.price}<span className="text-base font-normal text-muted">/mo</span></p>
              <p className="mt-2 text-sm text-muted">{tier.who}</p>
            </article>
          ))}
        </div>
        <p className="mt-4 max-w-3xl text-sm text-muted">
          Subscriptions are the access layer. The {Math.round(PLATFORM_FEE_FRACTION * 100)}% fee applies only when a
          tonne actually trades. Prices on the marketplace are assumptions for the voluntary market, labeled as such.
        </p>
      </section>
    </div>
  );
}
