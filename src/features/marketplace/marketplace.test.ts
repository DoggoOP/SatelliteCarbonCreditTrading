import { describe, expect, it } from "vitest";
import { createListingFromAnalysis } from "./createListingFromAnalysis";
import { applyListingFilters } from "./filters";
import { MarketplaceError } from "./errors";
import { marketplaceBase, marketplaceHref } from "./paths";
import { inferRegion, squarePolygon } from "./region";
import { createDemoListings } from "./seed";
import { SAMPLE_ANALYSIS } from "./catalog";
import { createLocalStorageRepository, parseSnapshot } from "./store/localStorageRepository";
import { createMarketplaceStore } from "./store/marketplaceStore";
import { createMemoryRepository } from "./store/repository";
import type { AnalysisResult } from "./types";

const analysis: AnalysisResult = {
  projectName: "Hill plot",
  polygon: squarePolygon(-122.6, 45.5),
  areaHa: 40,
  tCO2e: 100_000,
  annualSequestrationTCO2e: 100,
  confidence: "High",
  uncertaintyPct: 12,
  dataSources: ["Sentinel-2 L2A"],
};

describe("createListingFromAnalysis", () => {
  it("issues the vintage from sequestration, not standing stock", () => {
    const listing = createListingFromAnalysis(analysis, {
      pricePerTCO2e: 40,
      vintage: 2026,
      sellerName: "Desk",
      id: "lst_test",
      now: new Date("2026-04-01T00:00:00.000Z"),
    });
    expect(listing.stockTCO2e).toBe(100_000);
    expect(listing.grossTCO2e).toBe(100);
    expect(listing.bufferPct).toBe(10);
    expect(listing.bufferTCO2e).toBe(10);
    expect(listing.bankableTCO2e).toBe(90);
    expect(listing.availableTCO2e).toBe(90);
    expect(listing.region).toBe("Pacific Northwest");
    expect(listing.demo).toBe(false);
  });

  it("rejects a polygon that is not GeoJSON", () => {
    expect(() =>
      createListingFromAnalysis({ ...analysis, polygon: { type: "Point", coordinates: [0, 0] } as never }, {
        pricePerTCO2e: 10,
        vintage: 2026,
        sellerName: "Desk",
      }),
    ).toThrow(MarketplaceError);
  });
});

describe("demo book", () => {
  it("labels every seeded listing as demo and places it in a named region", () => {
    const listings = createDemoListings();
    expect(listings.map((listing) => [listing.id, listing.region, listing.confidence, listing.bankableTCO2e])).toEqual([
      ["demo_cedar", "Pacific Northwest", "High", 1620],
      ["demo_negro", "Amazon Basin", "Medium", 5120],
      ["demo_salonga", "Congo Basin", "Low", 1540],
      ["demo_kapuas", "Southeast Asia", "Medium", 2480],
      ["demo_varmland", "Scandinavia", "High", 864],
      ["demo_serra", "Atlantic Forest", "High", 666],
    ]);
    expect(listings.every((listing) => listing.demo)).toBe(true);
    expect(inferRegion(SAMPLE_ANALYSIS.polygon)).toBe("Pacific Northwest");
  });
});

describe("applyListingFilters", () => {
  it("filters by confidence, price, and region", () => {
    const listings = createDemoListings();
    const high = applyListingFilters(listings, {
      confidences: ["High"],
      minPrice: 50,
      maxPrice: null,
      region: "Pacific Northwest",
      hideSoldOut: false,
    });
    expect(high.map((listing) => listing.id)).toEqual(["demo_cedar"]);
  });
});

describe("marketplace paths", () => {
  it("strips the leaf the screen is on", () => {
    expect(marketplaceBase("/marketplace")).toBe("/marketplace");
    expect(marketplaceBase("/marketplace/list")).toBe("/marketplace");
    expect(marketplaceBase("/marketplace/portfolio")).toBe("/marketplace");
    expect(marketplaceBase("/marketplace/listing/demo_cedar")).toBe("/marketplace");
    expect(marketplaceHref("/marketplace", "list")).toBe("/marketplace/list");
    expect(marketplaceHref("/", "")).toBe("/");
  });
});

