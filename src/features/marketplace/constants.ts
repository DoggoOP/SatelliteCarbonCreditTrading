import type { Confidence, TierId } from "./types";

/**
 * CarbonSight buffer pool v1.
 *
 * Tradeable vintage credits are issued against annual sequestration, not
 * standing stock. Standing stock stays on the listing as project context so
 * the same tonne is not sold twice.
 *
 *   gross     = annualSequestrationTCO2e
 *   buffer    = gross × buffer rate for the confidence band
 *   bankable  = gross − buffer
 *
 * High withholds 10%, Medium 20%, Low 30%. The withheld tonnes sit in a
 * reversal reserve and cannot be listed or sold. Uncertainty is disclosed to
 * buyers and does not change the rate — the confidence band is the commercial
 * key. Tonnes are settled to 0.01 tCO2e, and buffer + bankable always equals
 * the rounded gross.
 */
export const ISSUANCE_RULE =
  "Bankable credits equal annual sequestration minus a confidence-scaled buffer. High withholds 10%, Medium 20%, and Low 30%. Standing stock is disclosed and is not issued. Withheld tonnes stay in the reversal reserve and cannot be listed or sold.";

export const BUFFER_PCT: Record<Confidence, number> = {
  High: 10,
  Medium: 20,
  Low: 30,
};

export const SUCCESS_FEE_MIN_PCT = 7;
export const SUCCESS_FEE_MAX_PCT = 10;

export const TONNE_DECIMALS = 2;
export const USD_DECIMALS = 2;

export interface SubscriptionTier {
  id: TierId;
  name: string;
  monthlyUsd: number;
  /** Charged on each sale, taken from seller proceeds. Always within 7–10%. */
  successFeePct: number;
  /** Null means no monthly purchase cap. */
  monthlyPurchaseCapTCO2e: number | null;
  canList: boolean;
  canRetire: boolean;
  summary: string;
  features: readonly string[];
}

export const SUBSCRIPTION_TIERS: readonly SubscriptionTier[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyUsd: 49,
    successFeePct: 10,
    monthlyPurchaseCapTCO2e: 500,
    canList: false,
    canRetire: false,
    summary: "Browse the book and buy a limited monthly volume.",
    features: [
      "Marketplace browse and filters",
      "Purchases up to 500 tCO2e per calendar month",
      "Portfolio and transaction history",
      "10% success fee on sales",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    monthlyUsd: 149,
    successFeePct: 8,
    monthlyPurchaseCapTCO2e: null,
    canList: true,
    canRetire: true,
    summary: "List analysis results, buy without a cap, and retire credits.",
    features: [
      "Everything in Starter",
      "List credits from an analysis",
      "Unlimited purchases",
      "Retirement with a beneficiary",
      "8% success fee on sales",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyUsd: 299,
    successFeePct: 7,
    monthlyPurchaseCapTCO2e: null,
    canList: true,
    canRetire: true,
    summary: "The same desk tools, with the lowest success fee.",
    features: [
      "Everything in Growth",
      "7% success fee on sales",
      "Priority support once billing is connected",
    ],
  },
];

export const DEFAULT_TIER_ID: TierId = "growth";

export const STORAGE_KEY = "carbonsight.marketplace.v1";

export const DEFAULT_ORGANIZATION_NAME = "CarbonSight Demo Desk";

export function tierById(id: TierId): SubscriptionTier {
  const tier = SUBSCRIPTION_TIERS.find((item) => item.id === id);
  if (!tier) {
    throw new Error(`Unknown subscription tier: ${id}`);
  }
  return tier;
}
