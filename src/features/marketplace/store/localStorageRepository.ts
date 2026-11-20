import { STORAGE_KEY } from "../constants";
import { isConfidence } from "../creditMath";
import type { MarketplaceSnapshot } from "../types";
import type { MarketplaceRepository } from "./repository";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isSnapshot(value: unknown): value is MarketplaceSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const snapshot = value as MarketplaceSnapshot;
  if (snapshot.version !== 1) return false;
  if (!snapshot.organization || typeof snapshot.organization.name !== "string") return false;
  if (!["starter", "growth", "enterprise"].includes(snapshot.organization.tierId)) return false;
  if (!Array.isArray(snapshot.listings) || !Array.isArray(snapshot.holdings) || !Array.isArray(snapshot.transactions)) {
    return false;
  }
  return snapshot.listings.every(
    (listing) =>
      listing &&
      typeof listing.id === "string" &&
      typeof listing.projectName === "string" &&
      isConfidence(listing.confidence) &&
      typeof listing.availableTCO2e === "number" &&
      typeof listing.pricePerTCO2e === "number",
  );
}

export function parseSnapshot(raw: string): MarketplaceSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function createLocalStorageRepository(
  storage: KeyValueStorage,
  key: string = STORAGE_KEY,
): MarketplaceRepository {
  return {
    load() {
      const raw = storage.getItem(key);
      if (!raw) return null;
      return parseSnapshot(raw);
    },
    save(snapshot) {
      storage.setItem(key, JSON.stringify(snapshot));
    },
  };
}

export function createBrowserRepository(): MarketplaceRepository {
  if (typeof window === "undefined" || !window.localStorage) {
    return {
      load() {
        return null;
      },
      save() {
        /* no browser storage available */
      },
    };
  }
  return createLocalStorageRepository(window.localStorage);
}
