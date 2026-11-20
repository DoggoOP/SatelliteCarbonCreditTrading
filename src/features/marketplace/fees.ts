import { SUCCESS_FEE_MAX_PCT, SUCCESS_FEE_MIN_PCT, tierById } from "./constants";
import { MarketplaceError } from "./errors";
import { fromScaled, toScaled } from "./money";
import type { PurchaseQuote, TierId } from "./types";

export function assertSuccessFeePct(successFeePct: number): void {
  if (!Number.isFinite(successFeePct)) {
    throw new MarketplaceError("bad_fee", "Success fee must be a finite percent.");
  }
  const basisPoints = Math.round(successFeePct * 100);
  const minBp = SUCCESS_FEE_MIN_PCT * 100;
  const maxBp = SUCCESS_FEE_MAX_PCT * 100;
  if (basisPoints < minBp || basisPoints > maxBp) {
    throw new MarketplaceError(
      "fee_out_of_range",
      `Success fee must be between ${SUCCESS_FEE_MIN_PCT}% and ${SUCCESS_FEE_MAX_PCT}%.`,
    );
  }
}

export function successFeePctForTier(tierId: TierId): number {
  return tierById(tierId).successFeePct;
}

/**
 * Buyer pays the listed subtotal. CarbonSight keeps the success fee from
 * seller proceeds. Subtotal, fee, and seller net are rounded to cents.
 * In cents, fee + seller net equals the subtotal.
 */
export function quotePurchase(
  quantityTCO2e: number,
  pricePerTCO2e: number,
  successFeePct: number,
): PurchaseQuote {
  if (!Number.isFinite(quantityTCO2e) || quantityTCO2e <= 0) {
    throw new MarketplaceError("bad_quantity", "Purchase quantity must be greater than zero.");
  }
  if (!Number.isFinite(pricePerTCO2e) || pricePerTCO2e <= 0) {
    throw new MarketplaceError("bad_price", "Price per tCO2e must be greater than zero.");
  }
  assertSuccessFeePct(successFeePct);

  const quantityScaled = toScaled(quantityTCO2e, 2);
  const priceScaled = toScaled(pricePerTCO2e, 2);
  const subtotalScaled = Math.round((quantityScaled * priceScaled) / 100);
  if (subtotalScaled <= 0) {
    throw new MarketplaceError(
      "bad_notional",
      "Order total rounds to zero. Increase the quantity or the price.",
    );
  }
  const basisPoints = Math.round(successFeePct * 100);
  const feeScaled = Math.round((subtotalScaled * basisPoints) / 10000);
  const sellerScaled = subtotalScaled - feeScaled;

  return {
    quantityTCO2e: fromScaled(quantityScaled, 2),
    pricePerTCO2e: fromScaled(priceScaled, 2),
    subtotalUsd: fromScaled(subtotalScaled, 2),
    successFeePct,
    successFeeUsd: fromScaled(feeScaled, 2),
    sellerNetUsd: fromScaled(sellerScaled, 2),
    buyerPaysUsd: fromScaled(subtotalScaled, 2),
  };
}
