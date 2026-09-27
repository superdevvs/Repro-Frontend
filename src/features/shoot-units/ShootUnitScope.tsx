import { useState, type ReactNode } from 'react';
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

export function ShootUnitScopeBar({ shoot, disabled = false }: { shoot: ShootData; onShootUpdate?: () => unknown; disabled?: boolean }) {
  const { units, unit, activeUnitId, setActiveUnitId, isMultiUnit } = useShootUnitScope(shoot);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  if (!isMultiUnit || !unit) return null;
  const index = units.findIndex(item => getUnitKey(item) === activeUnitId);
  const matches = units.filter(item => item.label.toLowerCase().includes(query.trim().toLowerCase()));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(matches.length / 8) - 1));
  const selectUnit = (id: string) => { setActiveUnitId(id); setOpen(false); };
  return <>
    <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/20" aria-label="Selected unit" onClick={event => event.stopPropagation()}>
      <Building2 className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
      <div className="min-w-0 flex-1"><div className="text-[10px] text-muted-foreground">{unit.kind === 'common_area' ? 'Common areas' : 'Unit'} · {index + 1} of {units.length}</div><p className="truncate text-xs font-semibold" title={unit.label}>{unit.label}{unit.sqft ? ` · ${unit.sqft.toLocaleString()} sqft` : ''}</p></div>
      <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" disabled={disabled} onClick={() => { setQuery(''); setPage(0); setOpen(true); }}>Change unit</Button>
      <div className="flex gap-1"><Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous unit" disabled={disabled || index === 0} onClick={() => setActiveUnitId(getUnitKey(units[index - 1]))}><ChevronLeft className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Next unit" disabled={disabled || index === units.length - 1} onClick={() => setActiveUnitId(getUnitKey(units[index + 1]))}><ChevronRight className="h-4 w-4" /></Button></div>
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent onClick={event => event.stopPropagation()} className="flex max-h-[84dvh] max-w-lg flex-col overflow-hidden"><DialogHeader><DialogTitle>Select unit</DialogTitle><DialogDescription>{units.length} units and common areas at this property</DialogDescription></DialogHeader>
      <Input aria-label="Search units" placeholder="Search unit name…" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} />
      <div className="min-h-0 overflow-y-auto">{matches.slice(currentPage * 8, currentPage * 8 + 8).map(item => <button key={getUnitKey(item)} type="button" aria-pressed={getUnitKey(item) === activeUnitId} className="flex w-full min-w-0 items-center justify-between gap-3 border-b px-2 py-3 text-left text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => selectUnit(getUnitKey(item))}><span className="min-w-0 break-words font-medium">{item.label}</span><span className="shrink-0 text-muted-foreground">{item.kind === 'common_area' ? 'Common area' : item.sqft ? `${item.sqft.toLocaleString()} sqft` : 'SQFT not set'}</span></button>)}{matches.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No matching units.</p>}</div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><span className="text-xs text-muted-foreground">{matches.length ? currentPage * 8 + 1 : 0}–{Math.min(currentPage * 8 + 8, matches.length)} of {matches.length}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={(currentPage + 1) * 8 >= matches.length} onClick={() => setPage(currentPage + 1)}>Next</Button></div></div>
    </DialogContent></Dialog>
  </>;
}
