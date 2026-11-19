import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PLATFORM_FEE_FRACTION, type CreditListing, type PortfolioSnapshot, type Purchase } from "../../shared/contract";

interface Ledger {
  listings: CreditListing[];
  purchases: Purchase[];
}

const dataDir = path.resolve(process.cwd(), "server/data");
const ledgerPath = path.join(dataDir, "ledger.json");

let memory: Ledger = { listings: [], purchases: [] };
let chain: Promise<void> = Promise.resolve();

export async function loadLedger(): Promise<void> {
  try {
    const raw = await readFile(ledgerPath, "utf8");
    const parsed = JSON.parse(raw) as Ledger;
    memory = {
      listings: Array.isArray(parsed.listings) ? parsed.listings : [],
      purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
    };
  } catch {
    memory = { listings: [], purchases: [] };
  }
}

async function persist(): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(ledgerPath, JSON.stringify(memory, null, 2));
}

function mutate<T>(fn: (ledger: Ledger) => T): Promise<T> {
  const run = chain.then(async () => {
    const value = fn(memory);
    await persist();
    return value;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function listListings(): CreditListing[] {
  return [...memory.listings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function portfolio(): PortfolioSnapshot {
  const listings = listListings();
  const purchases = [...memory.purchases].sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
  return {
    listings,
    purchases,
    totals: {
      listedTco2e: listings.reduce((sum, listing) => sum + listing.annualTco2e, 0),
      remainingTco2e: listings.reduce((sum, listing) => sum + listing.remainingTco2e, 0),
      purchasedTco2e: purchases.reduce((sum, purchase) => sum + purchase.tco2e, 0),
      grossUsd: purchases.reduce((sum, purchase) => sum + purchase.grossUsd, 0),
      feeUsd: purchases.reduce((sum, purchase) => sum + purchase.feeUsd, 0),
    },
  };
}

export function addListing(listing: CreditListing): Promise<CreditListing> {
  return mutate((ledger) => {
    const existing = ledger.listings.find((item) => item.analysisId === listing.analysisId);
    if (existing) return existing;
    ledger.listings.unshift(listing);
    return listing;
  });
}

export function recordPurchase(listingId: string, buyerName: string, tco2e: number): Promise<{ purchase: Purchase; listing: CreditListing }> {
  return mutate((ledger) => {
    const listing = ledger.listings.find((item) => item.id === listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }
    if (listing.status === "sold_out" || listing.remainingTco2e <= 0) {
      throw new Error("This listing is sold out");
    }
    if (!Number.isFinite(tco2e) || tco2e <= 0) {
      throw new Error("Choose a positive number of tonnes");
    }
    if (tco2e > listing.remainingTco2e + 1e-6) {
      throw new Error(`Only ${listing.remainingTco2e.toFixed(1)} tCO2e remain on this listing`);
    }
    const grossUsd = tco2e * listing.pricePerTonneUsd;
    const feeUsd = grossUsd * PLATFORM_FEE_FRACTION;
    const purchase: Purchase = {
      id: `buy_${crypto.randomUUID().slice(0, 8)}`,
      listingId: listing.id,
      projectName: listing.projectName,
      buyerName,
      tco2e,
      pricePerTonneUsd: listing.pricePerTonneUsd,
      grossUsd,
      feeUsd,
      developerProceedsUsd: grossUsd - feeUsd,
      purchasedAt: new Date().toISOString(),
    };
    listing.remainingTco2e = Math.max(0, listing.remainingTco2e - tco2e);
    if (listing.remainingTco2e < 0.05) {
      listing.remainingTco2e = 0;
      listing.status = "sold_out";
    }
    ledger.purchases.unshift(purchase);
    return { purchase, listing: { ...listing } };
  });
}
