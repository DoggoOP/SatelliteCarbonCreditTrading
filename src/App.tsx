import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { AnalyzePage } from "./pages/AnalyzePage";
import { LandingPage } from "./pages/LandingPage";
import { MarketplacePage } from "./pages/MarketplacePage";
import { PortfolioPage } from "./pages/PortfolioPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/analyze" element={<AnalyzePage />} />
        <Route path="/market" element={<MarketplacePage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
      </Routes>
    </AppShell>
  );
}
