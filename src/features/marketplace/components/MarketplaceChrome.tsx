import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { tierById } from "../constants";
import { useMarketplace } from "../context";
import { formatUsd } from "../money";
import { marketplaceBase, marketplaceHref } from "../paths";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm transition ${
    isActive ? "bg-white/10 text-white" : "text-emerald-100/80 hover:bg-white/5 hover:text-white"
  }`;

export function MarketplaceChrome() {
  const { pathname } = useLocation();
  const base = marketplaceBase(pathname);
  const { snapshot, status, persistError } = useMarketplace();
  const tier = tierById(snapshot.organization.tierId);

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#1c1915]">
      <header className="bg-[#10241c] text-stone-100">
        <div className="mx-auto max-w-6xl px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link to={marketplaceHref(base, "")} className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center border border-emerald-300/30 font-serif text-lg text-emerald-100">
                C
              </span>
              <span>
                <span className="block font-serif text-xl leading-none tracking-tight">CarbonSight</span>
                <span className="mt-1 block text-[11px] uppercase tracking-[0.18em] text-emerald-200/70">
                  Marketplace
                </span>
              </span>
            </Link>
            <div className="text-right text-xs leading-5 text-emerald-100/75">
              <div className="font-medium text-stone-50">{snapshot.organization.name}</div>
              <div>
                {tier.name} · {formatUsd(tier.monthlyUsd)}/mo · {tier.successFeePct}% success fee
              </div>
            </div>
          </div>
          <nav className="mt-4 flex items-center gap-1" aria-label="Marketplace">
            <NavLink to={marketplaceHref(base, "")} end className={navClass}>
              Browse
            </NavLink>
            <NavLink to={marketplaceHref(base, "list")} className={navClass}>
              List credits
            </NavLink>
            <NavLink to={marketplaceHref(base, "portfolio")} className={navClass}>
              Portfolio
            </NavLink>
          </nav>
        </div>
      </header>
      {persistError ? (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-center text-sm text-amber-950" role="status">
          Saved in this session only. {persistError}
        </div>
      ) : null}
      <main className="mx-auto max-w-6xl px-5 py-8">
        {status === "loading" ? (
          <p className="text-sm text-stone-500">Loading the book…</p>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
