import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { isMarketplaceError } from "./errors";
import { createBrowserRepository } from "./store/localStorageRepository";
import { createMarketplaceStore, type MarketplaceStore, type MarketplaceView } from "./store/marketplaceStore";

const MarketplaceContext = createContext<MarketplaceStore | null>(null);

export function MarketplaceProvider({
  children,
  store,
}: {
  children: ReactNode;
  store?: MarketplaceStore;
}) {
  const value = useMemo(
    () => store ?? createMarketplaceStore({ repository: createBrowserRepository() }),
    [store],
  );
  useEffect(() => {
    void value.whenReady();
  }, [value]);
  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
}

export function useMarketplaceStore(): MarketplaceStore {
  const store = useContext(MarketplaceContext);
  if (!store) {
    throw new Error("Marketplace components must render inside MarketplaceRoutes.");
  }
  return store;
}

export function useMarketplace(): MarketplaceView & { store: MarketplaceStore } {
  const store = useMarketplaceStore();
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { store, ...view };
}

export function usePendingAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    setPending(true);
    setError(null);
    try {
      return await action();
    } catch (caught) {
      setError(isMarketplaceError(caught) ? caught.message : "Something went wrong. Try again.");
      return undefined;
    } finally {
      setPending(false);
    }
  }

  return { error, pending, run, clear: () => setError(null) };
}
