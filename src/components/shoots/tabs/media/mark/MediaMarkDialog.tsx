import { useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, EyeOff, Tag } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { Switch } from '@/components/ui/switch';
import { useShootMutationRefresh } from '@/hooks/useShootMutationRefresh';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { applyServiceAssignment, assignmentIdentities, MediaMarkRequestError, previewServiceAssignment, selectedMediaIds, type AssignmentPreview } from '@/services/mediaMarkService';
import { markMenuOptions, type ReclassifyMediaType } from '../shootMediaActionTypes';
import { formatUploadFileSize } from '../mediaUploadUtils';
import { MediaMarkServicePanel } from './MediaMarkServicePanel';
import { MediaMarkFinaliseDialog } from './MediaMarkFinaliseDialog';
import { MEDIA_MARK_EVENT, STAFF_MARK_ROLES, type MediaMarkRequest } from './mediaMarkEvents';
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

/** "Finalise shoot" is a shoot-level action; marking files is one screen without tabs. */
export function MediaMarkDialog({ request, onClose }: { request: MediaMarkRequest; onClose: () => void }) {
  return request.initialTab === 'delivery'
    ? <MediaMarkFinaliseDialog request={request} onClose={onClose} />
    : <MediaMarkFilesDialog request={request} onClose={onClose} />;
}

const categoryLabel = (type?: string) => {
  const value = String(type ?? '').toLowerCase();
  const normalized = ['edited', 'main', 'main_photos'].includes(value) ? 'photos' : value;
  return markMenuOptions.find(option => option.value === normalized)?.label;
};

