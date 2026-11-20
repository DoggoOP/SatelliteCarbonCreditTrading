import { NavLink } from "react-router-dom";

const link = "rounded-full px-3 py-1.5 text-sm text-ink/70 transition hover:text-ink";
const active = "bg-white text-pine shadow-sm";

export function Header() {
  return (
    <header className="flex items-center gap-6 border-b border-line bg-paper/90 px-4 py-3 backdrop-blur md:px-6">
      <NavLink to="/" className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-pine text-paper">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-paper" />
        </span>
        <span>
          <span className="block font-serif text-xl leading-none text-pine">CarbonSight</span>
          <span className="mt-1 hidden text-[11px] uppercase tracking-[0.14em] text-ink/50 sm:block">
            Real-time satellite intelligence for bankable carbon credits.
          </span>
        </span>
      </NavLink>
      <nav className="ml-auto flex items-center gap-1">
        <NavLink to="/" end className={({ isActive }) => `${link} ${isActive ? active : ""}`}>
          Analyze
        </NavLink>
        <NavLink to="/marketplace" className={({ isActive }) => `${link} ${isActive ? active : ""}`}>
          Marketplace
        </NavLink>
      </nav>
    </header>
  );
}
