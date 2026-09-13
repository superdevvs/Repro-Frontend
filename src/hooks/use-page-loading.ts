import { createContext, useContext, useLayoutEffect } from 'react';

export interface PageLoadingRegistry {
  register: () => () => void;
}

export const PageLoadingContext = createContext<PageLoadingRegistry | null>(null);

/** Report initial page work without turning action or background refreshes into a page blocker. */
export function usePageLoading(loading: boolean): boolean {
  const registry = useContext(PageLoadingContext);

  useLayoutEffect(() => {
    if (loading && registry) return registry.register();
  }, [loading, registry]);

  return registry !== null;
}
