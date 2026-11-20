import { tierById } from "../constants";
import { createListingFromAnalysis } from "../createListingFromAnalysis";
import { quotePurchase, successFeePctForTier } from "../fees";
import { MarketplaceError } from "../errors";
import { createId } from "../ids";
import { roundTonnes } from "../money";
import { createDemoListings, createSeedSnapshot, emptySnapshot } from "../seed";
import type {
  AnalysisResult,
  CreditListing,
  Holding,
  LedgerTransaction,
  ListingTerms,
  MarketplaceSnapshot,
  TierId,
} from "../types";
import type { MarketplaceRepository } from "./repository";

export interface MarketplaceView {
  status: "loading" | "ready";
  snapshot: MarketplaceSnapshot;
  persistError: string | null;
}

export interface MarketplaceStore {
  getSnapshot(): MarketplaceView;
  subscribe(listener: () => void): () => void;
  whenReady(): Promise<void>;
  publish(analysis: AnalysisResult, terms: Omit<ListingTerms, "sellerName"> & { sellerName?: string }): Promise<CreditListing>;
  purchase(listingId: string, quantityTCO2e: number): Promise<LedgerTransaction>;
  retire(holdingId: string, quantityTCO2e: number, beneficiary: string): Promise<LedgerTransaction>;
  setTier(tierId: TierId): Promise<void>;
  setOrganizationName(name: string): Promise<void>;
  restoreDemoListings(): Promise<void>;
  resetDemo(): Promise<void>;
}

export interface StoreOptions {
  repository: MarketplaceRepository;
  now?: () => Date;
  id?: (prefix: string) => string;
  /** When true (default), an empty repository is seeded with demo listings. */
  seedIfEmpty?: boolean;
}

function tonnesPurchasedThisMonth(snapshot: MarketplaceSnapshot, month: string): number {
  return snapshot.transactions
    .filter((txn) => txn.kind === "purchase" && txn.at.slice(0, 7) === month)
    .reduce((sum, txn) => sum + txn.quantityTCO2e, 0);
}

