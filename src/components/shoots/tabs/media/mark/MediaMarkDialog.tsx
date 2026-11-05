import { useEffect, useState, type KeyboardEvent } from 'react';
import { AlertCircle, ArrowRight, Check, CheckCircle2, Layers3, Tag, Truck } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { useShootMutationRefresh } from '@/hooks/useShootMutationRefresh';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { applyServiceAssignment, assignmentIdentities, deliveryComponentSelectable, getDeliveryPlan, MediaMarkRequestError, previewServiceAssignment, selectedMediaIds,
  type AssignmentPreview, type DeliveryMode, type DeliveryPlan } from '@/services/mediaMarkService';
import { finalizeShootWithProgressToast } from '../../../finalize/finalizeShootWithProgressToast';
import type { ReclassifyMediaType } from '../shootMediaActionTypes';
import { formatUploadFileSize } from '../mediaUploadUtils';
import { MediaMarkTypePanel } from './MediaMarkTypePanel';
import { MediaMarkServicePanel } from './MediaMarkServicePanel';
import { MediaMarkDeliveryPanel } from './MediaMarkDeliveryPanel';
import { MEDIA_MARK_EVENT, type MediaMarkRequest, type MediaMarkTab } from './mediaMarkEvents';
import './mediaMarkDialog.css';

export function MediaMarkDialogHost() {
  const { user, role } = useAuth();
  const [request, setRequest] = useState<(MediaMarkRequest & { key: number }) | null>(null);
  useEffect(() => setRequest(null), [user?.id, role]);
  useEffect(() => {
    const open = (event: Event) => setRequest(current => current ?? { ...(event as CustomEvent<MediaMarkRequest>).detail, key: Date.now() });
    window.addEventListener(MEDIA_MARK_EVENT, open);
    return () => window.removeEventListener(MEDIA_MARK_EVENT, open);
  }, []);
  return request ? <MediaMarkDialog key={request.key} request={request} onClose={() => setRequest(null)} /> : null;
}

