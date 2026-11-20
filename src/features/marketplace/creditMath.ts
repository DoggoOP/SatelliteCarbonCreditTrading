import { BUFFER_PCT, ISSUANCE_RULE } from "./constants";
import { MarketplaceError } from "./errors";
import { fromScaled, toScaled } from "./money";
import type { Confidence, Issuance } from "./types";

const CONFIDENCE_BANDS: readonly Confidence[] = ["High", "Medium", "Low"];

export function isConfidence(value: unknown): value is Confidence {
  return typeof value === "string" && CONFIDENCE_BANDS.includes(value as Confidence);
}

export function bufferPctFor(confidence: Confidence): number {
  return BUFFER_PCT[confidence];
}

/**
 * Split a gross tonne quantity into buffer and bankable credits.
 * `bankable + buffer` equals the gross rounded to 0.01 tCO2e.
 */
export function issueCredits(grossTCO2e: number, confidence: Confidence): Issuance {
  if (!isConfidence(confidence)) {
    throw new MarketplaceError("bad_confidence", "Confidence must be High, Medium, or Low.");
  }
  if (!Number.isFinite(grossTCO2e) || grossTCO2e < 0) {
    throw new MarketplaceError("bad_volume", "Gross tonnes must be zero or greater.");
  }

  const bufferPct = BUFFER_PCT[confidence];
  const grossScaled = toScaled(grossTCO2e, 2);
  const bufferScaled = Math.round((grossScaled * bufferPct) / 100);
  const bankableScaled = grossScaled - bufferScaled;

  return {
    grossTCO2e: fromScaled(grossScaled, 2),
    bufferPct,
    bufferTCO2e: fromScaled(bufferScaled, 2),
    bankableTCO2e: fromScaled(bankableScaled, 2),
  };
}

export function issuanceRuleText(): string {
  return ISSUANCE_RULE;
}
