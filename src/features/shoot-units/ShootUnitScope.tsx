import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { ScopeContext, useUnitSelection, useShootUnitScope } from './useShootUnitScope';
import { ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ShootData } from '@/types/shoots';
import { getUnitKey } from './shootUnitData';

export function ShootUnitScopeProvider({ shoot, children }: { shoot: ShootData; children: ReactNode }) {
  const value = useUnitSelection(shoot);
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

type ShootUnitScopeBarProps = {
  shoot: ShootData;
  onShootUpdate?: () => unknown;
  disabled?: boolean;
  variant?: 'standalone' | 'embedded' | 'inline';
  onManageUnits?: () => void;
  manageUnitsLabel?: string;
  containerRef?: RefObject<HTMLDivElement>;
};

export function ShootUnitScopeBar({ shoot, disabled = false, variant = 'standalone', onManageUnits, manageUnitsLabel = 'Manage units', containerRef }: ShootUnitScopeBarProps) {
  const { units, unit, activeUnitId, setActiveUnitId, isMultiUnit } = useShootUnitScope(shoot);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const handingOffFocus = useRef(false);
  if (!isMultiUnit || !unit) return null;
  const index = units.findIndex(item => getUnitKey(item) === activeUnitId);
  const matches = units.filter(item => item.label.toLowerCase().includes(query.trim().toLowerCase()));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(matches.length / 8) - 1));
  const restoreFocus = (control = 'change') => {
    if (!containerRef) return;
    // The scoped editor remounts on selection; use its parent's stable ref.
    requestAnimationFrame(() => {
      const target = containerRef.current?.querySelector<HTMLButtonElement>(`[data-unit-control="${control}"]:not(:disabled)`)
        ?? containerRef.current?.querySelector<HTMLButtonElement>('[data-unit-control="change"]:not(:disabled)');
      target?.focus({ preventScroll: true });
    });
  };
  const selectUnit = (id: string, control = 'change') => {
    if (disabled) return;
    setActiveUnitId(id); setOpen(false); restoreFocus(control);
  };
  return <>
    <div ref={containerRef} className={`flex min-w-0 flex-wrap items-center gap-2 ${variant === 'embedded' ? 'mt-2.5 border-t pt-2.5' : variant === 'inline' ? '' : 'rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/20'}`} aria-label="Selected unit" onClick={event => event.stopPropagation()}>
      <Building2 className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
      <div className="min-w-0 flex-1"><div className="text-[10px] text-muted-foreground">{unit.kind === 'common_area' ? 'Common areas' : 'Unit'} · {index + 1} of {units.length}</div><p className="truncate text-xs font-semibold" title={unit.label}>{unit.label}{unit.sqft ? ` · ${unit.sqft.toLocaleString()} sqft` : ''}</p></div>
      <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" data-unit-control="change" disabled={disabled} onClick={() => { handingOffFocus.current = false; setQuery(''); setPage(0); setOpen(true); }}>Change unit</Button>
      <div className="flex gap-1"><Button type="button" variant="ghost" size="icon" className="h-8 w-8" data-unit-control="previous" aria-label="Previous unit" disabled={disabled || index === 0} onClick={() => selectUnit(getUnitKey(units[index - 1]), 'previous')}><ChevronLeft className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" className="h-8 w-8" data-unit-control="next" aria-label="Next unit" disabled={disabled || index === units.length - 1} onClick={() => selectUnit(getUnitKey(units[index + 1]), 'next')}><ChevronRight className="h-4 w-4" /></Button></div>
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent onCloseAutoFocus={containerRef ? event => { event.preventDefault(); if (!handingOffFocus.current) restoreFocus(); } : undefined} onClick={event => event.stopPropagation()} className="flex max-h-[84dvh] max-w-lg flex-col overflow-hidden"><DialogHeader><DialogTitle>Select unit</DialogTitle><DialogDescription>{units.length} units and common areas at this property</DialogDescription></DialogHeader>
      <Input aria-label="Search units" placeholder="Search unit name…" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} />
      <div className="min-h-0 overflow-y-auto">{matches.slice(currentPage * 8, currentPage * 8 + 8).map(item => <button key={getUnitKey(item)} type="button" disabled={disabled} aria-pressed={getUnitKey(item) === activeUnitId} className="flex w-full min-w-0 items-center justify-between gap-3 border-b px-2 py-3 text-left text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" onClick={() => selectUnit(getUnitKey(item))}><span className="min-w-0 break-words font-medium">{item.label}</span><span className="shrink-0 text-muted-foreground">{item.kind === 'common_area' ? 'Common area' : item.sqft ? `${item.sqft.toLocaleString()} sqft` : 'SQFT not set'}</span></button>)}{matches.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No matching units.</p>}</div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><span className="text-xs text-muted-foreground">{matches.length ? currentPage * 8 + 1 : 0}–{Math.min(currentPage * 8 + 8, matches.length)} of {matches.length}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={(currentPage + 1) * 8 >= matches.length} onClick={() => setPage(currentPage + 1)}>Next</Button></div></div>
      {onManageUnits && <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => { handingOffFocus.current = true; setOpen(false); onManageUnits(); }}>{manageUnitsLabel}</Button>}
    </DialogContent></Dialog>
  </>;
}
