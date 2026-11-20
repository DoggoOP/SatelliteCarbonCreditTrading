import { Navigate, Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { MarketplaceGate } from "./integrations/MarketplaceGate";
import { AnalyzePage } from "./pages/AnalyzePage";

export function App() {
  return (
    <div className="flex h-full min-h-screen flex-col bg-paper font-sans text-ink">
      <Header />
      <div className="flex min-h-0 flex-1 flex-col">
        <Routes>
          <Route path="/" element={<AnalyzePage />} />
          <Route path="/marketplace/*" element={<MarketplaceGate />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
