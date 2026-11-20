import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { MarketplaceRoutes, type AnalysisResult as MarketAnalysis } from "../features/marketplace";

export const MARKET_ANALYSIS_KEY = "carbonsight:market-analysis";

export function readMarketAnalysis(): MarketAnalysis | undefined {
  try {
    const raw = sessionStorage.getItem(MARKET_ANALYSIS_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as MarketAnalysis;
  } catch {
    return undefined;
  }
}

export function MarketplaceGate() {
  const location = useLocation();
  const fromState = (location.state as { analysis?: MarketAnalysis } | null)?.analysis;
  const [analysis, setAnalysis] = useState<MarketAnalysis | undefined>(fromState ?? readMarketAnalysis());

  useEffect(() => {
    if (!fromState) return;
    sessionStorage.setItem(MARKET_ANALYSIS_KEY, JSON.stringify(fromState));
    setAnalysis(fromState);
  }, [fromState]);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <MarketplaceRoutes initialAnalysis={analysis} />
    </div>
  );
}
