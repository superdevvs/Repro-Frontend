import React, { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Command as CommandIcon, ExternalLink, Info, Search, X } from 'lucide-react';
import { Command, CommandInput, CommandItem, CommandList, CommandGroup } from '@/components/ui/command';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { contextualSearch } from '@/services/contextualSearch';
import { LegacyGlobalCommandBar } from './LegacyGlobalCommandBar';
import { useContextualSearch } from './searchContext';
import { searchNavigation } from './searchNavigation';
import { searchResultState } from './searchResultState';
import { contextualSearchQueryOptions } from './searchQueryOptions';
import { SearchProgress } from './SearchProgress';
import { RecentSearches } from './RecentSearches';
import { useRecentSearches, type RecentSearchEntry } from './useRecentSearches';
import { SearchScopeTabs } from './SearchScopeTabs';
import { useShootEditorViewport } from '@/components/shoots/useShootEditorViewport';
import type { SearchResult } from './searchTypes';
import './SearchDialog.css';

export function GlobalCommandBar(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const search = useContextualSearch();
  return search?.enabled ? <ContextualCommandBar key={search.identity} {...props} /> : <LegacyGlobalCommandBar {...props} />;
}

function ContextualCommandBar({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const search = useContextualSearch()!;
  const recent = useRecentSearches(search.identity);
  const navigate = useNavigate();
  const [selectedScope, setSelectedScope] = useState<string | null>(null);
  const [globalQuery, setGlobalQuery] = useState('');
  const [preview, setPreview] = useState<SearchResult | null>(null);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const current = search.adapter;
  const pageGlobal = current?.scope === 'everywhere';
  const scopes = search.scopes.filter(item => !item.local && item.id !== 'everywhere');
  const selectionAllowed = selectedScope === null || selectedScope === 'everywhere' || scopes.some(item => item.id === selectedScope);
  const selection = selectionAllowed ? selectedScope : null;
  const isPage = selection === null && !!current && !pageGlobal;
  const usesPageQuery = selection === null && !!current;
  const query = usesPageQuery ? current.query : globalQuery;
  const scope = isPage ? current.scope : selection ?? 'everywhere';
  const scopeLabel = isPage ? current.label : scope === 'everywhere' ? 'Everywhere' : scopes.find(item => item.id === scope)?.label ?? 'Everywhere';
  const activeTab = isPage ? 'page' : scope;
  const panelId = `${useId()}-search-results`;
  const viewport = useShootEditorViewport(open);
  const tabs = [{ id: 'everywhere', label: 'All' }, ...(current && !pageGlobal ? [{ id: 'page', label: 'This page' }] : []), ...scopes];
  const [debounced, setDebounced] = useState(query.trim());
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(query.trim()), 150); return () => clearTimeout(timer); }, [query]);
  useEffect(() => { setPreview(null); }, [query, current?.id, selection]);
  useEffect(() => { if (!selectionAllowed) setSelectedScope(null); }, [selectionAllowed]);
  useEffect(() => { if (!open) { setSelectedScope(null); setPreview(null); } }, [open]);
  useEffect(() => {
    if (commandsOpen) return;
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); onOpenChange(true); }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [onOpenChange, commandsOpen]);
  const filters = isPage ? current.filters ?? {} : {};
  const local = isPage && current.results !== undefined;
  const results = useQuery({
    ...contextualSearchQueryOptions(search.identity, scope, query, filters),
    enabled: open && !!debounced && query.trim() === debounced && !local,
  });
  const detail = useQuery({
    queryKey: ['contextual-search-preview', search.identity, preview?.type, preview?.id, query.trim(), filters],
    queryFn: ({ signal }) => contextualSearch.preview(preview!.type, preview!.id, query.trim(), filters, signal),
    enabled: open && !!preview && (!local || preview.type === 'accounts') && preview.type !== 'navigation', retry: false, staleTime: 0,
  });
  const navigation = searchNavigation(search.scopes, query)
    .filter(result => scope === 'everywhere' || scope === 'navigation' || result.id === scope).slice(0, 6);
  const groups = local ? [{ scope, label: current.label, results: current.results!.slice(0, 8), hasMore: current.results!.length > 8, error: undefined }]
    : results.data?.groups ?? [];
  const busy = !!query.trim() && (local ? current.loading : !results.data && (query.trim() !== debounced || results.isFetching));
  const failed = local ? current.error : results.isError;
  const setQuery = (value: string) => usesPageQuery ? search.setQuery(value) : setGlobalQuery(value.slice(0, 200));
  const selectTab = (id: string) => {
    if (id === activeTab) return;
    if (id === 'page') setSelectedScope(null);
    else if (pageGlobal && id === 'everywhere') { search.setQuery(query); setSelectedScope(null); }
    else {
      if (usesPageQuery) setGlobalQuery(query);
      setSelectedScope(id);
    }
  };
  const openResult = (result: SearchResult) => {
    if (result.type !== 'navigation') recent.remember(query, scope, scopeLabel);
    onOpenChange(false);
    if (isPage && result.type !== 'navigation' && current.onResultOpen) current.onResultOpen(result);
    else navigate(result.destination, { state: searchResultState(result) });
  };
  const showAll = (type?: string) => {
    const target = type ?? scope;
    recent.remember(query, target, type ? scopes.find(item => item.id === type)?.label ?? type : scopeLabel);
    if (!isPage) { onOpenChange(false); navigate(`/search?search=${encodeURIComponent(query)}${target !== 'everywhere' ? `&scope=${encodeURIComponent(target)}` : ''}`); }
    else { onOpenChange(false); requestAnimationFrame(() => document.querySelector<HTMLElement>('main')?.focus()); }
  };
  const repeatSearch = (entry: RecentSearchEntry) => {
    recent.remember(entry.query, entry.scope, entry.label);
    if (current && !pageGlobal && entry.scope === current.scope) {
      setSelectedScope(null);
      search.setQuery(entry.query);
    } else if (pageGlobal && entry.scope === 'everywhere') { setSelectedScope(null); search.setQuery(entry.query); }
    else { setSelectedScope(scopes.some(item => item.id === entry.scope) ? entry.scope : 'everywhere'); setGlobalQuery(entry.query); }
  };
  const expanded = detail.data ?? preview;
  return <><Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="search-dialog flex flex-col gap-0 p-0 [&>button:last-child]:top-3" style={viewport.style} data-search-layout={viewport.layout} data-search-short={viewport.short}>
      <DialogTitle className="sr-only">Search {scope === 'everywhere' ? 'everywhere' : scopeLabel}</DialogTitle>
      <DialogDescription className="sr-only">Search permitted records, preview information, or open a result.</DialogDescription>
      <Command shouldFilter={false} label={`Search ${scopeLabel}`} role="tabpanel" id={panelId} aria-labelledby={`${panelId}-tab-${encodeURIComponent(activeTab)}`} className="min-h-0 flex-1 rounded-none">
        <div className="relative shrink-0">
          <CommandInput className="h-14 pr-28 text-base" placeholder={`Search ${scopeLabel.toLowerCase()}…`} value={query} onValueChange={setQuery} maxLength={200} autoFocus />
          {query && <button className="absolute right-20 top-1.5 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label="Clear search" onKeyDown={event => event.stopPropagation()} onClick={() => setQuery('')}><X className="h-4 w-4" /></button>}
          <Button size="icon" variant="ghost" aria-label="Commands" className="absolute right-10 top-2 h-10 w-10 text-muted-foreground" onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation(); }} onClick={() => { onOpenChange(false); setCommandsOpen(true); }}><CommandIcon className="h-4 w-4" /></Button>
        </div>
        {isPage && <p className="shrink-0 border-b px-4 py-2 text-xs text-muted-foreground">Searching in {current.label}.{Object.keys(filters).length > 0 && ' Current page filters apply.'} Choose All to search other workspaces.</p>}
        <CommandList aria-busy={Boolean(busy)} className="min-h-0 max-h-none flex-1 overflow-y-auto">
          {busy && <SearchProgress compact />}
          {failed && <div role="alert" className="p-4 text-sm">Search could not load. {local ? 'Refresh the page to retry.' : <button className="underline" onClick={() => void results.refetch()}>Retry</button>}</div>}
          {!!query.trim() && <CommandGroup><CommandItem value="show-all-results" onSelect={() => showAll()}><Search className="mr-2 h-4 w-4" />{isPage ? `Show matches in ${current.label}` : scope === 'everywhere' ? 'Show all matches' : `Show all ${scopeLabel.toLowerCase()} matches`}</CommandItem></CommandGroup>}
          {!query.trim() && <RecentSearches command entries={recent.entries} onSelect={repeatSearch} onRemove={recent.remove} onClear={recent.clear} />}
          {!busy && groups.map(group => <CommandGroup key={group.scope} heading={group.label}>
            {group.error && <p role="alert" className="px-2 py-3 text-sm text-muted-foreground">This workspace could not be searched. Other results are available.</p>}
            {group.results.map(result => <CommandItem key={`${result.type}:${result.id}`} value={`${result.type}:${result.id}`} onSelect={() => openResult(result)} className="gap-3 py-3">
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{result.title}</p>{result.subtitle && <p className="truncate text-xs text-muted-foreground">{result.subtitle}</p>}{result.excerpt && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{result.excerpt}</p>}{!!result.badges?.length && <p className="mt-1 text-xs text-muted-foreground">{result.badges.join(' · ')}</p>}</div>
              <button type="button" aria-label={`Preview ${result.title}`} className="rounded-md p-2 hover:bg-muted focus-visible:ring-2" onClick={event => { event.stopPropagation(); setPreview(result); }} onKeyDown={event => event.stopPropagation()}><Info className="h-4 w-4" /></button>
            </CommandItem>)}
            {group.hasMore && <CommandItem value={`more:${group.scope}`} onSelect={() => showAll(group.scope)}>Show more {group.label.toLowerCase()} matches</CommandItem>}
          </CommandGroup>)}
          {!busy && !failed && query.trim() && (local || results.data) && !groups.some(group => group.results.length || group.error) && <p role="status" className="p-4 text-sm text-muted-foreground">No matches {isPage ? 'with the current page filters' : 'in your permitted workspaces'}.</p>}
          {navigation.length > 0 && <CommandGroup heading="Pages and sections">{navigation.map(result => <CommandItem key={result.id} value={`navigation:${result.id}`} onSelect={() => openResult(result)}>{result.title}</CommandItem>)}</CommandGroup>}
        </CommandList>
      </Command>
      {expanded && <section aria-label={`Preview ${expanded.title}`} className="max-h-[30%] shrink-0 overflow-y-auto border-t bg-muted/30 p-4">
        <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h3 className="font-semibold">{expanded.title}</h3><p className="text-sm text-muted-foreground">{expanded.subtitle}</p></div><Button variant="ghost" size="icon" aria-label="Close preview" onClick={() => setPreview(null)}><X className="h-4 w-4" /></Button></div>
        {detail.isFetching && <p role="status" className="py-2 text-xs">Loading details…</p>}
        {detail.isError && <p role="alert" className="py-2 text-xs">Details are unavailable. Access may have changed.</p>}
        {!detail.isError && <dl className="my-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">{Object.entries(expanded.metadata ?? {}).filter(([, value]) => value !== null && value !== '').map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl>}
        <Button variant="outline" size="sm" onClick={() => openResult(expanded)}>Open record<ExternalLink className="ml-2 h-3 w-3" /></Button>
      </section>}
      <SearchScopeTabs tabs={tabs} value={activeTab} onValueChange={selectTab} controlsId={panelId} />
    </DialogContent>
  </Dialog>{commandsOpen && <LegacyGlobalCommandBar open={commandsOpen} onOpenChange={setCommandsOpen} />}</>;
}
