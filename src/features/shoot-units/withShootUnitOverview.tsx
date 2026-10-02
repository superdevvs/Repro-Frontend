import { useMemo, useRef, useState, type ComponentType } from 'react';
import type { ShootData, ShootUnit } from '@/types/shoots';
import type { ShootDetailsOverviewTabProps } from '@/components/shoots/tabs/ShootDetailsOverviewTab';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { UnitManagerDialog } from './UnitManagerDialog';
import { ShootUnitScopeBar } from './ShootUnitScope';
import { useShootUnitScope } from './useShootUnitScope';
import { projectShootForUnit } from './shootUnitData';
import { buildUnitScopedUpdate, unitMetadataPayload } from './unitMutations';

export function withShootUnitOverview(Component: ComponentType<ShootDetailsOverviewTabProps>) {
  function UnitOverview(props: ShootDetailsOverviewTabProps) {
    const { shoot, isEditMode, isAdmin, onShootUpdate } = props;
    const scope = useShootUnitScope(shoot);
    const { toast } = useToast();
    const [draft, setDraft] = useState<ShootUnit[] | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const selectorRef = useRef<HTMLDivElement>(null);
    const scopedShoot = useMemo(() => projectShootForUnit(shoot, scope.activeUnitId), [shoot, scope.activeUnitId]);
    if (!scope.isMultiUnit || !scope.unit || !scope.activeUnitId) return <Component {...props} />;
    const activeId = scope.activeUnitId;
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
      <Component {...props} key={activeId} shoot={scopedShoot}
        unitSelector={<ShootUnitScopeBar shoot={shoot} containerRef={selectorRef} variant="embedded" disabled={isEditMode || props.isUnitSwitchDisabled || saving} manageUnitsLabel={isAdmin ? 'Manage units' : 'View units'} onManageUnits={() => { setError(''); setDraft(scope.units); }} />}
        unitAccessNotes={scope.unit.access_notes}
        onSave={props.onSave ? (updates, onTravelFailure) => {
          const payload = buildUnitScopedUpdate(shoot, activeId, updates as Record<string, unknown>) as Partial<ShootData>;
          if (onTravelFailure) props.onSave?.(payload, onTravelFailure);
          else props.onSave?.(payload);
        } : undefined} />
      <UnitManagerDialog open={draft !== null} onClose={() => { if (!saving) setDraft(null); }} units={draft ?? scope.units} onChange={isAdmin && !saving ? setDraft : undefined} readOnly={!isAdmin || saving} activeUnitId={scope.unit.client_key ?? activeId} title={isAdmin ? 'Manage property units' : 'Property units'} footer={isAdmin ? <div className="w-full space-y-2">{error && <p role="alert" className="text-xs text-destructive">{error}</p>}<Button className="w-full" disabled={saving} onClick={() => void saveUnits()}>{saving ? 'Saving…' : 'Save all changes'}</Button></div> : undefined} />
    </>;
  }
  UnitOverview.displayName = 'UnitOverview';
  return UnitOverview;
}
