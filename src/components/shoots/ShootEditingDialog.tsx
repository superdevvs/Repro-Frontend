import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/services/api';
import { studioError } from '@/services/studioWorkspaceService';
import { registerEditingDialog, type EditingDialogRequest } from '@/services/shootEditingDispatch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type Scope = 'whole' | 'photos' | 'videos' | 'selected';
type Source = { id: number; version: number; name: string };
type Media = Source & { lane: 'photo' | 'video'; source: 'raw' | 'edited'; available: boolean; unavailableReason?: string; stack: Source[]; unitId?: number };
interface EditingPlan {
  media: Media[];
  workflows: { id: string; label: string; available: boolean; provider: string; reason?: string }[];
  editors: { id: number; name: string; lanes: string[] }[];
  addons: { preset: string; label: string; fileIds: number[] }[];
  videoAi: { available: false; reason: string };
}
interface Preview {
  scope: Scope; inputCount: number; sourceCount: number;
  items: { key: string; workflow: string; sources: Source[]; destination: 'ai' | 'human'; editor_name?: string; lane: string; publication: string; shoot_service_id?: number }[];
}

export function ShootEditingDialogHost() {
  const [request, setRequest] = useState<EditingDialogRequest | null>(null);
  const pending = useRef<EditingDialogRequest | null>(null);
  useEffect(() => registerEditingDialog(next => {
    pending.current?.resolve(false); pending.current = next; setRequest(next);
  }), []);
  return request ? <ShootEditingDialog key={`${request.shootId}:${request.fileIds?.join(',')}`} {...request} onClose={sent => {
    request.resolve(sent); pending.current = null; setRequest(null);
  }} /> : null;
}