describe("localStorage repository", () => {
  it("round-trips a snapshot and ignores corrupt payloads", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    };
    const repo = createLocalStorageRepository(storage, "test-key");
    expect(repo.load()).toBeNull();
    const snapshot = {
      version: 1 as const,
      organization: { name: "Desk", tierId: "growth" as const },
      listings: createDemoListings(),
      holdings: [],
      transactions: [],
    };
    repo.save(snapshot);
    const loaded = repo.load();
    if (loaded instanceof Promise) throw new Error("localStorage load is synchronous");
    expect(loaded?.listings).toHaveLength(6);
    expect(parseSnapshot("{")).toBeNull();
    expect(parseSnapshot('{"version":2}')).toBeNull();
  });
});

describe("marketplace store", () => {
  function setup(tier: "starter" | "growth" | "enterprise" = "growth") {
    let n = 0;
    const clock = new Date("2026-04-15T12:00:00.000Z");
    const repository = createMemoryRepository();
    const store = createMarketplaceStore({
      repository,
      seedIfEmpty: true,
      now: () => clock,
      id: (prefix) => `${prefix}_${++n}`,
    });
    return { store, repository, async ready() {
      await store.whenReady();
      if (tier !== "growth") await store.setTier(tier);
    } };
  }

  it("charges the desk fee on a purchase and retires the holding", async () => {
    const { store, ready } = setup("enterprise");
    await ready();
    const bought = await store.purchase("demo_cedar", 10);
    expect(bought.successFeePct).toBe(7);
    expect(bought.subtotalUsd).toBe(520);
    expect(bought.successFeeUsd).toBe(36.4);
    expect(bought.sellerNetUsd).toBe(483.6);
    expect(bought.buyerPaysUsd).toBe(520);
    const afterBuy = store.getSnapshot().snapshot;
    expect(afterBuy.listings.find((listing) => listing.id === "demo_cedar")?.availableTCO2e).toBe(1610);
    expect(afterBuy.holdings[0].quantityTCO2e).toBe(10);

    const retired = await store.retire(afterBuy.holdings[0].id, 4, "Northwind FY26");
    expect(retired.kind).toBe("retirement");
    expect(retired.successFeeUsd).toBe(0);
    expect(retired.successFeePct).toBe(7);
    const holding = store.getSnapshot().snapshot.holdings[0];
    expect(holding.quantityTCO2e).toBe(6);
    expect(holding.retiredTCO2e).toBe(4);
  });

  it("blocks listing and retirement on Starter and enforces the 500 t monthly cap", async () => {
    const { store, ready } = setup("starter");
    await ready();
    await expect(
      store.publish(analysis, { pricePerTCO2e: 30, vintage: 2026 }),
    ).rejects.toThrow(/cannot list/i);
    await store.purchase("demo_salonga", 500);
    await expect(store.purchase("demo_salonga", 0.01)).rejects.toThrow(/500 tCO2e/);
    const holdingId = store.getSnapshot().snapshot.holdings[0].id;
    await expect(store.retire(holdingId, 1, "Claim")).rejects.toThrow(/cannot retire/i);
  });

  it("publishes a listing through the same issuance function", async () => {
    const { store, repository, ready } = setup();
    await ready();
    const listing = await store.publish(analysis, { pricePerTCO2e: 33.5, vintage: 2026 });
    expect(listing.bankableTCO2e).toBe(90);
    expect(listing.sellerName).toBe("CarbonSight Demo Desk");
    expect(store.getSnapshot().snapshot.transactions[0].kind).toBe("issuance");
    expect(store.getSnapshot().snapshot.transactions[0].successFeeUsd).toBe(0);
    expect(repository.current()?.listings[0].id).toBe(listing.id);
  });
});
