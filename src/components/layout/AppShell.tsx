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
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4 sm:py-3">
          <NavLink to="/" className="mr-auto flex min-w-0 items-baseline gap-2">
            <span className="font-display text-[1.35rem] font-semibold leading-none tracking-tight text-canopy">
              CarbonSight
            </span>
            <span className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-muted md:inline">
              Satellite MRV
            </span>
          </NavLink>
          <nav aria-label="Primary" className="flex max-w-full flex-wrap items-center gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-full px-2.5 py-1.5 text-[13px] leading-none sm:px-3 sm:text-sm ${
                    isActive ? "bg-canopy text-paper" : "text-muted hover:bg-canvas hover:text-ink"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-6xl px-3 py-5 sm:px-4 sm:py-6">{children}</main>
    </div>
  );
}
