import { ArrowUpLeft, History, X } from 'lucide-react';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import type { RecentSearchEntry } from './useRecentSearches';

interface RecentSearchesProps {
  entries: RecentSearchEntry[];
  onSelect: (entry: RecentSearchEntry) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  /** Use command items inside a command palette, regular buttons on a results page. */
  command?: boolean;
}

export function RecentSearches({ entries, onSelect, onRemove, onClear, command = false }: RecentSearchesProps) {
  if (!entries.length) return null;
  const rows = entries.map(entry => {
    const content = <><History aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium">{entry.query}</span><span className="block truncate text-xs text-muted-foreground">{entry.label}</span></span><ArrowUpLeft aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /></>;
    return <div key={entry.id} className="flex items-center gap-1">
      {command ? <CommandItem value={`recent:${entry.id}`} onSelect={() => onSelect(entry)} className="min-w-0 flex-1 gap-3 rounded-lg px-3 py-2.5" aria-label={`Search again for ${entry.query} in ${entry.label}`}>{content}</CommandItem>
        : <button type="button" onClick={() => onSelect(entry)} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Search again for ${entry.query} in ${entry.label}`}>{content}</button>}
      <button type="button" aria-label={`Remove ${entry.query} from recent searches`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onKeyDown={event => event.stopPropagation()} onClick={() => onRemove(entry.id)}><X aria-hidden="true" className="h-3.5 w-3.5" /></button>
    </div>;
  });
  return <section aria-label="Recent searches" className="px-2 py-3">
    <div className="mb-1 flex items-center justify-between gap-3 px-3"><h2 className="text-xs font-medium text-muted-foreground">Recent searches</h2><button type="button" className="min-h-9 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onKeyDown={event => event.stopPropagation()} onClick={onClear}>Clear all</button></div>
    {command ? <CommandGroup className="p-0">{rows}</CommandGroup> : <div>{rows}</div>}
    <p className="mt-2 px-3 text-[11px] text-muted-foreground">Saved on this device.</p>
  </section>;
}
