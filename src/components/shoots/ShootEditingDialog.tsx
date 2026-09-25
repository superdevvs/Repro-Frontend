import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/services/api';
import { studioError } from '@/services/studioWorkspaceService';
import { registerEditingDialog, type EditingDialogRequest } from '@/services/shootEditingDispatch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StudioImage } from '@/components/studio/v4/StudioImage';

interface EditingPlan {
  shootId: number;
  photoCount: number;
  photos: { id: number; name: string; url: string; available: boolean }[];
  services: string[];
  addons: { preset: string; label: string; fileIds: number[] }[];
  hasVideo: boolean;
}

export function ShootEditingDialogHost() {
  const [request, setRequest] = useState<EditingDialogRequest | null>(null);
  const pending = useRef<EditingDialogRequest | null>(null);
  useEffect(() => registerEditingDialog(next => {
    pending.current?.resolve(false);
    pending.current = next;
    setRequest(next);
  }), []);
  return request ? <ShootEditingDialog key={`${request.shootId}:${request.fileIds?.join(',')}`} shootId={request.shootId} fileIds={request.fileIds} onClose={sent => {
    request.resolve(sent); pending.current = null; setRequest(null);
  }} /> : null;
}

export function ShootEditingDialog({ shootId, fileIds, onClose }: { shootId: string | number; fileIds?: number[]; onClose: (sent: boolean) => void }) {
  const [plan, setPlan] = useState<EditingPlan | null>(null);
  const [mode, setMode] = useState<'ai' | 'editor'>(fileIds ? 'ai' : 'editor');
  const [targets, setTargets] = useState<Record<string, number[]>>({});
  const [preset, setPreset] = useState('listing-ready');
  const [room, setRoom] = useState('living');
  const [style, setStyle] = useState('modern');
  const [removal, setRemoval] = useState('off');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestId = useRef(crypto.randomUUID());
  useEffect(() => {
    let active = true;
    setError(null);
    apiClient.get<{ data: EditingPlan }>(`/shoots/${shootId}/editing-plan`).then(({ data }) => {
      if (!active) return;
      setPlan(data.data);
      setTargets(Object.fromEntries(data.data.addons.map(addon => [addon.preset, addon.fileIds])));
      if (!data.data.photos.length) setMode('editor');
    }).catch(e => { if (active) setError(studioError(e)); });
    return () => { active = false; };
  }, [shootId, attempt]);
  const allPhotos = !!plan && (!fileIds || (fileIds.length === plan.photoCount && plan.photos.length === plan.photoCount && plan.photos.every(photo => fileIds.includes(photo.id))));
  const addons = allPhotos && mode === 'ai' ? plan?.addons ?? [] : [];
  const needsTargets = addons.some(addon => !targets[addon.preset]?.length);
  const unavailable = mode === 'ai' && plan?.photos.some(photo => (!fileIds || fileIds.includes(photo.id)) && !photo.available);
  const send = async () => {
    setBusy(true); setError(null);
    try {
      await apiClient.post(`/shoots/${shootId}/editing-dispatch`, {
        mode, request_id: requestId.current, ...(fileIds ? { file_ids: fileIds } : {}), preset, targets: mode === 'ai' && allPhotos ? targets : {},
        staging: { roomType: room, furnitureStyle: style, removal },
      });
      onClose(true);
    } catch (e) { setError(studioError(e)); } finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(false); }}>
    <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col overflow-hidden">
      <DialogHeader><DialogTitle>Send to editing</DialogTitle><DialogDescription>Choose how to edit this shoot and confirm photos for its services.</DialogDescription></DialogHeader>
      <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
        {!plan && !error && <p role="status">Loading shoot services and photos…</p>}
        {error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}{!plan && <Button variant="outline" onClick={() => setAttempt(value => value + 1)} className="ml-3">Retry</Button>}</div>}
        {plan && <>
          <p className="text-sm text-muted-foreground">{plan.services.join(' · ') || 'Shoot media'} · {fileIds?.length ?? plan.photos.length} photos</p>
          {!fileIds && <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" aria-pressed={mode === 'editor'} onClick={() => setMode('editor')} disabled={busy} className={`rounded-xl border p-4 text-left ${mode === 'editor' ? 'border-primary bg-primary/5' : 'border-border'}`}><span className="block font-medium">Send to editor</span><span className="text-sm text-muted-foreground">Photos go to the photo editor. Videos go to the video editor.</span></button>
            <button type="button" aria-pressed={mode === 'ai'} onClick={() => setMode('ai')} disabled={busy || !plan.photos.length} className={`rounded-xl border p-4 text-left ${mode === 'ai' ? 'border-primary bg-primary/5' : 'border-border'}`}><span className="block font-medium">Send to AI editing</span><span className="text-sm text-muted-foreground">Edit the full photo shoot and its add-ons. Videos go to the video editor.</span></button>
          </div>}
          {mode === 'ai' && <div className="rounded-lg bg-muted/40 p-3 text-sm">{allPhotos ? `Full Shoot · Fotello · all ${plan.photos.length} photos` : `Selected photos · Autoenhance · ${fileIds?.length} photos`}<p className="mt-1 text-muted-foreground">{allPhotos ? 'Full-shoot photos go to In Review for approval. Staging and grass results appear directly in their Edited categories.' : 'Finished selected-photo edits appear directly in Edited, without a review step.'}</p></div>}
          {mode === 'ai' && !allPhotos && <label className="block space-y-2 text-sm"><span>Photo edit</span><select className="w-full rounded-md border bg-background p-2" value={preset} onChange={e => setPreset(e.target.value)} disabled={busy}>
            <option value="listing-ready">Auto enhance</option><option value="color-correction">Color correction</option><option value="sky-replacement">Sky replacement</option><option value="perspective-correction">Perspective correction</option><option value="green-grass">Grass greening</option><option value="upscale">Upscale</option>
          </select></label>}
          {addons.map(addon => <fieldset key={addon.preset} disabled={busy} className="space-y-3 rounded-xl border p-4">
            <legend className="px-1 text-sm font-medium">{addon.label} · {targets[addon.preset]?.length ?? 0} selected</legend>
            <p className="text-xs text-muted-foreground">{addon.fileIds.length ? 'Tagged photos are selected. Adjust the selection if needed.' : 'No photos are tagged for this service. Select the photos to edit before sending.'}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{plan.photos.map(photo => <label key={photo.id} className={`relative cursor-pointer overflow-hidden rounded-lg border ${targets[addon.preset]?.includes(photo.id) ? 'border-primary ring-1 ring-primary' : ''}`}>
              <StudioImage src={photo.url} alt={photo.name} className="aspect-[4/3] w-full object-cover" />
              <input type="checkbox" aria-label={`${addon.label}: ${photo.name}`} checked={targets[addon.preset]?.includes(photo.id) ?? false} disabled={!photo.available} className="absolute left-2 top-2 h-4 w-4" onChange={e => setTargets(previous => ({ ...previous, [addon.preset]: e.target.checked ? [...(previous[addon.preset] ?? []), photo.id] : previous[addon.preset].filter(id => id !== photo.id) }))} />
              <span className="block truncate p-1 text-[11px]" title={photo.name}>{photo.name}</span>
            </label>)}</div>
            {addon.preset === 'virtual-staging' && <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs">Room type<select aria-label="Room type" value={room} onChange={e => setRoom(e.target.value)} className="mt-1 w-full rounded border bg-background p-2">{Object.entries({ living: 'Living room', bed: 'Bedroom', kitchen: 'Kitchen', dining: 'Dining room', home_office: 'Home office', outdoor: 'Outdoor', kids_room: 'Kids room' }).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label className="text-xs">Furniture style<select aria-label="Furniture style" value={style} onChange={e => setStyle(e.target.value)} className="mt-1 w-full rounded border bg-background p-2">{['standard', 'modern', 'scandinavian', 'industrial', 'midcentury', 'luxury', 'farmhouse', 'coastal'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
              <label className="text-xs">Existing furniture<select aria-label="Existing furniture" value={removal} onChange={e => setRemoval(e.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="off">Keep</option><option value="auto">Detect and remove</option><option value="on">Remove</option></select></label>
            </div>}
          </fieldset>)}
          {unavailable && <p role="alert" className="text-sm text-destructive">Some selected photos are still awaiting a successful safety scan. Wait for scanning to finish before sending.</p>}
          {!fileIds && mode === 'ai' && plan.hasVideo && <p className="text-sm text-muted-foreground">The video editor will receive the video services through the existing editor workflow.</p>}
        </>}
      </div>
      <div className="flex justify-end gap-2 border-t pt-4"><Button variant="outline" disabled={busy} onClick={() => onClose(false)}>Cancel</Button><Button disabled={!plan || busy || needsTargets || !!unavailable || (mode === 'ai' && !plan.photos.length)} onClick={() => void send()}>{busy ? 'Sending…' : mode === 'ai' ? 'Send to AI editing' : 'Send to editor'}</Button></div>
    </DialogContent>
  </Dialog>;
}
