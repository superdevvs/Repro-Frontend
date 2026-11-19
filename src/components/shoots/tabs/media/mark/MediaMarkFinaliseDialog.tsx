import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, Check, CheckCircle2, Layers3 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { useShootMutationRefresh } from '@/hooks/useShootMutationRefresh';
import { useToast } from '@/hooks/use-toast';
import { getDeliveryPlan, type DeliveryPlan } from '@/services/mediaMarkService';
import { finalizeShootWithProgressToast } from '../../../finalize/finalizeShootWithProgressToast';
import { MediaMarkDeliveryPanel } from './MediaMarkDeliveryPanel';
import { automaticDeliveryMethod, deliveryServiceGroups, readyDeliverySelection, type MissingWork } from './simpleDeliverySelection';
import { STAFF_MARK_ROLES, type MediaMarkRequest } from './mediaMarkEvents';
import './mediaMarkDialog.css';

/** Shoot-level "Finalise shoot" dialog. Separate from file marking. */
export function MediaMarkFinaliseDialog({ request, onClose }: { request: MediaMarkRequest; onClose: () => void }) {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const refresh = useShootMutationRefresh();
  const staff = STAFF_MARK_ROLES.includes(String(role || user?.role).toLowerCase());
  const shootId = request.shootId;
  const [plan, setPlan] = useState<DeliveryPlan | null>(null);
  const [withoutContent, setWithoutContent] = useState<MissingWork>('none');
  const [completionConfirmed, setCompletionConfirmed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(staff);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!staff) return;
    const controller = new AbortController();
    void getDeliveryPlan(shootId, controller.signal)
      .then(value => { if (!controller.signal.aborted) { setPlan(value); setSelected(value.capabilities.can_finalize ? readyDeliverySelection(value, []) : []); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Delivery plan unavailable.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [shootId, staff]);

  const canDeliver = staff && Boolean(plan?.capabilities.can_finalize);
  const changed = async () => { refresh(shootId); await request.onChanged?.(); };
  const changeWithoutContent = (next: MissingWork) => {
    setWithoutContent(next); setReason(''); setCompletionConfirmed(false); setAttemptKey(crypto.randomUUID());
    // Enabling an exception never opts pending work in. Changing it removes only missing work.
    setSelected(previous => previous.filter(id => plan?.components.some(component => component.id === id && automaticDeliveryMethod(component))));
  };
  const select = (componentIds: string[], checked: boolean) => { setSelected(previous => checked ? [...new Set([...previous, ...componentIds])] : previous.filter(id => !componentIds.includes(id))); setAttemptKey(crypto.randomUUID()); };
  const selectedComponents = plan?.components.filter(component => selected.includes(component.id)) ?? [];
  const hasMissingSelection = selectedComponents.some(component => ['defer', 'manual_no_content'].includes(automaticDeliveryMethod(component, withoutContent) ?? ''));
  const completesWithoutContent = selectedComponents.some(component => automaticDeliveryMethod(component, withoutContent) === 'manual_no_content');
  const canApply = !busy && !saved && !loading && canDeliver && selected.length > 0 && selectedComponents.length === selected.length
    && selectedComponents.every(component => automaticDeliveryMethod(component, withoutContent) && plan?.capabilities.can_finalize)
    && (!hasMissingSelection || reason.trim().length >= 5) && (!completesWithoutContent || completionConfirmed);
  const apply = async () => {
    if (!canApply || !plan) return;
    setBusy(true); setError('');
    try {
      const outcome = await finalizeShootWithProgressToast({ shootId, shootLabel: request.shootLabel, body: { final_status: 'admin_verified', component_ids: selected, mode: 'auto', allow_without_content: withoutContent === 'later', ...(withoutContent === 'complete' ? { complete_without_content: true } : {}), reason: hasMissingSelection ? reason.trim() : undefined, plan_revision: plan.revision, idempotency_key: attemptKey, confirmed: true }, onRefresh: changed });
      if (outcome.status === 'failed' || outcome.status === 'error') throw new Error(outcome.message);
      setSaved(outcome.status === 'pending' ? 'Delivery is running in the background. The selected work will refresh when it finishes.'
        : completesWithoutContent ? 'Ready content has been released and the selected work was completed without content.'
          : 'Ready content has been released. Missing work remains pending and will update when it is ready.');
      await changed();
      toast({ title: 'Changes saved', description: 'Delivery status refreshed.' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The change could not be saved.');
      const fresh = await getDeliveryPlan(shootId).catch(() => null);
      if (fresh) { setPlan(fresh); if (fresh.revision !== plan.revision) { setSelected([]); setReason(''); setAttemptKey(crypto.randomUUID()); } }
    } finally { setBusy(false); }
  };
  const selectedServices = new Set(selectedComponents.map(component => component.shoot_service_id)).size;
  const pendingServices = plan ? deliveryServiceGroups(plan).filter(group => group.components.some(component => !component.resolved && (!selected.includes(component.id) || automaticDeliveryMethod(component, withoutContent) === 'defer'))).map(group => group.name) : [];
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="media-mark-dialog simple-finalise-dialog" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
    <DialogHeader className="mark-header"><div><DialogTitle>Finalise shoot</DialogTitle><DialogDescription>{request.shootLabel || `Shoot #${shootId}`}</DialogDescription></div></DialogHeader>
    <div className="mark-body">
      {error && <div className="mark-error" role="alert"><AlertCircle /><p>{error}</p></div>}
      {saved ? <div className="mark-empty mark-success" role="status"><CheckCircle2 /><h3>All set</h3><p>{saved}</p></div>
        : loading ? <div className="mark-empty" role="status"><InlineSpinner /><p>Checking the latest work and permissions…</p></div>
          : plan && canDeliver ? <MediaMarkDeliveryPanel plan={plan} missingWork={withoutContent} onMissingWorkChange={changeWithoutContent} confirmed={completionConfirmed} onConfirmedChange={value => { setCompletionConfirmed(value); setAttemptKey(crypto.randomUUID()); }} selected={selected} onSelect={select} reason={reason} onReasonChange={value => { setReason(value); setAttemptKey(crypto.randomUUID()); }} disabled={busy} />
            : <div className="mark-empty"><Layers3 /><h3>This action is unavailable</h3><p>Your current permissions or this shoot’s work state do not allow this change.</p></div>}
    </div>
    <div className="mark-footer"><p>{saved ? 'The shoot and media library have been refreshed.' : `${selectedServices} service${selectedServices === 1 ? '' : 's'} selected${pendingServices.length ? ` · ${pendingServices.length === 1 ? pendingServices[0] + ' stays' : 'Other work stays'} pending` : ''}`}</p><div><Button variant="ghost" disabled={busy} onClick={onClose}>{saved ? 'Close' : 'Cancel'}</Button>{!saved && <Button disabled={!canApply} onClick={() => void apply()}>{busy ? <InlineSpinner /> : <Check />}{busy ? 'Saving…' : 'Finalise'}{!busy && <ArrowRight />}</Button>}</div></div>
  </DialogContent></Dialog>;
}
