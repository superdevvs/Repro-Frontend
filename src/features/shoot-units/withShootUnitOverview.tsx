import { useMemo, useState, type ComponentType } from 'react';
import type { ShootData, ShootUnit } from '@/types/shoots';
import type { ShootDetailsOverviewTabProps } from '@/components/shoots/tabs/ShootDetailsOverviewTab';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { UnitManagerDialog } from './UnitManagerDialog';
import { useShootUnitScope } from './useShootUnitScope';
import { getUnitKey, getUnitServiceLines, projectShootForUnit } from './shootUnitData';
import { buildUnitScopedUpdate, unitMetadataPayload } from './unitMutations';

export function withShootUnitOverview(Component: ComponentType<ShootDetailsOverviewTabProps>) {
  function UnitOverview(props: ShootDetailsOverviewTabProps) {
    const { shoot, isEditMode, isAdmin, onShootUpdate } = props;
    const scope = useShootUnitScope(shoot);
    const { toast } = useToast();
    const [draft, setDraft] = useState<ShootUnit[] | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const scopedShoot = useMemo(() => projectShootForUnit(shoot, scope.activeUnitId), [shoot, scope.activeUnitId]);
    if (!scope.isMultiUnit || !scope.unit || !scope.activeUnitId) return <Component {...props} />;
    const activeId = scope.activeUnitId;
    const configured = scope.units.filter(unit => unit.sqft && getUnitServiceLines(shoot, getUnitKey(unit)).length).length;
    const ready = scope.units.filter(unit => unit.is_ready_for_delivery === true).length;
    const partial = scope.units.filter(unit => unit.delivery_status === 'partial').length;
    const saveUnits = async () => {
      if (!draft || saving) return;
      setSaving(true); setError('');
      try {
        await apiClient.patch(`/shoots/${shoot.id}`, { units: unitMetadataPayload(draft), expected_units_revision: shoot.units_revision });
        await onShootUpdate(); setDraft(null);
        toast({ title: 'Units updated', description: 'Unit details were saved. Booked service prices are unchanged.' });
      } catch (caught) {
        const data = (caught as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data;
        setError(Object.values(data?.errors ?? {}).flat().join(' ') || data?.message || 'Unable to save units. Refresh and try again.');
      } finally { setSaving(false); }
    };
    return <>
      <section className="mb-3 rounded-lg border bg-background p-3" aria-label="Property unit progress">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold">Whole property · {scope.units.length} units / areas</p><p className="mt-1 text-[11px] text-muted-foreground">Booking details {configured}/{scope.units.length} · Ready for client {ready}/{scope.units.length}{partial > 0 ? ` · ${partial} partly ready` : ''}</p></div><Button type="button" size="sm" variant="outline" disabled={isEditMode} onClick={() => { setError(''); setDraft(scope.units); }}>{isAdmin ? 'Manage units' : 'View units'}</Button></div>
        <p className="mt-2 text-[11px] text-muted-foreground">Showing services and dimensions for <strong className="text-foreground">{scope.unit.label}</strong>. Address, client, building access and payment totals apply to the property.</p>
        {scope.unit.access_notes && <p className="mt-2 whitespace-pre-wrap break-words border-t pt-2 text-xs"><span className="font-medium">Unit access: </span>{scope.unit.access_notes}</p>}
      </section>
      <Component {...props} key={activeId} shoot={scopedShoot} onSave={props.onSave ? updates => props.onSave?.(buildUnitScopedUpdate(shoot, activeId, updates as Record<string, unknown>) as Partial<ShootData>) : undefined} />
      <UnitManagerDialog open={draft !== null} onClose={() => { if (!saving) setDraft(null); }} units={draft ?? scope.units} onChange={isAdmin && !saving ? setDraft : undefined} readOnly={!isAdmin || saving} activeUnitId={scope.unit.client_key ?? activeId} title={isAdmin ? 'Manage property units' : 'Property units'} footer={isAdmin ? <div className="w-full space-y-2">{error && <p role="alert" className="text-xs text-destructive">{error}</p>}<Button className="w-full" disabled={saving} onClick={() => void saveUnits()}>{saving ? 'Saving…' : 'Save all changes'}</Button></div> : undefined} />
    </>;
  }
  UnitOverview.displayName = 'UnitOverview';
  return UnitOverview;
}
