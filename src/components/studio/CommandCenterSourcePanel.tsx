import { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Images,
  Loader2,
  Search,
  UploadCloud,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { resolveGeneratedAsset } from '@/lib/studioAssets';
import {
  studioService,
  type StudioShootRef,
} from '@/services/studioService';

export interface CommandCenterSourcePanelProps {
  selectedShoot: StudioShootRef | null;
  onShootSelect: (shoot: StudioShootRef) => void;
  onChooseMedia: () => void;
}

export function CommandCenterSourcePanel({
  selectedShoot,
  onShootSelect,
  onChooseMedia,
}: CommandCenterSourcePanelProps) {
  const thumbnail = resolveGeneratedAsset('selected-shoot');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [shoots, setShoots] = useState<StudioShootRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const normalized = query.trim();
    if (!pickerOpen || normalized.length < 2) {
      setShoots([]);
      setLoading(false);
      setSearchError(null);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setSearchError(null);
      studioService
        .searchShoots(normalized)
        .then((results) => {
          if (active) setShoots(results);
        })
        .catch(() => {
          if (active) {
            setShoots([]);
            setSearchError('Properties could not be loaded. Try the search again.');
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [pickerOpen, query]);

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 rounded-xl border border-border bg-card p-3.5">
      <div>
        <p className="text-xs font-medium text-foreground">Select a shoot</p>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Choose a property"
              aria-expanded={pickerOpen}
              className="mt-2 flex h-11 w-full items-center gap-2 rounded-lg border border-border bg-background/70 px-2.5 text-left transition-colors hover:border-primary/50"
            >
              <span className="h-7 w-10 shrink-0 overflow-hidden rounded bg-muted">
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center">
                    <Images className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-medium">
                {selectedShoot?.label ?? 'Choose a property'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={6}
            className="studio-theme w-[var(--radix-popover-trigger-width)] min-w-[17rem] overflow-hidden p-0"
          >
            <div className="relative border-b border-border">
              <Search
                className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 rounded-none border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
                placeholder="Search address or property ID"
                aria-label="Search properties"
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-1.5">
              {query.trim().length < 2 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Type at least 2 characters to find a property.
                </p>
              ) : loading ? (
                <p className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Finding properties…
                </p>
              ) : searchError ? (
                <p className="px-3 py-6 text-center text-xs text-destructive">
                  {searchError}
                </p>
              ) : shoots.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No matching properties found.
                </p>
              ) : (
                <ul role="listbox" aria-label="Matching properties">
                  {shoots.map((shoot) => {
                    const selected = shoot.id === selectedShoot?.id;
                    return (
                      <li key={shoot.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted"
                          onClick={() => {
                            onShootSelect(shoot);
                            setPickerOpen(false);
                            setQuery('');
                          }}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium">
                              {shoot.label}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {shoot.location || shoot.address || shoot.propertyIdentifier}
                            </span>
                          </span>
                          {selected ? (
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <button
        type="button"
        className="flex min-h-24 flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/30 px-3 text-center transition-colors hover:border-primary/60 hover:bg-primary/5"
        onClick={onChooseMedia}
      >
        <UploadCloud className="h-7 w-7 text-primary" aria-hidden="true" />
        <span className="mt-2 text-xs font-medium">Upload or drop media here</span>
        <span className="mt-1 text-[10px] text-muted-foreground">JPG, PNG, RAW, MP4</span>
      </button>

      <Button type="button" size="sm" className="w-full" onClick={onChooseMedia}>
        Choose media
      </Button>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Images className="h-3.5 w-3.5" aria-hidden="true" />
          Shoot or upload
        </span>
        <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="Ready" />
      </div>
    </section>
  );
}

export default CommandCenterSourcePanel;