export function MediaMarkDialog({ request, onClose }: { request: MediaMarkRequest; onClose: () => void }) {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const refresh = useShootMutationRefresh();
  const staff = ['admin', 'superadmin', 'super_admin', 'editing_manager'].includes(String(role || user?.role).toLowerCase());
  const files = request.files ?? [];
  const ids = selectedMediaIds(files);
  const [tab, setTab] = useState<MediaMarkTab>(request.initialTab ?? 'type');
  const [type, setType] = useState<ReclassifyMediaType | ''>('');
  const [plan, setPlan] = useState<DeliveryPlan | null>(null);
  const [discovery, setDiscovery] = useState<AssignmentPreview | null>(null);
  const [preview, setPreview] = useState<AssignmentPreview | null>(null);
  const [targetId, setTargetId] = useState('');
  const [historical, setHistorical] = useState(false);
  const [assignmentReason, setAssignmentReason] = useState('');
  const [historicalConfirmed, setHistoricalConfirmed] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [mode, setMode] = useState<DeliveryMode>('media');
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(staff);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID());
  const allowType = Boolean(['admin', 'superadmin', 'super_admin', 'editing_manager', 'editor', 'photographer'].includes(String(role || user?.role)) && request.allowType && ids.length && ids.length === files.length && files.every(file => file.can_interact !== false));
  const canAssign = staff && Boolean(discovery?.capabilities.can_assign_service);
  const canDeliver = staff && Boolean(plan?.capabilities.can_finalize || plan?.capabilities.can_manual_no_content);
  const shootId = request.shootId;
  const idKey = ids.join(',');

  useEffect(() => {
    if (!staff) return;
    const controller = new AbortController();
    void Promise.allSettled([getDeliveryPlan(shootId, controller.signal), previewServiceAssignment(shootId, { ...(idKey ? { file_ids: idKey.split(',').map(Number) } : {}), confirm_historical: historical }, controller.signal)]).then(results => {
      if (controller.signal.aborted) return;
      const delivery = results[0]; const assignment = results[1];
      if (delivery.status === 'fulfilled') { setPlan(delivery.value); if (!delivery.value.capabilities.can_finalize && delivery.value.capabilities.can_manual_no_content) { setMode('manual_no_content'); setSelected([]); } else setSelected(delivery.value.components.filter(component => deliveryComponentSelectable(component, 'media') && (!idKey || component.file_ids.some(id => idKey.split(',').includes(String(id))))).map(component => component.id)); }
      if (assignment.status === 'fulfilled') setDiscovery(assignment.value);
      if (delivery.status === 'rejected' && request.initialTab === 'delivery') setError(delivery.reason instanceof Error ? delivery.reason.message : 'Delivery plan unavailable.');
      if (assignment.status === 'rejected' && request.initialTab === 'service') setError(assignment.reason instanceof Error ? assignment.reason.message : 'Assignment plan unavailable.');
      setLoading(false);
    });
    return () => controller.abort();
  }, [shootId, staff, idKey, request.initialTab, historical]);

  useEffect(() => {
    setPreview(null);
    if (!targetId || !canAssign || !idKey) return;
    const controller = new AbortController();
    setPreviewing(true);
    const timer = setTimeout(() => { void previewServiceAssignment(shootId, { file_ids: idKey.split(',').map(Number), shoot_service_id: Number(targetId), expected_files: assignmentIdentities(discovery?.files ?? []), confirm_historical: historical, reason: assignmentReason.trim() || undefined }, controller.signal)
      .then(value => { if (!controller.signal.aborted) { setPreview(value); setError(''); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Assignment could not be reviewed.'); })
      .finally(() => { if (!controller.signal.aborted) setPreviewing(false); }); }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [shootId, targetId, canAssign, idKey, discovery, historical, assignmentReason]);

  const changed = () => { refresh(shootId); request.onChanged?.(); };
  const changeMode = (next: DeliveryMode) => {
    setMode(next); setConfirmed(false); setReason(''); setAttemptKey(crypto.randomUUID());
    setSelected(next === 'manual_no_content' ? [] : plan?.components.filter(component => deliveryComponentSelectable(component, next) && (!ids.length || component.file_ids.some(id => ids.includes(id)))).map(component => component.id) ?? []);
  };
  const select = (id: string) => { setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]); setConfirmed(false); setAttemptKey(crypto.randomUUID()); };
  const canApply = !busy && !saved && (tab === 'type' ? allowType && Boolean(type)
    : tab === 'service' ? canAssign && preview?.can_apply && !previewing && ids.length > 0 && ids.length === files.length && (!preview.requires_historical_confirmation || historicalConfirmed) && (!discovery?.files.some(file => file.shoot_service_id != null) || assignmentReason.trim().length >= 3)
      : canDeliver && (mode === 'manual_no_content' ? plan?.capabilities.can_manual_no_content : plan?.capabilities.can_finalize) && selected.length > 0 && (mode === 'media' || confirmed) && (mode !== 'manual_no_content' || reason.trim().length >= 5));
  const apply = async () => {
    if (!canApply) return;
    setBusy(true); setError('');
    try {
      if (tab === 'type') {
        const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/files/reclassify`, { method: 'PATCH', headers: getApiHeaders(), body: JSON.stringify({ file_ids: ids, media_type: type }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Media type could not be saved.');
        setSaved(`Updated the type of ${ids.length} file${ids.length === 1 ? '' : 's'}.`);
      } else if (tab === 'service') {
        await applyServiceAssignment(shootId, { file_ids: ids, shoot_service_id: Number(targetId), expected_target_unit_id: discovery?.targets.find(target => String(target.id) === targetId)?.unit_id ?? null, expected_files: assignmentIdentities(preview?.files ?? []), idempotency_key: attemptKey, reason: assignmentReason.trim() || undefined, confirm_historical: historical, expected_receipt_revision: preview?.receipt_revision });
        setSaved(`Assigned ${ids.length} file${ids.length === 1 ? '' : 's'} to the booked service.`);
      } else if (plan) {
        const outcome = await finalizeShootWithProgressToast({ shootId, shootLabel: request.shootLabel, body: { final_status: 'admin_verified', component_ids: selected, mode, reason: reason.trim() || undefined, plan_revision: plan.revision, idempotency_key: attemptKey, confirmed }, onRefresh: changed });
        if (outcome.status === 'failed' || outcome.status === 'error') throw new Error(outcome.message);
        setSaved(outcome.status === 'pending' ? 'Delivery is running in the background. The selected work will refresh when it finishes.' : 'Selected delivery work is complete. Other unfinished work remains in progress.');
      }
      changed();
      toast({ title: 'Changes saved', description: tab === 'service' ? 'Service assignment updated.' : tab === 'type' ? 'Media category updated.' : 'Delivery status refreshed.' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The change could not be saved.');
      if (tab === 'service' && cause instanceof MediaMarkRequestError && [409, 422].includes(cause.status)) {
        setPreview(null); setTargetId(''); setHistoricalConfirmed(false);
        const fresh = await previewServiceAssignment(shootId, { file_ids: ids, confirm_historical: historical }).catch(() => null);
        if (fresh) setDiscovery(fresh);
      }
      if (tab === 'delivery') {
        const fresh = await getDeliveryPlan(shootId).catch(() => null);
        if (fresh) { setPlan(fresh); if (fresh.revision !== plan?.revision) { setSelected([]); setConfirmed(false); setAttemptKey(crypto.randomUUID()); } }
      }
    } finally { setBusy(false); }
  };
  const tabs = [{ id: 'type' as const, label: 'Type', icon: Tag, visible: allowType || tab === 'type' }, { id: 'service' as const, label: 'Service', icon: Layers3, visible: canAssign }, { id: 'delivery' as const, label: 'Delivery', icon: Truck, visible: canDeliver }];
  const visibleTabs = tabs.filter(item => item.visible);
  const navigateTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!offset && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next = visibleTabs[event.key === 'Home' ? 0 : event.key === 'End' ? visibleTabs.length - 1 : (index + offset + visibleTabs.length) % visibleTabs.length];
    if (next) { setTab(next.id); setError(''); document.getElementById(`mark-tab-${next.id}`)?.focus(); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="media-mark-dialog" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
    <DialogHeader className="mark-header"><span className="mark-title-icon"><Tag /></span><div><DialogTitle>{request.initialTab === 'delivery' ? 'Delivery review' : 'Mark media'}</DialogTitle><DialogDescription>{request.shootLabel || `Shoot #${shootId}`} · Make every file count</DialogDescription></div></DialogHeader>
    <div className="mark-selection"><div className="mark-thumbnails">{files.slice(0, 4).map(file => <span key={file.id}>{file.grid_url || file.thumbnail_url || file.thumb ? <img src={file.grid_url || file.thumbnail_url || file.thumb} alt="" /> : <Tag />}</span>)}</div><div><strong>{ids.length ? `${ids.length} file${ids.length === 1 ? '' : 's'} selected` : 'Review booked deliverables'}</strong><small>{ids.length ? `${formatUploadFileSize(files.reduce((sum, file) => sum + (file.fileSize || 0), 0))} · Original files preserved` : 'Complete only the work you select'}</small></div></div>
    <div className="mark-tabs" role="tablist" aria-label="Mark options">{visibleTabs.map((item, index) => <button key={item.id} type="button" role="tab" tabIndex={tab === item.id ? 0 : -1} onKeyDown={event => navigateTab(event, index)} aria-selected={tab === item.id} aria-controls={`mark-panel-${item.id}`} id={`mark-tab-${item.id}`} disabled={busy || Boolean(saved)} onClick={() => { setTab(item.id); setError(''); }}><item.icon />{item.label}</button>)}</div>
    <div className="mark-body" role="tabpanel" id={`mark-panel-${tab}`} aria-labelledby={`mark-tab-${tab}`}>
      {error && <div className="mark-error" role="alert"><AlertCircle /><p>{error}</p></div>}
      {saved ? <div className="mark-empty mark-success" role="status"><CheckCircle2 /><h3>All set</h3><p>{saved}</p></div>
        : loading && tab !== 'type' ? <div className="mark-empty" role="status"><InlineSpinner /><p>Checking the latest work and permissions…</p></div>
          : tab === 'type' ? <MediaMarkTypePanel value={type} onChange={setType} allowed={allowType} />
            : tab === 'service' && canAssign ? <MediaMarkServicePanel discovery={discovery} targetId={targetId} onChange={id => { setTargetId(id); setHistoricalConfirmed(false); setAttemptKey(crypto.randomUUID()); }} preview={preview} previewing={previewing} count={ids.length} historical={historical} onHistorical={value => { setHistorical(value); setHistoricalConfirmed(false); setTargetId(''); setPreview(null); setAttemptKey(crypto.randomUUID()); }} reason={assignmentReason} onReason={value => { setAssignmentReason(value); setHistoricalConfirmed(false); setAttemptKey(crypto.randomUUID()); }} historicalConfirmed={historicalConfirmed} onHistoricalConfirm={setHistoricalConfirmed} />
              : tab === 'delivery' && plan && canDeliver ? <MediaMarkDeliveryPanel plan={plan} mode={mode} onModeChange={changeMode} selected={selected} onSelect={select} reason={reason} onReasonChange={value => { setReason(value); setAttemptKey(crypto.randomUUID()); }} confirmed={confirmed} onConfirm={setConfirmed} />
                : <div className="mark-empty"><Layers3 /><h3>This action is unavailable</h3><p>Your current permissions or this shoot’s work state do not allow this change.</p></div>}
    </div>
    <div className="mark-footer"><p>{saved ? 'The shoot and media library have been refreshed.' : tab === 'delivery' ? `${selected.length} component${selected.length === 1 ? '' : 's'} selected · Other work stays open` : tab === 'service' ? 'A service assignment is separate from the media type.' : 'Applies to the selected files only.'}</p><div><Button variant="ghost" disabled={busy} onClick={onClose}>{saved ? 'Close' : 'Cancel'}</Button>{!saved && <Button disabled={!canApply} onClick={() => void apply()}>{busy ? <InlineSpinner /> : <Check />}{busy ? 'Saving…' : tab === 'type' ? 'Save type' : tab === 'service' ? 'Assign service' : mode === 'manual_no_content' ? 'Finalize without content' : 'Finalize selected'}{!busy && <ArrowRight />}</Button>}</div></div>
  </DialogContent></Dialog>;
}
