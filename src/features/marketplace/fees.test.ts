import { describe, expect, it } from "vitest";
import { SUBSCRIPTION_TIERS } from "./constants";
import { MarketplaceError } from "./errors";
import { quotePurchase, successFeePctForTier } from "./fees";

function cents(usd: number): number {
  return Math.round(usd * 100);
}

describe("quotePurchase", () => {
  it("keeps the success fee inside 7–10% and shows it on the quote", () => {
    const quote = quotePurchase(100, 10, 10);
    expect(quote).toMatchObject({
      quantityTCO2e: 100,
      pricePerTCO2e: 10,
      subtotalUsd: 1000,
      successFeePct: 10,
      successFeeUsd: 100,
      sellerNetUsd: 900,
      buyerPaysUsd: 1000,
    });
    expect(quote.successFeeUsd + quote.sellerNetUsd).toBe(quote.subtotalUsd);
    expect(quote.buyerPaysUsd).toBe(quote.subtotalUsd);
  });

  it("rounds an awkward notional so fee plus seller net still equals the subtotal", () => {
    const quote = quotePurchase(7.5, 12.34, 8);
    expect(quote.subtotalUsd).toBeCloseTo(92.55, 2);
    expect(quote.successFeeUsd).toBeCloseTo(7.4, 2);
    expect(quote.sellerNetUsd).toBeCloseTo(85.15, 2);
    expect(cents(quote.successFeeUsd) + cents(quote.sellerNetUsd)).toBe(cents(quote.subtotalUsd));

    const enterprise = quotePurchase(7.5, 12.34, successFeePctForTier("enterprise"));
    expect(enterprise.successFeePct).toBe(7);
    expect(enterprise.successFeeUsd).toBeCloseTo(6.48, 2);
    expect(cents(enterprise.successFeeUsd) + cents(enterprise.sellerNetUsd)).toBe(cents(enterprise.subtotalUsd));
  });

  it("rejects fees outside 7–10% and zero totals", () => {
    expect(() => quotePurchase(10, 20, 6)).toThrow(MarketplaceError);
    expect(() => quotePurchase(10, 20, 11)).toThrow(MarketplaceError);
    expect(() => quotePurchase(0.01, 0.01, 8)).toThrow(MarketplaceError);
  });
});

describe("subscription tiers", () => {
  it("prices the desk at 49 / 149 / 299 and keeps every success fee in range", () => {
    expect(SUBSCRIPTION_TIERS.map((tier) => [tier.id, tier.monthlyUsd, tier.successFeePct])).toEqual([
      ["starter", 49, 10],
      ["growth", 149, 8],
      ["enterprise", 299, 7],
    ]);
    for (const tier of SUBSCRIPTION_TIERS) {
      expect(tier.successFeePct).toBeGreaterThanOrEqual(7);
      expect(tier.successFeePct).toBeLessThanOrEqual(10);
    }
    expect(SUBSCRIPTION_TIERS[0].canList).toBe(false);
    expect(SUBSCRIPTION_TIERS[0].canRetire).toBe(false);
    expect(SUBSCRIPTION_TIERS[0].monthlyPurchaseCapTCO2e).toBe(500);
    expect(SUBSCRIPTION_TIERS[1].canList).toBe(true);
    expect(SUBSCRIPTION_TIERS[1].monthlyPurchaseCapTCO2e).toBeNull();
  });
});
