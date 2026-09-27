import React, { useEffect, useMemo, useState } from 'react';
import type { ShootUnit } from '@/types/shoots';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useIsMobile } from '@/hooks/use-mobile';
import { draftUnitKey, makeUnitDraft } from './model';

export interface UnitManagerDialogProps {
  open: boolean;
  onClose: () => void;
  units: ShootUnit[];
  onChange?: (units: ShootUnit[]) => void;
  activeUnitId?: string | null;
  onSelect?: (key: string) => void;
  readOnly?: boolean;
  errors?: Record<string, string[]>;
  title?: string;
  renderUnitExtra?: (unit: ShootUnit) => React.ReactNode;
  renderEditorExtra?: (unit: ShootUnit) => React.ReactNode;
  footer?: React.ReactNode;
}
export function UnitManagerDialog({ open, onClose, units, onChange, activeUnitId, onSelect, readOnly = false, errors = {}, title = 'Manage units', renderUnitExtra, renderEditorExtra, footer }: UnitManagerDialogProps) {
  const mobile = useIsMobile();
  const [query, setQuery] = useState('');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<ShootUnit | null>(null);
  const [paste, setPaste] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setQuery(''); setPage(0); setEditing(null); setPaste(null); setError(''); } }, [open]);
  const matches = useMemo(() => units.filter(unit => unit.label.toLowerCase().includes(query.toLowerCase()) && (!attentionOnly || errors[draftUnitKey(unit)]?.length)), [units, query, attentionOnly, errors]);
  const maxPage = Math.max(0, Math.ceil(matches.length / 8) - 1);
  const currentPage = Math.min(page, maxPage);
  const rows = matches.slice(currentPage * 8, currentPage * 8 + 8);
  const change = (next: ShootUnit[]) => { onChange?.(next); setEditing(null); setPaste(null); setError(''); };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const label = editing.label.trim();
    if (!label || units.some(unit => draftUnitKey(unit) !== draftUnitKey(editing) && unit.label.trim().toLowerCase() === label.toLowerCase())) { setError('Enter a unique unit label.'); return; }
    const exists = units.some(unit => draftUnitKey(unit) === draftUnitKey(editing));
    if (!exists && units.length >= 500) { setError('A booking can contain up to 500 units.'); return; }
    change(exists ? units.map(unit => draftUnitKey(unit) === draftUnitKey(editing) ? { ...editing, label } : unit) : [...units, { ...editing, label }]);
  };
  const pasteUnits = () => {
    const labels = (paste ?? '').split(/[\n,;]+/).map(label => label.trim()).filter(Boolean);
    if (labels.some(label => label.length > 120)) { setError('Each label must be 120 characters or shorter.'); return; }
    const used = new Set(units.map(unit => unit.label.trim().toLowerCase()));
    if (!labels.length || labels.some(label => { const exists = used.has(label.toLowerCase()); used.add(label.toLowerCase()); return exists; })) { setError('Enter unique labels, one per line. Existing labels cannot be repeated.'); return; }
    if (units.length + labels.length > 500) { setError('A booking can contain up to 500 units.'); return; }
    const template = units.find(unit => draftUnitKey(unit) === activeUnitId);
    change([...units, ...labels.map(label => makeUnitDraft({ label, sqft: template?.sqft ?? null, beds: template?.beds ?? null, baths: template?.baths ?? null, access_notes: template?.access_notes ?? '', kind: template?.kind ?? 'unit' }))]);
  };
  const content = <>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      {editing ? <form id="unit-details-form" onSubmit={save} className="space-y-4">
        <div><Label htmlFor="unit-label">Unit or common area label</Label><Input id="unit-label" value={editing.label} onChange={event => setEditing({ ...editing, label: event.target.value })} required maxLength={120} /></div>
        <div><Label htmlFor="unit-kind">Kind</Label><select id="unit-kind" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={editing.kind} onChange={event => setEditing({ ...editing, kind: event.target.value as ShootUnit['kind'] })}><option value="unit">Unit</option><option value="common_area">Common area</option></select></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{(['sqft', 'beds', 'baths'] as const).map(field => <div key={field}><Label htmlFor={`unit-${field}`}>{field === 'sqft' ? 'Square footage' : field === 'beds' ? 'Bedrooms' : 'Bathrooms'}</Label><Input id={`unit-${field}`} type="number" min={field === 'sqft' ? 1 : 0} max={field === 'sqft' ? 1000000 : 100} step={field === 'baths' ? 0.5 : 1} required={field === 'sqft'} value={editing[field] ?? ''} onChange={event => setEditing({ ...editing, [field]: event.target.value === '' ? null : Number(event.target.value) })} /></div>)}</div>
        <div><Label htmlFor="unit-access">Access notes</Label><Textarea id="unit-access" value={editing.access_notes ?? ''} maxLength={4000} onChange={event => setEditing({ ...editing, access_notes: event.target.value })} /></div>
        {renderEditorExtra?.(editing)}
      </form> : paste !== null ? <div className="space-y-3"><Label htmlFor="unit-labels">Paste labels, one per line</Label><Textarea id="unit-labels" rows={8} value={paste} onChange={event => setPaste(event.target.value)} placeholder={'101\n102\n103'} /><p className="text-xs text-muted-foreground">Copies the selected unit’s dimensions and access notes. Services and visit overrides are not copied.</p></div> : <>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row"><Input aria-label="Search units" placeholder="Search all units…" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /><label className="flex shrink-0 items-center gap-2 text-xs"><input type="checkbox" checked={attentionOnly} onChange={event => { setAttentionOnly(event.target.checked); setPage(0); }} />Needs attention</label></div>
        <div className="min-h-[240px]">{rows.map(unit => <div key={draftUnitKey(unit)} className="flex min-w-0 items-center gap-3 border-b py-3">
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { onSelect?.(draftUnitKey(unit)); onClose(); }} disabled={!onSelect}><span className="block break-words text-sm font-medium">{unit.label}</span><span className="text-xs text-muted-foreground">{unit.kind === 'common_area' ? 'Common area · ' : ''}{unit.sqft ? `${unit.sqft.toLocaleString()} sqft` : 'SQFT missing'}</span>{renderUnitExtra?.(unit)}{errors[draftUnitKey(unit)]?.length ? <span className="block text-xs text-destructive">{errors[draftUnitKey(unit)][0]}</span> : null}</button>
          {!readOnly && onChange && <div className="flex shrink-0 gap-1"><Button size="sm" variant="ghost" onClick={() => { setError(''); setEditing(unit); }}>Edit</Button><Button size="sm" variant="ghost" aria-label={`Duplicate ${unit.label}`} onClick={() => { const { id: _id, client_key: _key, ...rest } = unit; setEditing(makeUnitDraft({ ...rest, label: `${unit.label} copy` })); }}>Copy</Button></div>}
        </div>)}{!rows.length && <p className="py-16 text-center text-sm text-muted-foreground">No units match this search.</p>}</div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{matches.length ? currentPage * 8 + 1 : 0}–{Math.min((currentPage + 1) * 8, matches.length)} of {matches.length}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={currentPage >= maxPage} onClick={() => setPage(currentPage + 1)}>Next</Button></div></div>
      </>}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-background px-4 py-3 sm:px-6">
      {!editing && paste === null && footer}
      {editing || paste !== null ? <><Button variant="outline" onClick={() => { setEditing(null); setPaste(null); setError(''); }}>Back to units</Button>{editing ? <Button type="submit" form="unit-details-form">Save unit</Button> : <Button onClick={pasteUnits}>Add units</Button>}</> : <><div className="flex flex-wrap gap-2">{!readOnly && onChange && <><Button variant="outline" disabled={units.length >= 500} onClick={() => setEditing(makeUnitDraft())}>Add unit</Button><Button variant="outline" onClick={() => setPaste('')}>Paste labels</Button></>}</div><Button onClick={onClose}>Done</Button></>}
    </div>
  </>;
  const description = `${units.length} units and common areas. Search and edit without changing the page layout.`;
  return mobile ? <Drawer open={open} onOpenChange={value => { if (!value) onClose(); }}><DrawerContent className="flex h-[84dvh] max-h-[84dvh] flex-col"><DrawerHeader className="shrink-0 text-left"><DrawerTitle>{editing ? 'Edit unit' : title}</DrawerTitle><DrawerDescription>{description}</DrawerDescription></DrawerHeader>{content}</DrawerContent></Drawer> : <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}><DialogContent className="flex max-h-[84dvh] max-w-2xl flex-col gap-0 overflow-hidden p-0"><DialogHeader className="shrink-0 px-6 pb-3 pt-6"><DialogTitle>{editing ? 'Edit unit' : title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{content}</DialogContent></Dialog>;
}
