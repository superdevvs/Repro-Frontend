import { useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, ChevronDown, Filter, RotateCcw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatWorkflowStatus } from '@/utils/status';
import { DATE_RANGE_OPTIONS, countActiveFilters, type FiltersState } from './shootsTabsCardUtils';
import { clearDashboardFilter, dashboardFilterVisibility, dashboardStatusOptions } from './dashboardFilterModel';

interface FilterOptions {
  role?: string;
  clientOptions: string[];
  photographerOptions: { id: number; name: string }[];
  serviceOptions: { key: string; label: string }[];
}

interface DashboardShootFiltersProps extends FilterOptions {
  open: boolean;
  title?: string;
  filters: FiltersState;
  draft: FiltersState;
  onDraftChange: Dispatch<SetStateAction<FiltersState>>;
  onApply: () => void;
  onCancel: () => void;
  onReset: () => void;
}

function Section({ title, summary, children, initiallyOpen = false }: {
  title: string; summary?: string; children: ReactNode; initiallyOpen?: boolean;
}) {
  return <details open={initiallyOpen || undefined} className="group border-b border-border/60 py-1 last:border-0">
    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-lg py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
      {title}<span className="ml-auto max-w-[55%] truncate text-xs font-normal text-muted-foreground">{summary}</span>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
    </summary>
    <div className="space-y-3 pb-4">{children}</div>
  </details>;
}