export function createMarketplaceStore(options: StoreOptions): MarketplaceStore {
  const now = options.now ?? (() => new Date());
  const nextId = options.id ?? createId;
  const seedIfEmpty = options.seedIfEmpty ?? true;
  const listeners = new Set<() => void>();

  let view: MarketplaceView = {
    status: "loading",
    snapshot: emptySnapshot(),
    persistError: null,
  };

  let readyPromise: Promise<void> | null = null;

  function emit() {
    listeners.forEach((listener) => listener());
  }

  function requireReady(): MarketplaceSnapshot {
    if (view.status !== "ready") {
      throw new MarketplaceError("loading", "Marketplace is still loading.");
    }
    return view.snapshot;
  }

  let chain: Promise<unknown> = Promise.resolve();
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = chain.then(task, task);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function commit(snapshot: MarketplaceSnapshot, persistError: string | null = null) {
    view = { status: "ready", snapshot, persistError };
    emit();
    try {
      await options.repository.save(snapshot);
      if (view.snapshot === snapshot && view.persistError) {
        view = { ...view, persistError: null };
        emit();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save the marketplace.";
      view = { status: "ready", snapshot, persistError: message };
      emit();
    }
  }

  async function hydrate() {
    try {
      const loaded = await options.repository.load();
      const snapshot = loaded ?? (seedIfEmpty ? createSeedSnapshot() : emptySnapshot());
      view = { status: "ready", snapshot, persistError: null };
      emit();
      if (!loaded) {
        try {
          await options.repository.save(snapshot);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not save the marketplace.";
          view = { ...view, persistError: message };
          emit();
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load the marketplace.";
      const snapshot = seedIfEmpty ? createSeedSnapshot() : emptySnapshot();
      view = { status: "ready", snapshot, persistError: message };
      emit();
    }
  }

  return {
    getSnapshot() {
      return view;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    whenReady() {
      if (!readyPromise) readyPromise = hydrate();
      return readyPromise;
    },
    publish(analysis, terms) {
      return enqueue(async () => {
      const snapshot = requireReady();
      const tier = tierById(snapshot.organization.tierId);
      if (!tier.canList) {
        throw new MarketplaceError(
          "tier_gate",
          `${tier.name} cannot list credits. Growth and Enterprise can publish a vintage from an analysis.`,
        );
      }
      const listing = createListingFromAnalysis(analysis, {
        ...terms,
        sellerName: terms.sellerName?.trim() || snapshot.organization.name,
      });
      if (snapshot.listings.some((item) => item.id === listing.id)) {
        throw new MarketplaceError("duplicate_listing", "A listing with this id already exists.");
      }
      const issuedAt = now().toISOString();
      const issuance: LedgerTransaction = {
        id: nextId("txn"),
        kind: "issuance",
        at: issuedAt,
        projectName: listing.projectName,
        listingId: listing.id,
        quantityTCO2e: listing.bankableTCO2e,
        pricePerTCO2e: listing.pricePerTCO2e,
        subtotalUsd: 0,
        successFeePct: tier.successFeePct,
        successFeeUsd: 0,
        sellerNetUsd: 0,
        buyerPaysUsd: 0,
        counterparty: listing.sellerName,
        note: `Issued ${listing.bankableTCO2e} bankable tCO2e after a ${listing.bufferPct}% buffer. Success fee applies on sale, not issuance.`,
      };
      const stored: CreditListing = { ...listing, createdAt: issuedAt };
      await commit({
        ...snapshot,
        listings: [stored, ...snapshot.listings],
        transactions: [issuance, ...snapshot.transactions],
      });
      return stored;
      });
    },
    purchase(listingId, quantityTCO2e) {
      return enqueue(async () => {
      const snapshot = requireReady();
      const tier = tierById(snapshot.organization.tierId);
      const listing = snapshot.listings.find((item) => item.id === listingId);
      if (!listing) throw new MarketplaceError("missing_listing", "That listing is no longer on the book.");

      const quote = quotePurchase(quantityTCO2e, listing.pricePerTCO2e, successFeePctForTier(tier.id));
      if (quote.quantityTCO2e > listing.availableTCO2e + 1e-9) {
        throw new MarketplaceError(
          "insufficient_volume",
          `Only ${listing.availableTCO2e} tCO2e remain on this listing.`,
        );
      }
      const at = now().toISOString();
      if (tier.monthlyPurchaseCapTCO2e != null) {
        const used = roundTonnes(tonnesPurchasedThisMonth(snapshot, at.slice(0, 7)));
        const next = roundTonnes(used + quote.quantityTCO2e);
        if (next > tier.monthlyPurchaseCapTCO2e) {
          const left = Math.max(0, roundTonnes(tier.monthlyPurchaseCapTCO2e - used));
          throw new MarketplaceError(
            "purchase_cap",
            `${tier.name} includes ${tier.monthlyPurchaseCapTCO2e} tCO2e of purchases each calendar month. ${left} tCO2e remain. Growth removes the cap.`,
          );
        }
      }

      const holding: Holding = {
        id: nextId("hld"),
        listingId: listing.id,
        projectName: listing.projectName,
        region: listing.region,
        vintage: listing.vintage,
        confidence: listing.confidence,
        pricePerTCO2e: quote.pricePerTCO2e,
        quantityTCO2e: quote.quantityTCO2e,
        retiredTCO2e: 0,
        acquiredAt: at,
      };
      const transaction: LedgerTransaction = {
        id: nextId("txn"),
        kind: "purchase",
        at,
        projectName: listing.projectName,
        listingId: listing.id,
        holdingId: holding.id,
        quantityTCO2e: quote.quantityTCO2e,
        pricePerTCO2e: quote.pricePerTCO2e,
        subtotalUsd: quote.subtotalUsd,
        successFeePct: quote.successFeePct,
        successFeeUsd: quote.successFeeUsd,
        sellerNetUsd: quote.sellerNetUsd,
        buyerPaysUsd: quote.buyerPaysUsd,
        counterparty: listing.sellerName,
        note: `Buyer pays the listed price. CarbonSight retains ${quote.successFeePct}% from seller proceeds.`,
      };
      const availableTCO2e = Math.max(0, roundTonnes(listing.availableTCO2e - quote.quantityTCO2e));
      await commit({
        ...snapshot,
        listings: snapshot.listings.map((item) =>
          item.id === listing.id ? { ...item, availableTCO2e } : item,
        ),
        holdings: [holding, ...snapshot.holdings],
        transactions: [transaction, ...snapshot.transactions],
      });
      return transaction;
      });
    },
    retire(holdingId, quantityTCO2e, beneficiary) {
      return enqueue(async () => {
      const snapshot = requireReady();
      const tier = tierById(snapshot.organization.tierId);
      if (!tier.canRetire) {
        throw new MarketplaceError(
          "tier_gate",
          `${tier.name} cannot retire credits. Growth and Enterprise can retire a holding against a beneficiary.`,
        );
      }
      const name = beneficiary.trim();
      if (!name) throw new MarketplaceError("bad_beneficiary", "A retirement beneficiary is required.");
      const holding = snapshot.holdings.find((item) => item.id === holdingId);
      if (!holding) throw new MarketplaceError("missing_holding", "That holding is not in the portfolio.");
      const quoteQuantity = roundTonnes(quantityTCO2e);
      if (quoteQuantity <= 0) {
        throw new MarketplaceError("bad_quantity", "Retirement quantity must be greater than zero.");
      }
      if (quoteQuantity > holding.quantityTCO2e + 1e-9) {
        throw new MarketplaceError(
          "insufficient_volume",
          `Only ${holding.quantityTCO2e} tCO2e remain in this holding.`,
        );
      }
      const at = now().toISOString();
      const transaction: LedgerTransaction = {
        id: nextId("txn"),
        kind: "retirement",
        at,
        projectName: holding.projectName,
        listingId: holding.listingId,
        holdingId: holding.id,
        quantityTCO2e: quoteQuantity,
        pricePerTCO2e: holding.pricePerTCO2e,
        subtotalUsd: 0,
        successFeePct: tier.successFeePct,
        successFeeUsd: 0,
        sellerNetUsd: 0,
        buyerPaysUsd: 0,
        counterparty: name,
        note: `Retired against ${name}. No success fee on retirement. The desk rate is ${tier.successFeePct}% and applies on sale.`,
      };
      await commit({
        ...snapshot,
        holdings: snapshot.holdings.map((item) =>
          item.id === holding.id
            ? {
                ...item,
                quantityTCO2e: Math.max(0, roundTonnes(item.quantityTCO2e - quoteQuantity)),
                retiredTCO2e: roundTonnes(item.retiredTCO2e + quoteQuantity),
              }
            : item,
        ),
        transactions: [transaction, ...snapshot.transactions],
      });
      return transaction;
      });
    },
    setTier(tierId) {
      return enqueue(async () => {
      const snapshot = requireReady();
      tierById(tierId);
      await commit({ ...snapshot, organization: { ...snapshot.organization, tierId } });
      });
    },
    setOrganizationName(name) {
      return enqueue(async () => {
      const snapshot = requireReady();
      const trimmed = name.trim();
      if (!trimmed) throw new MarketplaceError("bad_org", "Desk name is required.");
      await commit({ ...snapshot, organization: { ...snapshot.organization, name: trimmed } });
      });
    },
    restoreDemoListings() {
      return enqueue(async () => {
      const snapshot = requireReady();
      const present = new Set(snapshot.listings.map((listing) => listing.id));
      const missing = createDemoListings().filter((listing) => !present.has(listing.id));
      if (missing.length === 0) return;
      await commit({ ...snapshot, listings: [...missing, ...snapshot.listings] });
      });
    },
    resetDemo() {
      return enqueue(async () => {
        requireReady();
        await commit(createSeedSnapshot());
      });
    },
  };
}
