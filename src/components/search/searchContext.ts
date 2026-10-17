import { createContext, useContext } from 'react';
import type { PageSearchAdapter, SearchScope } from './searchTypes';

export interface SearchContextValue {
  enabled: boolean;
  adapter?: PageSearchAdapter;
  scopes: SearchScope[];
  identity: string;
  register: (key: string, adapter: PageSearchAdapter) => void;
  unregister: (key: string) => void;
  setQuery: (query: string) => void;
}
export const SearchContext = createContext<SearchContextValue | null>(null);
export const useContextualSearch = () => useContext(SearchContext);
