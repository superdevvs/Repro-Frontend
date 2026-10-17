import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { PageSearch } from '@/components/search/PageSearch';
import { contextualSearch } from '@/services/contextualSearch';
import { useContextualSearch } from '@/components/search/searchContext';
import { searchResultState } from '@/components/search/searchResultState';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('search') ?? '';
  const scope = params.get('scope') ?? 'everywhere';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const search = useContextualSearch();
  const [draft, setDraft] = useState(query);
  useEffect(() => { setDraft(query); }, [query]);
  useEffect(() => { if (draft === query) return; const timer = setTimeout(() => setParams({ search: draft, scope }), 250); return () => clearTimeout(timer); }, [draft, query, scope, setParams]);
  const results = useQuery({ queryKey: ['contextual-search-full', search?.identity, scope, query, page],
    queryFn: ({ signal }) => contextualSearch.search(scope, query, {}, page, signal), enabled: !!search?.enabled && !!query.trim(), retry: false });
  return <DashboardLayout><div className="mx-auto w-full max-w-5xl space-y-4">
    <PageHeader title="Search results" description="Results from workspaces you can access." />
    <div className="flex flex-wrap gap-2"><PageSearch searchId={`global-results-${scope}`} scope={scope} scopeLabel={scope === "everywhere" ? "Everywhere" : search?.scopes.find(item => item.id === scope)?.label ?? "Results"} aria-label="Search everywhere" placeholder="Search everywhere…" value={draft} maxLength={200} onChange={event => setDraft(event.target.value)} className="min-w-0 flex-1" /><select aria-label="Result type" className="rounded-md border bg-background px-3" value={scope} onChange={event => setParams({ search: query, scope: event.target.value })}><option value="everywhere">Everywhere</option>{search?.scopes.filter(item => !item.local).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
    {!search?.enabled && <p>Search is not available yet.</p>}
    {results.isLoading && <p role="status">Searching…</p>}{results.isError && <p role="alert">Search could not load. <button onClick={() => void results.refetch()}>Retry</button></p>}
    {results.data?.groups.map(group => <section key={group.scope} className="rounded-xl border p-4"><h2 className="mb-2 font-semibold">{group.label}</h2>{group.error && <p role="alert">This workspace could not be searched.</p>}{group.results.map(result => <Link key={`${result.type}:${result.id}`} to={result.destination} state={searchResultState(result)} className="block border-t py-3 hover:bg-muted/30"><p className="font-medium">{result.title}</p><p className="text-sm text-muted-foreground">{result.subtitle}</p>{result.excerpt && <p className="line-clamp-2 text-sm">{result.excerpt}</p>}</Link>)}{!group.results.length && !group.error && <p className="text-sm text-muted-foreground">No matches.</p>}{group.hasMore && scope === 'everywhere' && <Button variant="outline" onClick={() => setParams({ search: query, scope: group.scope })}>Show all {group.label.toLowerCase()}</Button>}</section>)}
    {scope !== 'everywhere' && <div className="flex items-center gap-3"><Button variant="outline" disabled={page <= 1} onClick={() => setParams({ search: query, scope, page: String(page - 1) })}>Previous</Button><span>Page {page}</span><Button variant="outline" disabled={!results.data?.groups.some(group => group.hasMore)} onClick={() => setParams({ search: query, scope, page: String(page + 1) })}>Next</Button></div>}
  </div></DashboardLayout>;
}
