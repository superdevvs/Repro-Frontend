import React, { useEffect, useState } from 'react';
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
import type { SearchResult } from './searchTypes';

export function GlobalCommandBar(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const search = useContextualSearch();
  return search?.enabled ? <ContextualCommandBar {...props} /> : <LegacyGlobalCommandBar {...props} />;
}

function ContextualCommandBar({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const search = useContextualSearch()!;
  const navigate = useNavigate();
  const [everywhere, setEverywhere] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [preview, setPreview] = useState<SearchResult | null>(null);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const current = search.adapter;
  const pageGlobal = current?.scope === 'everywhere';
  const isGlobal = everywhere || !current || pageGlobal;
  const query = isGlobal && !pageGlobal ? globalQuery : current!.query;
  const [debounced, setDebounced] = useState(query.trim());
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(query.trim()), 250); return () => clearTimeout(timer); }, [query]);
  useEffect(() => { setPreview(null); }, [query, current?.id, isGlobal]);
  useEffect(() => { setPreview(null); setGlobalQuery(''); setEverywhere(false); }, [search.identity]);
  useEffect(() => { if (!open) setEverywhere(false); }, [open]);
  useEffect(() => {
    if (commandsOpen) return;
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); onOpenChange(true); }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [onOpenChange, commandsOpen]);
  const scope = isGlobal ? 'everywhere' : current.scope;
  const filters = isGlobal ? {} : current.filters ?? {};
  const local = !isGlobal && current.results !== undefined;
  const results = useQuery({
    queryKey: ['contextual-search', search.identity, scope, debounced, filters],
    queryFn: ({ signal }) => contextualSearch.search(scope, debounced, filters, 1, signal),
    enabled: open && !!debounced && query.trim() === debounced && !local,
    staleTime: 0, retry: false,
  });
  const detail = useQuery({
    queryKey: ['contextual-search-preview', search.identity, preview?.type, preview?.id, debounced, filters],
    queryFn: ({ signal }) => contextualSearch.preview(preview!.type, preview!.id, debounced, filters, signal),
    enabled: !!preview && (!local || preview.type === 'accounts') && preview.type !== 'navigation', retry: false, staleTime: 0,
  });
  const navigation = searchNavigation(search.scopes, query).slice(0, 6);
  const groups = local ? [{ scope, label: current.label, results: current.results!.slice(0, 8), hasMore: current.results!.length > 8, error: undefined }]
    : query.trim() === debounced ? results.data?.groups ?? [] : [];
  const busy = !!query.trim() && (query.trim() !== debounced || (local ? current.loading : results.isFetching));
  const failed = local ? current.error : results.isError;
  const setQuery = (value: string) => isGlobal && !pageGlobal ? setGlobalQuery(value.slice(0, 200)) : search.setQuery(value);
  const openResult = (result: SearchResult) => {
    onOpenChange(false);
    if (!isGlobal && result.type !== 'navigation' && current.onResultOpen) current.onResultOpen(result);
    else navigate(result.destination, { state: searchResultState(result) });
  };
  const showAll = (type?: string) => {
    if (isGlobal) { onOpenChange(false); navigate(`/search?search=${encodeURIComponent(query)}${type ? `&scope=${encodeURIComponent(type)}` : ''}`); }
    else { onOpenChange(false); requestAnimationFrame(() => document.querySelector<HTMLElement>('main')?.focus()); }
  };
  const expanded = detail.data ?? preview;
  return <><Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[85dvh] sm:w-[92vw] sm:max-w-4xl sm:rounded-2xl">
      <DialogTitle className="sr-only">Search {isGlobal ? 'everywhere' : current.label}</DialogTitle>
      <DialogDescription className="sr-only">Search permitted records, preview information, or open a result.</DialogDescription>
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3 pr-12 text-sm">
        <Search className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate font-medium">{isGlobal ? 'Everywhere' : current.label}</span>
        <Button size="sm" variant="ghost" aria-label="Commands" onClick={() => { onOpenChange(false); setCommandsOpen(true); }}><CommandIcon className="h-4 w-4 sm:hidden" /><span className="hidden sm:inline">Commands</span></Button>
        {current && !pageGlobal && <Button size="sm" variant="outline" onClick={() => { if (!everywhere) setGlobalQuery(current.query); setEverywhere(!everywhere); }}>{isGlobal ? `Search ${current.label}` : 'Everywhere'}</Button>}
      </div>
      {!isGlobal && Object.keys(filters).length > 0 && <p className="border-b px-4 py-2 text-xs text-muted-foreground">Current page filters apply. Use Everywhere to search other workspaces.</p>}
      <Command shouldFilter={false} className="min-h-0 flex-1">
        <div className="relative"><CommandInput placeholder={`Search ${isGlobal ? 'everywhere' : current.label.toLowerCase()}…`} value={query} onValueChange={setQuery} maxLength={200} autoFocus />{query && <button className="absolute right-3 top-3" aria-label="Clear search" onClick={() => setQuery('')}><X className="h-4 w-4" /></button>}</div>
        <CommandList className="max-h-none flex-1 overflow-y-auto sm:max-h-[50dvh]">
          {busy && <p role="status" className="p-4 text-sm text-muted-foreground">Searching…</p>}
          {failed && <div role="alert" className="p-4 text-sm">Search could not load. {local ? 'Refresh the page to retry.' : <button className="underline" onClick={() => void results.refetch()}>Retry</button>}</div>}
          {!!query.trim() && <CommandGroup><CommandItem value="show-all-results" onSelect={() => showAll()}><Search className="mr-2 h-4 w-4" />{isGlobal ? 'Show all matches' : `Show matches in ${current.label}`}</CommandItem></CommandGroup>}
          {!busy && groups.map(group => <CommandGroup key={group.scope} heading={group.label}>
            {group.error && <p role="alert" className="px-2 py-3 text-sm text-muted-foreground">This workspace could not be searched. Other results are available.</p>}
            {group.results.map(result => <CommandItem key={`${result.type}:${result.id}`} value={`${result.type}:${result.id}`} onSelect={() => openResult(result)} className="gap-3 py-3">
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{result.title}</p>{result.subtitle && <p className="truncate text-xs text-muted-foreground">{result.subtitle}</p>}{result.excerpt && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{result.excerpt}</p>}{!!result.badges?.length && <p className="mt-1 text-xs text-muted-foreground">{result.badges.join(' · ')}</p>}</div>
              <button type="button" aria-label={`Preview ${result.title}`} className="rounded-md p-2 hover:bg-muted focus-visible:ring-2" onClick={event => { event.stopPropagation(); setPreview(result); }} onKeyDown={event => event.stopPropagation()}><Info className="h-4 w-4" /></button>
            </CommandItem>)}
            {group.hasMore && <CommandItem value={`more:${group.scope}`} onSelect={() => showAll(group.scope)}>Show more {group.label.toLowerCase()} matches</CommandItem>}
          </CommandGroup>)}
          {!busy && !failed && query.trim() && !groups.some(group => group.results.length || group.error) && <p role="status" className="p-4 text-sm text-muted-foreground">No matches {isGlobal ? 'in your permitted workspaces' : 'with the current page filters'}.</p>}
          {navigation.length > 0 && <CommandGroup heading="Pages and sections">{navigation.map(result => <CommandItem key={result.id} value={`navigation:${result.id}`} onSelect={() => openResult(result)}>{result.title}</CommandItem>)}</CommandGroup>}
        </CommandList>
      </Command>
      {expanded && <section aria-label={`Preview ${expanded.title}`} className="max-h-[35dvh] shrink-0 overflow-y-auto border-t bg-muted/30 p-4">
        <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h3 className="font-semibold">{expanded.title}</h3><p className="text-sm text-muted-foreground">{expanded.subtitle}</p></div><Button variant="ghost" size="icon" aria-label="Close preview" onClick={() => setPreview(null)}><X className="h-4 w-4" /></Button></div>
        {detail.isFetching && <p role="status" className="py-2 text-xs">Loading details…</p>}
        {detail.isError && <p role="alert" className="py-2 text-xs">Details are unavailable. Access may have changed.</p>}
        {!detail.isError && <dl className="my-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">{Object.entries(expanded.metadata ?? {}).filter(([, value]) => value !== null && value !== '').map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl>}
        <Button variant="outline" size="sm" onClick={() => openResult(expanded)}>Open record<ExternalLink className="ml-2 h-3 w-3" /></Button>
      </section>}
    </DialogContent>
  </Dialog>{commandsOpen && <LegacyGlobalCommandBar open={commandsOpen} onOpenChange={setCommandsOpen} />}</>;
}