export function ShootEditingDialog({ shootId, fileIds, onClose }: { shootId: string | number; fileIds?: number[]; onClose: (sent: boolean) => void }) {
  const [plan, setPlan] = useState<EditingPlan | null>(null);
  const [scope, setScope] = useState<Scope>(fileIds ? 'selected' : 'whole');
  const [mode, setMode] = useState<'ai' | 'editor'>(fileIds ? 'ai' : 'editor');
  const [selected, setSelected] = useState<number[]>(fileIds ?? []);
  const [preset, setPreset] = useState(fileIds ? 'listing-ready' : 'full-shoot');
  const [instructions, setInstructions] = useState('');
  const [photoEditor, setPhotoEditor] = useState('');
  const [videoEditor, setVideoEditor] = useState('');
  const [targets, setTargets] = useState<Record<string, number[]>>({});
  const [room, setRoom] = useState('living');
  const [style, setStyle] = useState('modern');
  const [removal, setRemoval] = useState('off');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [mediaPage, setMediaPage] = useState(0);
  const inFlight = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const reviewedBody = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setPlan(null); setError(null); setPreview(null);
    apiClient.get<{ data: EditingPlan }>(`/shoots/${shootId}/editing-plan`, { signal: controller.signal }).then(({ data }) => {
      setPlan(data.data);
      setTargets(Object.fromEntries(data.data.addons.map(addon => [addon.preset, addon.fileIds])));
    }).catch(e => { if (!controller.signal.aborted) setError(studioError(e)); });
    return () => controller.abort();
  }, [shootId, attempt]);
  const change = (action: () => void) => {
    action(); setPreview(null); setError(null); reviewedBody.current = null; requestId.current = crypto.randomUUID();
  };
  const videoAi = mode === 'ai' && (scope === 'videos' || (scope === 'selected' && plan?.media.some(file => selected.includes(file.id) && file.lane === 'video')));
  const addons = mode === 'ai' && preset === 'full-shoot' && scope !== 'selected' ? plan?.addons ?? [] : [];
  const workflow = plan?.workflows.find(value => value.id === preset);
  const blocked = videoAi || (mode === 'ai' && !workflow?.available) || (scope === 'selected' && !selected.length);
  const review = async () => {
    if (!plan || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    const body = {
      mode, scope, preset, request_id: requestId.current,
      source_versions: Object.fromEntries(plan.media.flatMap(file => file.stack.length ? file.stack : [file]).map(file => [file.id, file.version])),
      ...(scope === 'selected' ? { file_ids: selected } : {}),
      instructions, photo_editor_id: photoEditor ? Number(photoEditor) : null, video_editor_id: videoEditor ? Number(videoEditor) : null,
      targets: addons.length ? targets : {}, staging: { roomType: room, furnitureStyle: style, removal },
    };
    try {
      const { data } = await apiClient.post<{ data: Preview }>(`/shoots/${shootId}/editing-plan`, body);
      reviewedBody.current = body; setPreview(data.data);
    } catch (e) { setError(studioError(e)); } finally { inFlight.current = false; setBusy(false); }
  };
  const send = async () => {
    if (!reviewedBody.current || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      await apiClient.post(`/shoots/${shootId}/editing-dispatch`, reviewedBody.current);
      onClose(true);
    } catch (e) { setError(studioError(e)); } finally { inFlight.current = false; setBusy(false); }
  };
  const selectClass = 'mt-1 w-full rounded-md border bg-background p-2 text-sm';
  const stagingVisible = preset === 'virtual-staging' || addons.some(addon => addon.preset === 'virtual-staging');
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(false); }}>
    <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col overflow-hidden">
      <DialogHeader><DialogTitle>Send to editing</DialogTitle><DialogDescription>Choose the files, workflow and destination, then review the exact request.</DialogDescription></DialogHeader>
      <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
        {!plan && !error && <p role="status">Loading available media and editors…</p>}
        {error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}<Button variant="outline" disabled={busy} onClick={() => setAttempt(value => value + 1)} className="ml-2">Refresh files</Button></div>}
        {plan && !preview && <fieldset disabled={busy} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Scope<select className={selectClass} value={scope} onChange={e => change(() => {
              const next = e.target.value as Scope; setScope(next);
              if (next === 'selected' && preset === 'full-shoot') setPreset('listing-ready');
            })}>
              <option value="whole">Whole shoot</option><option value="photos">Photos only</option><option value="videos">Videos only</option><option value="selected">Selected media</option>
            </select></label>
            <label className="text-sm">Destination<select className={selectClass} value={mode} onChange={e => change(() => setMode(e.target.value as 'ai' | 'editor'))}>
              <option value="editor">Human editor</option><option value="ai" disabled={scope === 'videos'}>AI editing</option>
            </select></label>
          </div>
          {scope === 'selected' && <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm">{selected.length} selected · selecting all keeps this a selected-media request.</p>
            <div className="max-h-56 space-y-2 overflow-auto">{plan.media.slice(mediaPage * 30, mediaPage * 30 + 30).map(file => <label key={file.id} className="flex items-start gap-2 text-sm">
              <input type="checkbox" aria-label={`Select ${file.name}`} disabled={!file.available} checked={selected.includes(file.id)} onChange={e => change(() => setSelected(previous => e.target.checked ? [...previous, file.id] : previous.filter(id => id !== file.id)))} className="mt-1" />
              <span>{file.name} <span className="text-muted-foreground">· {file.source} · v{file.version}{file.unitId ? ` · Unit ${file.unitId}` : ''}{file.stack.length > 1 ? ` · HDR stack: ${file.stack.length} exposures` : ''}{!file.available ? ` · ${file.unavailableReason}` : ''}</span></span>
            </label>)}</div>
            {plan.media.length > 30 && <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={mediaPage === 0} onClick={() => setMediaPage(value => value - 1)}>Previous</Button><span className="text-xs">Page {mediaPage + 1} of {Math.ceil(plan.media.length / 30)}</span><Button variant="outline" size="sm" disabled={(mediaPage + 1) * 30 >= plan.media.length} onClick={() => setMediaPage(value => value + 1)}>Next</Button></div>}
          </div>}
          <label className="block text-sm">Workflow<select className={selectClass} value={preset} onChange={e => change(() => setPreset(e.target.value))}>
            {plan.workflows.map(value => <option key={value.id} value={value.id} disabled={(mode === 'ai' && !value.available) || (value.id === 'full-shoot' && scope === 'selected')}>{value.label}{mode === 'ai' && !value.available ? ` — ${value.reason || 'Not configured'}` : ''}</option>)}
          </select></label>
          {mode === 'ai' && scope !== 'videos' && workflow && <p className="text-sm text-muted-foreground">{workflow.available ? `Photos → ${workflow.provider}` : workflow.reason}{scope === 'whole' ? ' · Videos → human video editor' : ''}</p>}
          {(scope === 'videos' || videoAi) && <p role={videoAi ? 'alert' : undefined} className="text-sm text-muted-foreground">{plan.videoAi.reason}</p>}
          {(mode === 'editor' || scope === 'whole') && <div className="grid gap-3 sm:grid-cols-2">
            {(['photo', 'video'] as const).filter(lane => mode === 'editor' || lane === 'video').map(lane => <label key={lane} className="text-sm">{lane === 'photo' ? 'Photo editor' : 'Video editor'}<select className={selectClass} value={lane === 'photo' ? photoEditor : videoEditor} onChange={e => change(() => (lane === 'photo' ? setPhotoEditor : setVideoEditor)(e.target.value))}>
              <option value="">Use the appropriate assigned editor</option>{plan.editors.filter(editor => editor.lanes.includes(lane)).map(editor => <option key={editor.id} value={editor.id}>{editor.name}</option>)}
            </select></label>)}
          </div>}
          <label className="block text-sm">Instructions<textarea className={selectClass} rows={3} maxLength={5000} value={instructions} onChange={e => change(() => setInstructions(e.target.value))} placeholder="Describe the requested changes…" /></label>
          {addons.map(addon => <fieldset key={addon.preset} className="rounded-lg border p-3"><legend className="px-1 text-sm">{addon.label} · choose photos</legend>
            <div className="max-h-40 space-y-2 overflow-auto">{plan.media.filter(file => file.source === 'raw' && file.lane === 'photo').map(file => <label key={file.id} className="flex gap-2 text-sm">
              <input type="checkbox" aria-label={`${addon.label}: ${file.name}`} checked={targets[addon.preset]?.includes(file.id) ?? false} onChange={e => change(() => setTargets(previous => ({ ...previous, [addon.preset]: e.target.checked ? [...(previous[addon.preset] ?? []), file.id] : (previous[addon.preset] ?? []).filter(id => id !== file.id) })))} />{file.name}
            </label>)}</div>
          </fieldset>)}
          {stagingVisible && <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">Room type<select className={selectClass} value={room} onChange={e => change(() => setRoom(e.target.value))}>{['living', 'bed', 'kitchen', 'dining', 'home_office', 'outdoor', 'kids_room'].map(value => <option key={value}>{value}</option>)}</select></label>
            <label className="text-sm">Furniture style<select className={selectClass} value={style} onChange={e => change(() => setStyle(e.target.value))}>{['standard', 'modern', 'scandinavian', 'industrial', 'midcentury', 'luxury', 'farmhouse', 'coastal'].map(value => <option key={value}>{value}</option>)}</select></label>
            <label className="text-sm">Existing furniture<select className={selectClass} value={removal} onChange={e => change(() => setRemoval(e.target.value))}><option value="off">Keep</option><option value="auto">Detect and remove</option><option value="on">Remove</option></select></label>
          </div>}
        </fieldset>}
        {preview && <section aria-label="Editing request preview" className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
          <p className="font-medium">Confirm {preview.inputCount} editing inputs · {preview.sourceCount} source exposures/files</p>
          <p className="text-sm">{scope === 'whole' ? 'Whole shoot' : scope === 'photos' ? 'Photos only' : scope === 'videos' ? 'Videos only' : 'Selected media'}{instructions ? ` · ${instructions}` : ''}</p>
          <ul className="max-h-64 space-y-3 overflow-auto text-sm">{preview.items.map(item => <li key={item.key}>
            <p className="font-medium">{plan?.workflows.find(value => value.id === item.workflow)?.label ?? item.workflow} → {item.destination === 'ai' ? 'AI' : item.editor_name}{item.shoot_service_id ? ` · Service ${item.shoot_service_id}` : ''}</p>
            <p className="text-muted-foreground">{item.publication}</p>
            {item.sources.map(source => <p key={source.id}>{source.name} · v{source.version}</p>)}
          </li>)}</ul>
          <p className="text-xs text-muted-foreground">Editor overrides apply to this request. Returned edits keep previous image versions.</p>
        </section>}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">{preview && <Button variant="outline" disabled={busy} onClick={() => setPreview(null)}>Back to choices</Button>}<Button variant="outline" disabled={busy} onClick={() => onClose(false)}>Cancel</Button>
        <Button disabled={!plan || busy || !!blocked} onClick={preview ? send : review}>{busy ? 'Please wait…' : preview ? 'Confirm and send' : 'Review request'}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
