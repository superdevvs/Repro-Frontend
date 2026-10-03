import React, { useEffect, useMemo, useState } from 'react';
import { ShootDetailsTourContent, type ShootDetailsTourTabProps } from './ShootDetailsTourTab';
import { useShootUnitScope } from '@/features/shoot-units/useShootUnitScope';
import { ShootUnitScopeBar } from '@/features/shoot-units/ShootUnitScope';
import { projectUnitTour, INHERITED_TOUR_SETTINGS } from '@/features/shoot-units/unitTourData';
import { getUnitServiceLines, getUnitKey } from '@/features/shoot-units/shootUnitData';
import { API_BASE_URL } from '@/config/env';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { canEditVideoTours } from './tours/videoTourAccess';
import { AryeoFlowPanel } from './tours/AryeoFlowPanel';

export function ShootDetailsTourTab(props: ShootDetailsTourTabProps) {
  const { unit, isMultiUnit } = useShootUnitScope(props.shoot);
  const videoOnly = String(props.editorUser?.role ?? '').trim().toLowerCase() === 'editor';
  const canEditVideoLinks = canEditVideoTours(props.shoot, props.editorUser, unit?.id);
  const [selectedLines, setSelectedLines] = useState<Record<string, string>>({});
  const lines = unit ? getUnitServiceLines(props.shoot, getUnitKey(unit)) : [];
  const eligible = (provider: string) => lines.filter(line => /floor/i.test(line.name) || (provider === 'iguide' && /iguide|i-guide|3d/i.test(line.name)));
  const lineKey = (line: typeof lines[number]) => String(line.shoot_service_id ?? line.shootServiceId ?? line.id);
  const selected = (provider: string) => {
    const choices = eligible(provider);
    const stored = selectedLines[`${unit?.id}-${provider}`];
    return choices.some(line => lineKey(line) === stored) ? stored : choices[0] ? lineKey(choices[0]) : undefined;
  };
  const iguideLineId = selected('iguide');
  const cubicasaLineId = selected('cubicasa');
  const shoot = useMemo(() => unit ? projectUnitTour(props.shoot, unit, { iguide: iguideLineId, cubicasa: cubicasaLineId }) : props.shoot, [props.shoot, unit, iguideLineId, cubicasaLineId]);
  const [saving, setSaving] = useState(false);
  const [commonOverride, setCommonOverride] = useState<{ id: string | number; value: boolean } | null>(null);
  const { toast } = useToast();
  const unitData = unit as (typeof unit & { include_common_area_media?: boolean }) | null;
  useEffect(() => setCommonOverride(null), [unit?.id, unitData?.include_common_area_media]);
  const saveOptions = async (body: Record<string, unknown>) => {
    if (!unit?.id || saving) return;
    setSaving(true);
    if (typeof body.include_common_area_media === 'boolean') setCommonOverride({ id: unit.id, value: body.include_common_area_media });
    try {
      const response = await fetch(`${API_BASE_URL}/api/shoots/${props.shoot.id}/units/${unit.id}/tour`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}` }, body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Could not update this unit’s tour options.');
      await props.onShootUpdate();
    } catch (error) { setCommonOverride(null); toast({ title: 'Tour options', description: error instanceof Error ? error.message : 'Could not save.', variant: 'destructive' }); }
    finally { setSaving(false); }
  };
  const overrides = INHERITED_TOUR_SETTINGS.some(key => Object.hasOwn(unit?.tour_links ?? {}, key));
  const isUnitReleaseLocked = props.isClient && !props.isAdmin && unit && Number(unit.ready_service_count ?? 0) < 1;
  return <div className="space-y-3">
    {isMultiUnit && <div className="min-w-0 rounded-md border bg-muted/20 p-3 text-xs space-y-2" aria-label="Tour unit">
      <ShootUnitScopeBar shoot={props.shoot} variant="inline" disabled={props.isUnitSwitchDisabled || saving} />
      {isUnitReleaseLocked ? <div><p className="font-medium">{unit.label} tour is not released yet</p><p className="mt-1 text-xs text-muted-foreground">Select a ready unit to view its tour links. This unit’s links will be available after its media is released.</p></div> : <>
      {unit && !videoOnly && <p className="text-muted-foreground">{overrides ? 'This unit has custom tour settings.' : 'Theme and realtor settings use building defaults.'} Shared links open this unit directly.</p>}
      {unit && props.isAdmin && !iguideLineId && <p className="text-muted-foreground">Provider sync and ZIP uploads require a booked floor plan or 3D service for this unit.</p>}
      {unit && (props.isAdmin || props.isClient) && unit.kind !== 'common_area' && <label className="flex items-center gap-2"><Checkbox checked={commonOverride?.id === unit.id ? commonOverride.value : Boolean(unitData?.include_common_area_media)} disabled={saving} onCheckedChange={value => void saveOptions({ include_common_area_media: value === true })} />Include common-area photos and floor plans</label>}
      {unit && props.isAdmin && ['iguide', 'cubicasa'].map(provider => eligible(provider).length > 1 && <label key={provider} className="flex flex-wrap items-center gap-2">{provider === 'iguide' ? 'iGUIDE' : 'CubiCasa'} service line<select className="h-8 max-w-full rounded-md border bg-background px-2" value={selected(provider)} onChange={event => setSelectedLines(current => ({ ...current, [`${unit.id}-${provider}`]: event.target.value }))}>{eligible(provider).map(line => <option key={lineKey(line)} value={lineKey(line)}>{line.name}</option>)}</select></label>)}
      {unit && props.isAdmin && overrides && <Button size="sm" variant="ghost" className="h-7 px-0 text-xs" disabled={saving} onClick={() => void saveOptions({ reset_building_defaults: true })}>Use building defaults</Button>}
      </>}
    </div>}
    {['admin', 'superadmin', 'editing_manager'].includes(String(props.editorUser?.role ?? '').toLowerCase()) && <AryeoFlowPanel key={`aryeo-${props.shoot.id}-${unit?.id ?? 'building'}`} shootId={props.shoot.id} unitId={unit?.id} />}
    {videoOnly && !canEditVideoLinks && <p className="text-sm text-muted-foreground">Video links can be edited only for units assigned to you.</p>}
    {!isUnitReleaseLocked && (!videoOnly || canEditVideoLinks) && <ShootDetailsTourContent key={`${unit?.id ?? 'building'}-${iguideLineId ?? ''}-${cubicasaLineId ?? ''}`} {...props} videoOnly={videoOnly} canEditVideoLinks={canEditVideoLinks} isClientReleaseLocked={unit && Number(unit.ready_service_count ?? 0) > 0 ? false : props.isClientReleaseLocked} shoot={shoot} unitId={unit?.id} iguideLineId={iguideLineId} cubicasaLineId={cubicasaLineId} />}
  </div>;
}
