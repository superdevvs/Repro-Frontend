import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStudioSearch } from '@/hooks/useStudio';
import { cn } from '@/lib/utils';
import type { SearchResult } from '@/services/studioService';

import { SectionError, SectionSkeleton } from './feedback/StudioFeedback';
import { useOptionalStudioShell } from './StudioShell';

export function nextStudioSearchIndex(
  current: number,
  key: 'ArrowDown' | 'ArrowUp' | 'Home' | 'End',
  count: number,
): number {
  if (count <= 0) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const normalized = current < 0 ? -1 : ((current % count) + count) % count;
  if (key === 'ArrowDown') return normalized < 0 ? 0 : (normalized + 1) % count;
  return normalized <= 0 ? count - 1 : normalized - 1;
}

export function StudioSearch({
  onSelect,
  className,
}: {
  onSelect?: (result: SearchResult) => void;
  className?: string;
}) {
  const shell = useOptionalStudioShell();
  const [value, setValue] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const search = useStudioSearch(query, { enabled: open });

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(value.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const results = useMemo(
    () => (search.data ?? []).flatMap((group) => group.results),
    [search.data],
  );

  const select = (result: SearchResult) => {
    onSelect?.(result);
    if (!onSelect) shell?.openDeepLink(result.deepLink);
    setOpen(false);
    setValue('');
    setActiveIndex(-1);
  };

  return (
    <div ref={rootRef} className={cn('relative w-full max-w-2xl', className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={value}
          role="combobox"
          aria-label="Search Studio projects, shoots, templates, workflows, and AI jobs"
          aria-expanded={open}
          aria-controls="studio-search-results"
          aria-activedescendant={activeIndex >= 0 ? `studio-search-result-${activeIndex}` : undefined}
          placeholder="Search Studio…"
          className="h-11 bg-background/70 pl-10 pr-10"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'ArrowDown' ||
              event.key === 'ArrowUp' ||
              event.key === 'Home' ||
              event.key === 'End'
            ) {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) =>
                nextStudioSearchIndex(
                  index,
                  event.key as 'ArrowDown' | 'ArrowUp' | 'Home' | 'End',
                  results.length,
                ),
              );
            } else if (event.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
              event.preventDefault();
              select(results[activeIndex]);
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
        {value ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
            aria-label="Clear Studio search"
            onClick={() => {
              setValue('');
              setQuery('');
              setActiveIndex(-1);
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      {open && query ? (
        <div
          id="studio-search-results"
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-2 max-h-[28rem] overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-2xl"
        >
          {search.isLoading ? (
            <SectionSkeleton label="Searching Studio" rows={3} />
          ) : search.isError ? (
            <SectionError
              title="Search is unavailable"
              message="Your current Studio view is unchanged."
              onRetry={() => search.refetch()}
            />
          ) : results.length === 0 ? (
            <p className="p-5 text-center text-sm text-muted-foreground">
              No authorized Studio records match “{query}”.
            </p>
          ) : (
            (search.data ?? []).map((group) => (
              <section key={group.recordType} aria-label={group.label}>
                <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {group.label}
                </p>
                {group.results.map((result) => {
                  const index = results.indexOf(result);
                  return (
                    <button
                      key={`${result.recordType}:${result.recordId}`}
                      id={`studio-search-result-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      className={cn(
                        'flex w-full items-center justify-between gap-4 rounded-lg px-3 py-3 text-left',
                        index === activeIndex
                          ? 'bg-primary/15 text-foreground'
                          : 'text-foreground hover:bg-muted',
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => select(result)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{result.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {result.context}
                        </span>
                      </span>
                      <CornerDownLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </button>
                  );
                })}
              </section>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export default StudioSearch;
