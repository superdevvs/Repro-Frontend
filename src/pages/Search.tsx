import React, { useEffect, useState } from 'react';
import { usePaginationScrollReset } from '@/hooks/usePaginationScrollReset';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { PageSearch } from '@/components/search/PageSearch';
import { useContextualSearch } from '@/components/search/searchContext';
import { searchResultState } from '@/components/search/searchResultState';
import { contextualSearchQueryOptions } from '@/components/search/searchQueryOptions';
import { SearchProgress } from '@/components/search/SearchProgress';
import { RecentSearches } from '@/components/search/RecentSearches';
import { useRecentSearches } from '@/components/search/useRecentSearches';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = (params.get('search') ?? '').slice(0, 200);
  const scope = params.get('scope') ?? 'everywhere';
  const page = Math.max(1, Math.min(10_000, Math.floor(Number(params.get('page')) || 1)));
  const search = useContextualSearch();
  const [draft, setDraft] = useState(query);
  const [debounced, setDebounced] = useState(query.trim());
  const history = useRecentSearches(search?.identity ?? '');
  const scopeLabel = scope === 'everywhere' ? 'Everywhere' : search?.scopes.find(item => item.id === scope)?.label ?? 'Results';
  useEffect(() => { setDraft(query); }, [query]);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(draft.trim()), 150);
    return () => clearTimeout(timer);
  }, [draft]);
  useEffect(() => {
    if (draft === query) return;
    const timer = setTimeout(() => setParams({ search: draft, scope }, { replace: true }), 150);
    return () => clearTimeout(timer);
  }, [draft, query, scope, setParams]);
  const term = query.trim();
  const currentQuery = draft.trim() === term;
  const settled = currentQuery && debounced === term;
  const results = useQuery({
    ...contextualSearchQueryOptions(search?.identity ?? '', scope, term, {}, page),
    enabled: !!search?.enabled && !!term && settled,
  });
  const groups = search?.enabled && currentQuery && term ? results.data?.groups ?? [] : [];
  const busy = !!search?.enabled && !!draft.trim() && (!currentQuery || (!results.data && !settled) || results.isFetching);
  const failed = currentQuery && !!term && results.isError;
  const paginationListRef = usePaginationScrollReset(page, { isLoading: busy });
  const remember = () => history.remember(term, scope, scopeLabel);
  return <DashboardLayout><div ref={paginationListRef} data-pagination-list className="mx-auto w-full max-w-5xl space-y-4">
    <PageHeader title="Search results" description="Results from workspaces you can access." />
    <div className="flex flex-wrap gap-2">
      <PageSearch searchId={`global-results-${scope}`} scope={scope} scopeLabel={scopeLabel} aria-label="Search everywhere" placeholder="Search everywhere…" value={draft} maxLength={200} onChange={event => setDraft(event.target.value)} className="min-w-0 flex-1" />
      <select aria-label="Result type" className="min-h-10 rounded-md border bg-background px-3" value={scope} onChange={event => setParams({ search: draft, scope: event.target.value })}>
        <option value="everywhere">Everywhere</option>{search?.scopes.filter(item => !item.local).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </div>
    {!search?.enabled && <p>Search is not available yet.</p>}
    {search?.enabled && !draft.trim() && <RecentSearches entries={history.entries} onSelect={entry => {
      const nextScope = entry.scope === 'everywhere' || search.scopes.some(item => !item.local && item.id === entry.scope) ? entry.scope : 'everywhere';
      history.remember(entry.query, nextScope, nextScope === 'everywhere' ? 'Everywhere' : entry.label);
      setParams({ search: entry.query, scope: nextScope });
    }} onRemove={history.remove} onClear={history.clear} />}
    {busy && <SearchProgress compact={groups.length > 0} label={groups.length ? 'Updating results…' : 'Searching your workspaces…'} />}
    {failed && <p role="alert">Search could not load. <button className="underline" onClick={() => void results.refetch()}>Retry</button></p>}
    <div aria-busy={busy} className="space-y-4">
      {groups.map(group => <section key={group.scope} className="rounded-xl border p-4">
        <h2 className="mb-2 font-semibold">{group.label}</h2>
        {group.error && <p role="alert">This workspace could not be searched. <button className="underline" onClick={() => void results.refetch()}>Retry</button></p>}
        {group.results.map(result => <Link key={`${result.type}:${result.id}`} to={result.destination} state={searchResultState(result)} onClick={remember} className="block rounded-md border-t py-3 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <p className="break-words font-medium">{result.title}</p><p className="break-words text-sm text-muted-foreground">{result.subtitle}</p>{result.excerpt && <p className="line-clamp-2 break-words text-sm">{result.excerpt}</p>}
        </Link>)}
        {!group.results.length && !group.error && <p className="text-sm text-muted-foreground">No matches.</p>}
        {group.hasMore && scope === 'everywhere' && <Button variant="outline" onClick={() => { remember(); setParams({ search: query, scope: group.scope }); }}>Show all {group.label.toLowerCase()}</Button>}
      </section>)}
    </div>
    {!busy && !failed && search?.enabled && !!term && settled && results.isSuccess && !groups.length && <p role="status" className="py-8 text-center text-sm text-muted-foreground">No matches in your permitted workspaces.</p>}
    {scope !== 'everywhere' && !!term && settled && groups.length > 0 && <div className="flex items-center gap-3">
      <Button variant="outline" disabled={page <= 1 || busy} onClick={() => setParams({ search: query, scope, page: String(page - 1) })}>Previous</Button><span>Page {page}</span><Button variant="outline" disabled={busy || !groups.some(group => group.hasMore)} onClick={() => setParams({ search: query, scope, page: String(page + 1) })}>Next</Button>
    </div>}
  </div></DashboardLayout>;
}
