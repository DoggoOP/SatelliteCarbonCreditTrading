import { Navigate, Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { AnalyzePage } from "./pages/AnalyzePage";
import { MarketplacePage } from "./integrations/marketplaceAdapter";

export function App() {
  return (
    <div className="flex h-full min-h-screen flex-col bg-paper font-sans text-ink">
      <Header />
      <Routes>
        <Route path="/" element={<AnalyzePage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
