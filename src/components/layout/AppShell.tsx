import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/analyze", label: "Analyze" },
  { to: "/market", label: "Marketplace" },
  { to: "/portfolio", label: "Portfolio" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-x-6 sm:py-4">
          <NavLink to="/" className="flex min-w-0 items-baseline gap-3">
            <span className="font-display text-[1.45rem] font-medium leading-none tracking-tight text-ink">
              CarbonSight
            </span>
            <span className="hidden text-[11px] font-medium uppercase tracking-[0.16em] text-muted md:inline">
              Satellite MRV
            </span>
          </NavLink>
          <nav aria-label="Primary" className="flex max-w-full flex-wrap items-center gap-x-4 gap-y-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `border-b-2 pb-0.5 text-sm leading-none ${
                    isActive ? "border-copper text-ink" : "border-transparent text-muted hover:text-ink"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-8 sm:py-10">{children}</main>
    </div>
  );
}
