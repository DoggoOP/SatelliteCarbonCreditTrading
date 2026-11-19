import type {
  AnalysisRequest,
  AnalysisResult,
  CreateListingRequest,
  CreditListing,
  PortfolioSnapshot,
  PurchaseReceipt,
  PurchaseRequest,
} from "../../shared/contract";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

export function analyzeArea(body: AnalysisRequest): Promise<AnalysisResult> {
  return request<AnalysisResult>("/api/analyze", { method: "POST", body: JSON.stringify(body) });
}

export function listCredits(): Promise<CreditListing[]> {
  return request<CreditListing[]>("/api/credits");
}

export function createListing(body: CreateListingRequest): Promise<CreditListing> {
  return request<CreditListing>("/api/credits", { method: "POST", body: JSON.stringify(body) });
}

export function purchaseCredit(id: string, body: PurchaseRequest): Promise<PurchaseReceipt> {
  return request<PurchaseReceipt>(`/api/credits/${id}/purchase`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getPortfolio(): Promise<PortfolioSnapshot> {
  return request<PortfolioSnapshot>("/api/portfolio");
}
