import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePermission } from '@/hooks/usePermission';
import { contextualSearch } from '@/services/contextualSearch';
import type { PageSearchAdapter } from './searchTypes';
import { SearchContext } from './searchContext';
import { getImpersonatedUserId } from '@/services/api';
import { searchNavigation } from './searchNavigation';

export function ContextualSearchProvider({ children }: { children: React.ReactNode }) {
  const { user, role, isAuthenticated } = useAuth();
  const { permissionIds } = usePermission();
  const identity = `${user?.id ?? ''}:${role}:${getImpersonatedUserId() ?? ''}:${JSON.stringify(permissionIds ?? [])}`;
  const location = useLocation();
  const navigate = useNavigate();
  const [adapters, setAdapters] = useState<Record<string, { route: string; identity: string; adapter: PageSearchAdapter }>>({});
  const [defaultQuery, setDefaultQuery] = useState('');
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const routeRef = useRef(location.pathname);
  routeRef.current = location.pathname;
  const remembered = useRef(new Map<string, string>());
  const configuration = useQuery({
    queryKey: ['contextual-search-scopes', identity],
    queryFn: ({ signal }) => contextualSearch.scopes(signal),
    enabled: Boolean(isAuthenticated && user?.id), retry: false, staleTime: 30_000,
  });
  const enabled = Boolean(configuration.data?.enabled);
  const register = useCallback((key: string, adapter: PageSearchAdapter) => {
    setAdapters(previous => ({ ...previous, [key]: { route: routeRef.current, identity: currentIdentity.current, adapter } }));
  }, []);
  const unregister = useCallback((key: string) => {
    setAdapters(previous => { const next = { ...previous }; delete next[key]; return next; });
  }, []);
  const boundAdapter = Object.values(adapters).filter(entry => entry.route === location.pathname && entry.identity === identity)
    .map(entry => entry.adapter).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
  const scopes = useMemo(() => configuration.data?.scopes ?? [], [configuration.data]);
  const defaults: Record<string, string> = { '/accounts': 'accounts', '/shoot-history': 'shoots', '/accounting': 'invoices', '/portal': 'listings', '/ai-editing': 'studio' };
  const fallbackScope = location.pathname.startsWith('/shoots/') ? 'shoots' : defaults[location.pathname];
  const fallbackAllowed = scopes.some(scope => scope.id === fallbackScope);
  const shootId = location.pathname.match(/^\/shoots\/(\d+)(?:\/|$)/)?.[1];
  const adapter: PageSearchAdapter | undefined = useMemo(() => boundAdapter ?? (location.pathname === '/dashboard' || location.pathname === '/search' ? undefined : {
    id: `page:${location.pathname}`, scope: fallbackAllowed ? fallbackScope : 'navigation',
    label: shootId ? `Shoot #${shootId}` : fallbackAllowed ? scopes.find(scope => scope.id === fallbackScope)!.label : 'Pages and sections', query: defaultQuery,
    ...(shootId ? { filters: { shoot_id: shootId } } : {}),
    onQueryChange: setDefaultQuery, ...(fallbackAllowed ? {} : { results: searchNavigation(scopes, defaultQuery) }),
  }), [boundAdapter, location.pathname, fallbackAllowed, fallbackScope, scopes, defaultQuery, shootId]);
  const adapterId = adapter?.id;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const identityRef = useRef(identity);
  if (identityRef.current !== identity) {
    identityRef.current = identity;
    remembered.current.clear();
  }
  const setQuery = useCallback((query: string) => {
    const current = adapterRef.current;
    if (!current) return;
    const nextQuery = query.slice(0, 200);
    remembered.current.set(`${location.pathname}:${current.id}`, nextQuery);
    current.onQueryChange(nextQuery);
    const params = new URLSearchParams(location.search);
    if (nextQuery) { params.set('search', nextQuery); params.set('searchContext', current.id); }
    else { params.delete('search'); params.delete('searchContext'); }
    params.delete('page');
    navigate({ pathname: location.pathname, search: params.toString(), hash: location.hash }, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);

  useEffect(() => {
    const adapter = adapterRef.current;
    if (!enabled || !adapterId || !adapter) return;
    const params = new URLSearchParams(location.search);
    const context = params.get('searchContext');
    if (context && context !== adapter.id) {
      const query = remembered.current.get(`${location.pathname}:${adapter.id}`) ?? '';
      if (query !== adapterRef.current?.query) adapterRef.current?.onQueryChange(query);
      return;
    }
    const key = `${location.pathname}:${adapter.id}`;
    const query = params.has('search') ? params.get('search')!.slice(0, 200) : (remembered.current.get(key) ?? '');
    if (query !== adapterRef.current?.query) adapterRef.current?.onQueryChange(query);
    remembered.current.set(key, query);
  }, [enabled, adapterId, location.pathname, location.search]);

  const value = useMemo(() => ({ enabled, adapter, identity, register, unregister, setQuery,
    scopes: configuration.data?.scopes ?? [],
  }), [enabled, adapter, identity, register, unregister, setQuery, configuration.data]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}
