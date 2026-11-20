import { MarketplaceError } from "./errors";
import { TONNE_DECIMALS, USD_DECIMALS } from "./constants";

/** Round half away from zero via integer scaling, after trimming binary dust. */
export function toScaled(value: number, decimals: number): number {
  if (!Number.isFinite(value)) {
    throw new MarketplaceError("not_finite", "Expected a finite number.");
  }
  const factor = 10 ** decimals;
  const scaled = value * factor;
  const trimmed = Math.round(scaled * 1e6) / 1e6;
  return Math.round(trimmed);
}

export function fromScaled(scaled: number, decimals: number): number {
  return scaled / 10 ** decimals;
}

export function roundTonnes(value: number): number {
  return fromScaled(toScaled(value, TONNE_DECIMALS), TONNE_DECIMALS);
}

export function roundUsd(value: number): number {
  return fromScaled(toScaled(value, USD_DECIMALS), USD_DECIMALS);
}

export function formatTonnes(value: number, digits = 2): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
  return `${formatted} tCO₂e`;
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function formatHa(value: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)} ha`;
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}%`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(iso));
}
