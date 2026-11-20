import { Link } from "react-router-dom";
import { PLATFORM_FEE_FRACTION } from "../../../shared/contract";

const successFee = Math.round(PLATFORM_FEE_FRACTION * 100);

const steps = [
  {
    n: "01",
    title: "Draw",
    body: "A boundary, a preset forest, or GeoJSON. Area is measured on the globe, not a flat map.",
  },
  {
    n: "02",
    title: "Read satellites",
    body: "MODIS greenness, Harmonized Global Biomass, Chloris change, and a recent Sentinel-2 scene.",
  },
  {
    n: "03",
    title: "List buffered removals",
    body: "Only the annual removal after the non-permanence buffer can be listed. Standing stock stays inventory.",
  },
];

const tiers = [
  { name: "Scout", price: 49, who: "Landowners checking one property" },
  { name: "Project", price: 149, who: "Developers running a portfolio of stands" },
  { name: "Desk", price: 299, who: "Buyers and validators comparing claims" },
];

export function LandingView() {
  return (
    <div className="mx-auto flex min-w-0 max-w-5xl flex-col gap-12">
      <section className="grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(15rem,0.72fr)]">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">For developers and credit buyers</p>
          <h1 className="mt-3 max-w-xl font-display text-[2.35rem] font-medium leading-[1.05] tracking-tight text-ink sm:text-5xl">
            Satellite carbon, checked before anyone gets paid.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted">
            Draw a forest. CarbonSight reads live public satellite data and returns standing carbon, a removal
            forecast, and a confidence score. The listing is the buffered annual removal, never the standing stock.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/analyze?preset=redwoods"
              className="inline-flex max-w-full items-center justify-center rounded-lg bg-copper px-4 py-2.5 text-sm font-medium text-paper"
            >
              Analyze the redwoods
            </Link>
            <Link
              to="/market"
              className="inline-flex max-w-full items-center justify-center rounded-lg border border-line bg-paper px-4 py-2.5 text-sm font-medium text-ink"
            >
              See the marketplace
            </Link>
          </div>
        </div>

        <dl className="min-w-0 rounded-lg border border-line bg-paper">
          <div className="border-b border-line px-5 py-4">
            <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">Field inventory</dt>
            <dd className="mt-2 font-display text-[1.55rem] leading-tight text-ink">
              6–18 months and <span className="whitespace-nowrap">$20–100k</span>
            </dd>
          </div>
          <div className="px-5 py-4">
            <dt className="text-[11px] uppercase tracking-[0.16em] text-copper">CarbonSight</dt>
            <dd className="mt-2 font-display text-[1.65rem] leading-tight text-ink">Minutes</dd>
            <dd className="mt-3 text-sm leading-6 text-muted">{successFee}% success fee, only when a tonne trades.</dd>
          </div>
        </dl>
      </section>

      <section className="grid min-w-0 gap-3 md:grid-cols-3">
        {steps.map((step) => (
          <article key={step.n} className="min-w-0 rounded-lg border border-line bg-paper px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{step.n}</p>
            <h2 className="mt-2 font-display text-xl font-medium text-ink">{step.title}</h2>
            <p className="mt-2 break-words text-sm leading-6 text-muted">{step.body}</p>
          </article>
        ))}
      </section>

      <section className="min-w-0">
        <h2 className="font-display text-2xl font-medium tracking-tight text-ink">Access, then a fee on the trade</h2>
        <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-3">
          {tiers.map((tier) => (
            <article key={tier.name} className="min-w-0 rounded-lg border border-line bg-paper px-5 py-4">
              <p className="text-sm text-muted">{tier.name}</p>
              <p className="mt-2 font-display text-3xl font-medium text-ink">
                ${tier.price}
                <span className="ml-1 font-sans text-sm font-normal text-muted">a month</span>
              </p>
              <p className="mt-2 break-words text-sm leading-6 text-muted">{tier.who}</p>
            </article>
          ))}
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-muted">
          Subscriptions are the access layer. The {successFee}% fee applies only when a tonne actually trades. Marketplace
          prices are assumptions for the voluntary market, labeled as such.
        </p>
      </section>
    </div>
  );
}
