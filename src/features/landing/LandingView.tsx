import { Link } from "react-router-dom";
import { CREDIT_DISCLAIMER, PLATFORM_FEE_FRACTION } from "../../../shared/contract";

const successFeePercent = Math.round(PLATFORM_FEE_FRACTION * 100);

const tiers = [
  { name: "Scout", price: 49, who: "Landowners checking one property" },
  { name: "Project", price: 149, who: "Developers running a portfolio of stands" },
  { name: "Desk", price: 299, who: "Buyers and validators comparing claims" },
] as const;

const steps = [
  {
    n: "01",
    title: "Draw your parcel",
    body: "A boundary, a preset forest, or GeoJSON. Area is measured on the globe.",
  },
  {
    n: "02",
    title: "Read satellites",
    body: "MODIS greenness, Harmonized Global Biomass, Chloris change, and a recent Sentinel-2 scene.",
  },
  {
    n: "03",
    title: "List buffered removals",
    body: "Only the annual removal after the non-permanence buffer can be listed.",
  },
] as const;

const sources = ["MODIS", "Biomass", "Chloris", "Sentinel-2"] as const;

export function LandingView() {
  return (
    <div className="flex flex-col gap-4">
      <section className="grid items-stretch gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase leading-4 tracking-[0.16em] text-canopy">
            Satellite-based carbon removal
          </p>
          <h1 className="font-display mt-2 max-w-xl text-[1.7rem] font-semibold leading-[1.08] tracking-tight text-ink sm:text-4xl lg:text-[2.6rem]">
            Measure the removal.
            <span className="mt-1 block text-canopy">List the credit.</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted sm:text-[15px]">
            Draw a parcel. CarbonSight reads public satellites and returns standing carbon, an annual removal, and a
            confidence score. The listing is the buffered removal, never the standing stock.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              to="/analyze?preset=redwoods"
              className="inline-flex max-w-full items-center justify-center gap-2 rounded-full bg-canopy px-5 py-2.5 text-sm font-medium text-paper shadow-sm transition hover:bg-ink"
            >
              Analyze the redwoods
              <ArrowIcon />
            </Link>
            <Link
              to="/market"
              className="inline-flex max-w-full items-center justify-center rounded-full border border-line bg-paper px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-canvas"
            >
              See the marketplace
            </Link>
          </div>
          <Contrast />
        </div>
        <ParcelReadout />
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-line bg-paper px-4 py-3 shadow-card">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">From parcel to listing</h2>
          <ol className="mt-1">
            {steps.map((step) => (
              <li
                key={step.n}
                className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2 border-t border-line py-2 first:border-t-0"
              >
                <span className="font-display text-base font-semibold leading-6 text-canopy">{step.n}</span>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-semibold leading-6 tracking-tight text-ink">{step.title}</h3>
                  <p className="text-sm leading-5 text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="min-w-0 rounded-2xl border border-line bg-paper px-4 py-3 shadow-card">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Pricing</h2>
            <p className="text-xs text-muted">Billed monthly</p>
          </div>
          <ul className="mt-1">
            {tiers.map((tier) => (
              <li
                key={tier.name}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 border-t border-line py-2 first:border-t-0"
              >
                <p className="min-w-0 text-sm leading-5">
                  <span className="font-medium text-ink">{tier.name}</span>
                  <span className="text-muted"> — {tier.who}</span>
                </p>
                <p className="font-display whitespace-nowrap text-2xl font-semibold leading-none tracking-tight text-ink">
                  ${tier.price}
                  <span className="ml-1 font-sans text-xs font-normal text-muted">/mo</span>
                </p>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 border-t border-line py-2">
            <p className="min-w-0 text-sm leading-5 text-ink">Success fee when a tonne trades</p>
            <p className="font-display text-2xl font-semibold leading-none text-copper">{successFeePercent}%</p>
          </div>
          <p className="text-xs leading-5 text-muted">
            Subscriptions are the access layer. The {successFeePercent}% fee applies only when a tonne trades.{" "}
            {CREDIT_DISCLAIMER}
          </p>
        </div>
      </section>
    </div>
  );
}

function Contrast() {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <div className="min-w-0 rounded-xl border border-line bg-paper px-3 py-2.5">
        <p className="text-[10px] font-medium uppercase leading-4 tracking-[0.12em] text-muted">Field verification</p>
        <p className="font-display mt-1 text-[1.35rem] font-semibold leading-none tracking-tight text-copper sm:text-2xl">
          6–18 months
        </p>
        <p className="mt-1 text-sm font-semibold text-ink">$20–100k</p>
        <div className="mt-2 h-1 rounded-full bg-copper" />
      </div>
      <div className="min-w-0 rounded-xl border border-line bg-paper px-3 py-2.5">
        <p className="text-[10px] font-medium uppercase leading-4 tracking-[0.12em] text-muted">CarbonSight</p>
        <p className="font-display mt-1 text-[1.35rem] font-semibold leading-none tracking-tight text-canopy sm:text-2xl">
          Minutes
        </p>
        <p className="mt-1 text-sm leading-5 text-ink">Then a listing</p>
        <div className="mt-2 h-1 w-8 max-w-full rounded-full bg-canopy" />
      </div>
    </div>
  );
}

function ParcelReadout() {
  return (
    <aside className="flex min-w-0 flex-col rounded-2xl border border-line bg-paper p-3 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Parcel readout</p>
        <p className="text-[11px] text-muted">Public satellites</p>
      </div>
      <div className="mt-2 overflow-hidden rounded-xl border border-line">
        <ParcelMark />
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {sources.map((source) => (
          <li key={source} className="rounded-full border border-line bg-canvas px-2 py-0.5 text-[11px] leading-4 text-muted">
            {source}
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        <Readout label="Stock" value="Inventory" />
        <Readout label="Removal" value="Annual" />
        <Readout label="Listed" value="Buffered" />
      </dl>
    </aside>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-canvas px-2 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-xs font-medium leading-4 text-ink">{value}</dd>
    </div>
  );
}

function ParcelMark() {
  return (
    <svg viewBox="0 0 360 150" className="h-auto w-full" role="img" aria-label="Drawn parcel crossed by a satellite pass">
      <rect width="360" height="150" className="fill-canvas" />
      {([30, 60, 90, 120] as const).map((y) => (
        <line key={`y-${y}`} x1="0" x2="360" y1={y} y2={y} className="stroke-line" strokeWidth="1" />
      ))}
      {([45, 90, 135, 180, 225, 270, 315] as const).map((x) => (
        <line key={`x-${x}`} y1="0" y2="150" x1={x} x2={x} className="stroke-line" strokeWidth="1" />
      ))}
      <path
        d="M46 112 L84 34 L158 26 L198 56 L238 46 L292 86 L268 128 L160 138 L90 132 Z"
        className="fill-canopy/15 stroke-canopy"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M116 102 L140 52 L190 58 L218 94 L184 116 L134 112 Z"
        className="fill-canopy/40 stroke-canopy"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <line x1="12" x2="348" y1="82" y2="82" className="stroke-copper" strokeWidth="1.25" strokeDasharray="3 5" />
      <circle cx="190" cy="82" r="3.5" className="fill-copper" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path
        d="M3 8h10M9 4l4 4-4 4"
        className="stroke-paper"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
