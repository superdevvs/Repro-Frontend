import React, { useEffect, useId, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { useContextualSearch } from './searchContext';
import type { SearchResult } from './searchTypes';

type PageSearchProps = React.ComponentProps<typeof Input> & {
  searchId: string;
  scope: string;
  scopeLabel: string;
  filters?: Record<string, unknown>;
  searchResults?: SearchResult[];
  searchLoading?: boolean;
  searchError?: boolean;
  priority?: number;
  active?: boolean;
  onResultOpen?: (result: SearchResult) => void;
};

/** A controlled page filter binding. It falls back to the original input until the server enables search. */
export function PageSearch({ searchId, scope, scopeLabel, filters, searchResults, searchLoading, searchError, priority, active = true, onResultOpen,
  value, onChange, ...input }: PageSearchProps) {
  const search = useContextualSearch();
  const key = useId();
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const openRef = useRef(onResultOpen);
  openRef.current = onResultOpen;
  const openResult = useMemo(() => (result: SearchResult) => openRef.current?.(result), []);
  const hasOpener = Boolean(onResultOpen);
  const onQueryChange = useMemo(() => (query: string) => {
    changeRef.current?.({ target: { value: query }, currentTarget: { value: query } } as React.ChangeEvent<HTMLInputElement>);
  }, []);
  const register = search?.register;
  const unregister = search?.unregister;
  const identity = search?.identity;
  const filterKey = JSON.stringify(filters ?? {});
  const stableFilters = useMemo(() => JSON.parse(filterKey) as Record<string, unknown>, [filterKey]);
  const resultKey = JSON.stringify(searchResults);
  const stableResults = useMemo(() => resultKey === undefined ? undefined : JSON.parse(resultKey) as SearchResult[], [resultKey]);
  useEffect(() => {
    if (!active) { unregister?.(key); return; }
    register?.(key, { id: searchId, scope, label: scopeLabel, query: String(value ?? ''), onQueryChange,
      filters: stableFilters, results: stableResults, loading: searchLoading, error: searchError, priority,
      onResultOpen: hasOpener ? openResult : undefined });
  }, [register, unregister, identity, active, key, searchId, scope, scopeLabel, value, onQueryChange, stableFilters, stableResults, searchLoading, searchError, priority, hasOpener, openResult]);
  useEffect(() => () => unregister?.(key), [unregister, key]);
  if (search?.enabled) return <span hidden data-page-search-binding />;
  return <Input {...input} value={value} onChange={onChange} />;
}
