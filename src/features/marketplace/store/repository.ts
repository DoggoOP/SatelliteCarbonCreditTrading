import type { MarketplaceSnapshot } from "../types";

/**
 * Persistence boundary. `load` returns null when there is nothing stored yet.
 * Both methods may be sync or async so a backend can replace localStorage
 * without changing the store.
 */
export interface MarketplaceRepository {
  load(): Promise<MarketplaceSnapshot | null> | MarketplaceSnapshot | null;
  save(snapshot: MarketplaceSnapshot): Promise<void> | void;
}

export function createMemoryRepository(initial: MarketplaceSnapshot | null = null): MarketplaceRepository & {
  current(): MarketplaceSnapshot | null;
} {
  let snapshot = initial;
  return {
    load() {
      return snapshot;
    },
    save(next) {
      snapshot = next;
    },
    current() {
      return snapshot;
    },
  };
}