function MediaMarkFilesDialog({ request, onClose }: { request: MediaMarkRequest; onClose: () => void }) {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const refresh = useShootMutationRefresh();
  const currentRole = String(role || user?.role).toLowerCase();
  const staff = STAFF_MARK_ROLES.includes(currentRole);
  const files = request.files ?? [];
  const ids = selectedMediaIds(files);
  const idKey = ids.join(',');
  const shootId = request.shootId;
  const complete = ids.length > 0 && ids.length === files.length;
  const allowType = Boolean([...STAFF_MARK_ROLES, 'editor', 'photographer'].includes(currentRole) && request.allowType && complete && files.every(file => file.can_interact !== false));
  // Only admins and editing managers may hide delivered (edited) media from the client.
  const canSetVisibility = staff && complete && files.every(file => ['completed', 'verified'].includes(String(file.workflowStage ?? '').toLowerCase()));

  const [discovery, setDiscovery] = useState<AssignmentPreview | null>(null);
  const [loadingServices, setLoadingServices] = useState(staff && complete);
  const [preview, setPreview] = useState<AssignmentPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [historical, setHistorical] = useState(false);
  const [assignmentReason, setAssignmentReason] = useState('');
  const [historicalConfirmed, setHistoricalConfirmed] = useState(false);
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID());
  const [category, setCategory] = useState<ReclassifyMediaType | ''>('');
  const hiddenCount = files.filter(file => file.is_client_hidden).length;
  const [hidden, setHidden] = useState<boolean | null>(() => hiddenCount === 0 ? false : hiddenCount === files.length ? true : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    if (!staff || !idKey) return;
    const controller = new AbortController();
    setLoadingServices(true);
    void previewServiceAssignment(shootId, { file_ids: idKey.split(',').map(Number), confirm_historical: historical }, controller.signal)
      .then(value => { if (!controller.signal.aborted) setDiscovery(value); })
      .catch(() => { if (!controller.signal.aborted) setDiscovery(null); })
      .finally(() => { if (!controller.signal.aborted) setLoadingServices(false); });
    return () => controller.abort();
  }, [shootId, staff, idKey, historical]);

  const canAssign = staff && complete && Boolean(discovery?.capabilities.can_assign_service);
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

  const targetName = discovery?.targets.find(target => String(target.id) === targetId)?.name || 'the booked service';
  const serviceChange = canAssign && Boolean(targetId);
  const serviceReady = !serviceChange || Boolean(preview?.can_apply && !previewing && (!preview.requires_historical_confirmation || historicalConfirmed)
    && (!discovery?.files.some(file => file.shoot_service_id != null) || assignmentReason.trim().length >= 3));
  const categoryChange = allowType && Boolean(category);
  const visibilityChanges = !canSetVisibility || hidden === null ? 0 : hidden ? files.length - hiddenCount : hiddenCount;
  const pending = [serviceChange && `Move to ${targetName}`, categoryChange && `Category: ${categoryLabel(category)}`,
    visibilityChanges > 0 && (hidden ? 'Hidden from client' : 'Visible to client')].filter(Boolean) as string[];
  const canApply = !busy && !saved && pending.length > 0 && serviceReady;
  const nothingAvailable = !allowType && !canSetVisibility && !loadingServices && !canAssign;
  const plural = (count: number) => `${count} file${count === 1 ? '' : 's'}`;

  const apply = async () => {
    if (!canApply) return;
    setBusy(true); setError('');
    const done: string[] = [];
    try {
      if (serviceChange) {
        await applyServiceAssignment(shootId, { file_ids: ids, shoot_service_id: Number(targetId), expected_target_unit_id: discovery?.targets.find(target => String(target.id) === targetId)?.unit_id ?? null, expected_files: assignmentIdentities(preview?.files ?? []), idempotency_key: attemptKey, reason: assignmentReason.trim() || undefined, confirm_historical: historical, expected_receipt_revision: preview?.receipt_revision });
        done.push(`Moved ${plural(ids.length)} to ${targetName}.`);
      }
      if (categoryChange) {
        const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/files/reclassify`, { method: 'PATCH', headers: getApiHeaders(), body: JSON.stringify({ file_ids: ids, media_type: category }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Media category could not be saved.');
        done.push(`Set ${plural(ids.length)} to ${categoryLabel(category)}.`);
      }
      if (visibilityChanges > 0) {
        const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/files/client-visibility`, { method: 'PATCH', headers: getApiHeaders(), body: JSON.stringify({ file_ids: ids, hidden }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Client visibility could not be saved.');
        done.push(hidden ? `Hid ${plural(visibilityChanges)} from the client. Admins and editing managers still see ${visibilityChanges === 1 ? 'it' : 'them'}.`
          : `${plural(visibilityChanges)} ${visibilityChanges === 1 ? 'is' : 'are'} visible to the client again.`);
      }
      setSaved(done.join(' '));
      refresh(shootId); await request.onChanged?.();
      toast({ title: 'Changes saved', description: pending.join(' · ') });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The change could not be saved.';
      setError(done.length ? `${done.join(' ')} The next change failed: ${message}` : message);
      if (done.length) { refresh(shootId); await request.onChanged?.(); }
      if (serviceChange && !done.length && cause instanceof MediaMarkRequestError && [409, 422].includes(cause.status)) {
        setPreview(null); setTargetId(''); setHistoricalConfirmed(false);
        const fresh = await previewServiceAssignment(shootId, { file_ids: ids, confirm_historical: historical }).catch(() => null);
        if (fresh) setDiscovery(fresh);
      }
    } finally { setBusy(false); }
  };

  const sameCategory = new Set(files.map(file => categoryLabel(file.media_type) ?? 'Other')).size === 1 ? categoryLabel(files[0]?.media_type) : undefined;
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="media-mark-dialog" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
    <DialogHeader className="mark-header"><span className="mark-title-icon"><Tag /></span><div><DialogTitle>Mark media</DialogTitle><DialogDescription>{request.shootLabel || `Shoot #${shootId}`}</DialogDescription></div></DialogHeader>
    <div className="mark-selection"><div className="mark-thumbnails">{files.slice(0, 4).map(file => <span key={file.id}>{file.grid_url || file.thumbnail_url || file.thumb ? <img src={file.grid_url || file.thumbnail_url || file.thumb} alt="" /> : <Tag />}</span>)}</div><div><strong>{ids.length ? `${plural(ids.length)} selected` : 'No media selected'}</strong><small>{ids.length ? `${formatUploadFileSize(files.reduce((sum, file) => sum + (file.fileSize || 0), 0))} · Original files preserved` : 'Choose files in the media library to mark them'}</small></div></div>
    <div className="mark-body mark-unified">
      {error && <div className="mark-error" role="alert"><AlertCircle /><p>{error}</p></div>}
      {saved ? <div className="mark-empty mark-success" role="status"><CheckCircle2 /><h3>All set</h3><p>{saved}</p></div>
        : nothingAvailable ? <div className="mark-empty"><Tag /><h3>{ids.length ? 'This action is unavailable' : 'Select media to mark'}</h3><p>{ids.length ? 'Your current permissions or this shoot’s work state do not allow this change.' : 'Choose files in the media library to change their service, category or visibility.'}</p></div>
          : <>
            {staff && complete && <section className="mark-section" aria-labelledby="mark-service-heading">
              <h3 id="mark-service-heading" className="mark-section-title">Service</h3>
              {loadingServices ? <div className="mark-notice" role="status"><InlineSpinner /><span>Loading booked services…</span></div>
                : canAssign ? <MediaMarkServicePanel discovery={discovery} targetId={targetId} onChange={id => { setTargetId(current => current === id ? '' : id); setHistoricalConfirmed(false); setAttemptKey(crypto.randomUUID()); }} preview={preview} previewing={previewing} count={ids.length} historical={historical} onHistorical={value => { setHistorical(value); setHistoricalConfirmed(false); setTargetId(''); setPreview(null); setAttemptKey(crypto.randomUUID()); }} reason={assignmentReason} onReason={value => { setAssignmentReason(value); setHistoricalConfirmed(false); setAttemptKey(crypto.randomUUID()); }} historicalConfirmed={historicalConfirmed} onHistoricalConfirm={setHistoricalConfirmed} />
                  : <p className="mark-notice">Service assignment isn’t available for these files.</p>}
            </section>}
            {allowType && <section className="mark-section">
              <label className="mark-field">Category<select value={category} onChange={event => setCategory(event.target.value as ReclassifyMediaType | '')}>
                <option value="">{sameCategory ? `Keep current (${sameCategory})` : 'Keep current categories'}</option>
                {markMenuOptions.map(option => <option key={option.value} value={option.value}>{option.label}{option.value === 'extra' ? ' (not delivered)' : ''}</option>)}
              </select></label>
              <p className="mark-hint">Sets where the media appears in the gallery. The booked service stays the same.</p>
            </section>}
            {canSetVisibility && <section className="mark-section mark-visibility">
              <EyeOff aria-hidden="true" />
              <div><strong id="mark-hidden-label">Hidden from client</strong><small>{hidden === null && hiddenCount > 0 ? `${hiddenCount} of ${files.length} selected files are hidden now. ` : ''}Kept out of the client gallery, downloads, ZIPs and share links. Admins and editing managers still see it.</small></div>
              <Switch aria-labelledby="mark-hidden-label" checked={hidden === true} onCheckedChange={value => setHidden(value)} disabled={busy} />
            </section>}
          </>}
    </div>
    <div className="mark-footer"><p>{saved ? 'The shoot and media library have been refreshed.' : pending.length ? pending.join(' · ') : 'Choose what to change. Only changed settings are saved.'}</p><div><Button variant="ghost" disabled={busy} onClick={onClose}>{saved ? 'Close' : 'Cancel'}</Button>{!saved && <Button disabled={!canApply} onClick={() => void apply()}>{busy ? <InlineSpinner /> : <Check />}{busy ? 'Saving…' : 'Save changes'}</Button>}</div></div>
  </DialogContent></Dialog>;
}