function Choice({ selected, children, onClick }: { selected: boolean; children: ReactNode; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onClick}
    className={cn('flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      selected ? 'border-primary/45 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground')}>
    {selected && <Check className="h-3 w-3 shrink-0" />}{children}
  </button>;
}

function SearchChoices({ label, options, selected, onSelect, single = false }: {
  label: string; options: { value: string; label: string }[]; selected: string[]; onSelect: (value: string) => void; single?: boolean;
}) {
  const [query, setQuery] = useState('');
  const visible = options.filter(option => option.label.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="space-y-2">
    <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      <Input aria-label={`Search ${label}`} placeholder={`Search ${label.toLowerCase()}…`} value={query} onChange={event => setQuery(event.target.value)} className="h-10 rounded-xl pl-9" />
    </div>
    <div className="max-h-48 space-y-1 overflow-y-auto overscroll-contain rounded-xl border border-border/70 p-1" role="group" aria-label={label}>
      {visible.map(option => <label key={option.value} className={cn('flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm hover:bg-muted', selected.includes(option.value) && 'bg-primary/10 text-primary')}>
        <input type={single ? 'radio' : 'checkbox'} name={single ? `dashboard-filter-${label}` : undefined} checked={selected.includes(option.value)} onChange={() => onSelect(option.value)} className="h-4 w-4 shrink-0 accent-primary" />
        <span className="min-w-0 break-words">{option.label}</span>
      </label>)}
      {!visible.length && <p className="px-3 py-4 text-center text-xs text-muted-foreground">{options.length ? 'No matches. Try another search.' : `No ${label.toLowerCase()} in this view.`}</p>}
    </div>
  </div>;
}

const toggle = <T,>(values: T[], value: T) => values.includes(value) ? values.filter(item => item !== value) : [...values, value];

export function DashboardShootFilters({ open, title = 'Filter shoots', role, filters, draft, onDraftChange, onApply, onCancel, onReset, clientOptions, photographerOptions, serviceOptions }: DashboardShootFiltersProps) {
  const visibility = dashboardFilterVisibility(role);
  const returnFocus = useRef<HTMLElement | null>(null);
  const count = countActiveFilters(draft);
  const invalidRange = draft.dateRange === 'custom' && (!draft.customRange.from || !draft.customRange.to || draft.customRange.from > draft.customRange.to);
  const change = <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => onDraftChange(previous => ({ ...previous, [key]: value, ...(key === 'dateRange' && value === null ? { customRange: { from: '', to: '' } } : {}) }));
  return <Dialog.Root open={open} onOpenChange={next => { if (!next) onCancel(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <Dialog.Content data-dashboard-filter-panel tabIndex={-1}
        onOpenAutoFocus={event => { event.preventDefault(); returnFocus.current = document.activeElement as HTMLElement; (event.currentTarget as HTMLElement).focus(); }}
        onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus(); }}
        className="fixed inset-x-0 bottom-0 z-[71] flex max-h-[92dvh] flex-col rounded-t-3xl border border-border bg-background shadow-2xl outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:h-dvh sm:max-h-dvh sm:w-[460px] sm:rounded-none sm:border-y-0 sm:border-r-0">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25 sm:hidden" />
        <header className="flex shrink-0 items-start gap-3 border-b border-border/60 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Filter className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1"><Dialog.Title className="text-base font-semibold">{title}</Dialog.Title><Dialog.Description className="mt-1 text-xs text-muted-foreground">Refine the shoots in this view.</Dialog.Description></div>
          <Dialog.Close asChild><Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full" aria-label="Close"><X className="h-4 w-4" /></Button></Dialog.Close>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3 [scrollbar-gutter:stable]">
          <div className="pt-4 pb-2"><label htmlFor="dashboard-filter-address" className="mb-2 block text-xs font-medium text-muted-foreground">Property</label>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="dashboard-filter-address" placeholder="City, street, zip" value={draft.address} onChange={event => change('address', event.target.value)} className="h-10 rounded-xl pl-9" /></div>
          </div>
          <Section title="Date" summary={DATE_RANGE_OPTIONS.find(option => option.value === draft.dateRange)?.label || 'Any date'} initiallyOpen>
            <div className="grid grid-cols-3 gap-2"><Choice selected={!draft.dateRange} onClick={() => change('dateRange', null)}>Any date</Choice>
              {DATE_RANGE_OPTIONS.map(option => <Choice key={option.value} selected={draft.dateRange === option.value} onClick={() => change('dateRange', option.value)}>{option.label}</Choice>)}
            </div>
            {draft.dateRange === 'custom' && <div className="space-y-2"><div className="grid grid-cols-2 gap-3">
              <label className="min-w-0 space-y-1 text-xs text-muted-foreground"><span>From</span><Input aria-label="From date" type="date" max={draft.customRange.to || undefined} value={draft.customRange.from} onChange={event => change('customRange', { ...draft.customRange, from: event.target.value })} className="min-w-0 rounded-xl" /></label>
              <label className="min-w-0 space-y-1 text-xs text-muted-foreground"><span>To</span><Input aria-label="To date" type="date" min={draft.customRange.from || undefined} value={draft.customRange.to} onChange={event => change('customRange', { ...draft.customRange, to: event.target.value })} className="min-w-0 rounded-xl" /></label>
            </div>{invalidRange && <p role="status" className="text-xs text-muted-foreground">Choose a start and end date, with the end on or after the start.</p>}</div>}
          </Section>
          <Section title="Status" summary={draft.statuses.length ? `${draft.statuses.length} selected` : 'Any status'} initiallyOpen>
            <div className="grid grid-cols-3 gap-2">{dashboardStatusOptions.map(option => <Choice key={option.value} selected={draft.statuses.includes(option.value)} onClick={() => change('statuses', toggle(draft.statuses, option.value))}>{option.label}</Choice>)}</div>
          </Section>
          {visibility.clients && <Section title="Client" summary={draft.client === 'all' ? 'All clients' : draft.client}>
            <SearchChoices label="Clients" single options={[{ value: 'all', label: 'All clients' }, ...clientOptions.filter(client => client !== 'all').map(client => ({ value: client, label: client }))]} selected={[draft.client]} onSelect={value => change('client', value)} />
          </Section>}
          {visibility.assignments && <Section title="Photographer" summary={draft.unassignedOnly ? 'Unassigned' : draft.photographerIds.length ? `${draft.photographerIds.length} selected` : 'Anyone'}>
            <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={draft.unassignedOnly} onChange={event => onDraftChange(previous => ({ ...previous, unassignedOnly: event.target.checked, photographerIds: [] }))} className="h-4 w-4 accent-primary" />Unassigned only</label>
            <SearchChoices label="Photographers" options={photographerOptions.map(person => ({ value: String(person.id), label: person.name }))} selected={draft.photographerIds.map(String)} onSelect={value => onDraftChange(previous => ({ ...previous, photographerIds: toggle(previous.photographerIds, Number(value)), unassignedOnly: false }))} />
          </Section>}
          <Section title="Services" summary={draft.services.length ? `${draft.services.length} selected` : 'All services'}>
            <SearchChoices label="Services" options={serviceOptions.map(service => ({ value: service.key, label: service.label }))} selected={draft.services} onSelect={value => change('services', toggle(draft.services, value))} />
          </Section>
          {visibility.priority && <Section title="Needs attention" summary={draft.flaggedOnly || Object.values(draft.priority).some(Boolean) ? 'Filtered' : 'Any'}>
            {[['flaggedOnly', 'Flagged shoots'], ['highPriority', 'High priority'], ...(visibility.assignments ? [['missingRaw', 'Missing RAW files'], ['missingEditor', 'Missing editor']] : [])].map(([key, label]) => <label key={key} className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={key === 'flaggedOnly' ? draft.flaggedOnly : draft.priority[key as keyof FiltersState['priority']]} onChange={event => key === 'flaggedOnly' ? change('flaggedOnly', event.target.checked) : change('priority', { ...draft.priority, [key]: event.target.checked })} />{label}
            </label>)}
          </Section>}
        </div>
        <footer className="shrink-0 border-t border-border bg-background px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground"><span>{count ? `${count} filter group${count === 1 ? '' : 's'} selected` : 'Showing all shoots in this view'}</span><button type="button" onClick={onCancel} className="rounded px-2 py-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary">Cancel</button></div>
          <div className="flex gap-3"><Button variant="outline" className="h-11 gap-2 rounded-xl" aria-label="Reset all filters" disabled={!count && !countActiveFilters(filters)} onClick={onReset}><RotateCcw className="h-3.5 w-3.5" />Reset</Button><Button className="h-11 flex-1 rounded-xl" aria-label="Apply filters" disabled={invalidRange} onClick={onApply}>Apply filters{count > 0 && <span aria-hidden className="ml-2 rounded-full bg-white/20 px-1.5 text-xs">{count}</span>}</Button></div>
        </footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

export function DashboardFilterChips({ filters, onChange, onReset, role, photographerOptions, serviceOptions }: FilterOptions & { filters: FiltersState; onChange: (filters: FiltersState) => void; onReset: () => void }) {
  const visibility = dashboardFilterVisibility(role);
  const chips: { key: string; label: string }[] = filters.statuses.map(value => ({ key: `status:${value}`, label: formatWorkflowStatus(value) }));
  if (filters.address.trim()) chips.push({ key: 'address', label: filters.address });
  if (filters.dateRange) chips.push({ key: 'dateRange', label: filters.dateRange === 'custom' ? `${filters.customRange.from} – ${filters.customRange.to}` : DATE_RANGE_OPTIONS.find(option => option.value === filters.dateRange)?.label || 'Date' });
  if (visibility.clients && filters.client !== 'all') chips.push({ key: 'client', label: filters.client });
  if (visibility.assignments) {
    filters.photographerIds.forEach(id => chips.push({ key: `photographer:${id}`, label: photographerOptions.find(person => person.id === id)?.name || 'Photographer' }));
    if (filters.unassignedOnly) chips.push({ key: 'unassignedOnly', label: 'Unassigned' });
  }
  filters.services.forEach(key => chips.push({ key: `service:${key}`, label: serviceOptions.find(service => service.key === key)?.label || key }));
  if (visibility.priority) {
    if (filters.flaggedOnly) chips.push({ key: 'flaggedOnly', label: 'Flagged' });
    Object.entries(filters.priority).filter(([, value]) => value).forEach(([key]) => chips.push({ key: `priority:${key}`, label: ({ highPriority: 'High priority', missingRaw: 'Missing RAW', missingEditor: 'Missing editor' })[key as keyof FiltersState['priority']] }));
  }
  if (!chips.length) return null;
  return <div aria-label="Active filters" className="mb-3 flex shrink-0 flex-wrap items-center gap-1.5">
    {chips.map(chip => <button key={chip.key} type="button" aria-label={`Remove filter: ${chip.label}`} onClick={() => onChange(clearDashboardFilter(filters, chip.key))} className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 py-1 pl-2.5 pr-2 text-xs text-primary hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-primary"><span className="truncate">{chip.label}</span><X className="h-3 w-3 shrink-0" /></button>)}
    <button type="button" onClick={onReset} className="min-h-8 px-2 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Clear all</button>
  </div>;
}
