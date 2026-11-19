import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/analyze", label: "Analyze" },
  { to: "/market", label: "Marketplace" },
  { to: "/portfolio", label: "Portfolio" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <NavLink to="/" className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tracking-tight">CarbonSight</span>
            <span className="hidden text-xs uppercase tracking-[0.16em] text-muted sm:inline">Satellite MRV</span>
          </NavLink>
          <nav className="flex items-center gap-1 text-sm">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 ${isActive ? "bg-ink text-paper" : "text-muted hover:text-ink"}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
