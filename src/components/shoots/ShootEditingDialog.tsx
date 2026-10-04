import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/services/api';
import { studioError } from '@/services/studioWorkspaceService';
import { registerEditingDialog, type EditingDialogRequest } from '@/services/shootEditingDispatch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type Scope = 'whole' | 'photos' | 'videos';
type Source = { id: number; version: number; name: string };
type Media = Source & { lane: 'photo' | 'video'; source: 'raw' | 'edited'; available: boolean; stack: Source[] };
interface EditingPlan {
  media: Media[];
  workflows: { id: string; label: string; available: boolean; provider: string; reason?: string }[];
  editors: { id: number; name: string; lanes: string[] }[];
  addons: { preset: string; label: string; fileIds: number[] }[];
  videoAi: { available: false; reason: string };
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

/** Two routes, as Send to editing has always had: the shoot's editors, or AI editing with a preset. */
export function ShootEditingDialog({ shootId, fileIds, onClose }: { shootId: string | number; fileIds?: number[]; onClose: (sent: boolean) => void }) {
  const selected = Boolean(fileIds?.length);
  const [plan, setPlan] = useState<EditingPlan | null>(null);
  const [mode, setMode] = useState<'ai' | 'editor'>(selected ? 'ai' : 'editor');
  const [scope, setScope] = useState<Scope>('whole');
  const [preset, setPreset] = useState(selected ? 'listing-ready' : 'full-shoot');
  const [instructions, setInstructions] = useState('');
  const [editor, setEditor] = useState('');
  const [targets, setTargets] = useState<Record<string, number[]>>({});
  const [room, setRoom] = useState('living');
  const [style, setStyle] = useState('modern');
  const [removal, setRemoval] = useState('off');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const inFlight = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  useEffect(() => {
    const controller = new AbortController();
    setPlan(null); setError(null);
    apiClient.get<{ data: EditingPlan }>(`/shoots/${shootId}/editing-plan`, { signal: controller.signal }).then(({ data }) => {
      setPlan(data.data);
      setTargets(Object.fromEntries(data.data.addons.map(addon => [addon.preset, addon.fileIds])));
    }).catch(e => { if (!controller.signal.aborted) setError(studioError(e)); });
    return () => controller.abort();
  }, [shootId, attempt]);
  const change = (action: () => void) => { action(); setError(null); requestId.current = crypto.randomUUID(); };

  const presets = (plan?.workflows ?? []).filter(value => value.id !== 'revision' && (selected ? value.id !== 'full-shoot' : true));
  const workflow = plan?.workflows.find(value => value.id === preset);
  const selectedVideo = selected && plan?.media.some(file => fileIds!.includes(file.id) && file.lane === 'video');
  const videoAi = mode === 'ai' && (scope === 'videos' || selectedVideo);
  const addons = mode === 'ai' && !selected && preset === 'full-shoot' ? plan?.addons ?? [] : [];
  const missingTargets = addons.some(addon => !targets[addon.preset]?.length);
  const blocked = !plan || videoAi || missingTargets || (mode === 'ai' && !workflow?.available);
  const photoEditors = plan?.editors.filter(value => value.lanes.includes('photo')) ?? [];

  const send = async () => {
    if (!plan || blocked || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    const body = {
      mode, request_id: requestId.current, scope: selected ? 'selected' : scope,
      ...(mode === 'ai' ? { preset } : selected ? { preset: 'revision' } : {}),
      source_versions: Object.fromEntries(plan.media.flatMap(file => file.stack.length ? file.stack : [file]).map(file => [file.id, file.version])),
      ...(selected ? { file_ids: fileIds } : {}),
      instructions, photo_editor_id: selected && mode === 'editor' && editor ? Number(editor) : null, video_editor_id: null,
      targets: addons.length ? targets : {}, staging: { roomType: room, furnitureStyle: style, removal },
    };
    try {
      await apiClient.post(`/shoots/${shootId}/editing-dispatch`, body);
      onClose(true);
    } catch (e) { setError(studioError(e)); } finally { inFlight.current = false; setBusy(false); }
  };

  const selectClass = 'mt-1 w-full rounded-md border bg-background p-2 text-sm';
  const stagingVisible = mode === 'ai' && (preset === 'virtual-staging' || addons.some(addon => addon.preset === 'virtual-staging'));
  const route = (value: 'editor' | 'ai', title: string, text: string) => <button type="button" aria-pressed={mode === value} disabled={busy}
    onClick={() => change(() => setMode(value))}
    className={`rounded-xl border p-4 text-left ${mode === value ? 'border-primary bg-primary/5' : 'border-border'}`}>
    <span className="block font-medium">{title}</span><span className="text-sm text-muted-foreground">{text}</span>
  </button>;

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(false); }}>
    <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col overflow-hidden">
      <DialogHeader><DialogTitle>Send to editing</DialogTitle>
        <DialogDescription>{selected ? `${fileIds!.length} selected file${fileIds!.length === 1 ? '' : 's'}` : 'Choose who edits this shoot.'}</DialogDescription></DialogHeader>
      <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
        {!plan && !error && <p role="status">Loading shoot media…</p>}
        {error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}<Button variant="outline" disabled={busy} onClick={() => setAttempt(value => value + 1)} className="ml-2">Refresh</Button></div>}
        {plan && <fieldset disabled={busy} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {route('editor', 'Send to editor', selected ? 'The photo editor receives these files with your instructions.' : 'Photos go to the photo editor. Videos go to the video editor.')}
            {route('ai', 'Send to AI editing', selected ? 'Edit these files with an AI preset.' : 'Edit the photos with an AI preset. Videos go to the video editor.')}
          </div>
          {!selected && <label className="block text-sm">Send<select className={selectClass} value={scope} onChange={e => change(() => setScope(e.target.value as Scope))}>
            <option value="whole">Whole shoot</option><option value="photos">Photos only</option><option value="videos">Videos only</option>
          </select></label>}
          {mode === 'ai' && !videoAi && <label className="block text-sm">Preset<select className={selectClass} value={preset} onChange={e => change(() => setPreset(e.target.value))}>
            {presets.map(value => <option key={value.id} value={value.id} disabled={!value.available}>{value.label}{value.available ? '' : ` — ${value.reason || 'Not configured'}`}</option>)}
          </select></label>}
          {videoAi && <p role="alert" className="text-sm text-muted-foreground">{plan.videoAi.reason}</p>}
          {selected && mode === 'editor' && <label className="block text-sm">Editor<select className={selectClass} value={editor} onChange={e => change(() => setEditor(e.target.value))}>
            <option value="">Assigned photo editor</option>{photoEditors.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}
          </select></label>}
          {(selected || mode === 'editor') && <label className="block text-sm">Instructions<textarea className={selectClass} rows={3} maxLength={5000} value={instructions} onChange={e => change(() => setInstructions(e.target.value))} placeholder="Describe the requested changes (optional)…" /></label>}
          {addons.map(addon => <fieldset key={addon.preset} className="rounded-lg border p-3"><legend className="px-1 text-sm">{addon.label} · {targets[addon.preset]?.length ?? 0} selected</legend>
            {!addon.fileIds.length && <p className="mb-2 text-xs text-muted-foreground">No photos are tagged for this service. Select the photos to edit before sending.</p>}
            <div className="max-h-40 space-y-2 overflow-auto">{plan.media.filter(file => file.source === 'raw' && file.lane === 'photo').map(file => <label key={file.id} className="flex gap-2 text-sm">
              <input type="checkbox" aria-label={`${addon.label}: ${file.name}`} disabled={!file.available} checked={targets[addon.preset]?.includes(file.id) ?? false} onChange={e => change(() => setTargets(previous => ({ ...previous, [addon.preset]: e.target.checked ? [...(previous[addon.preset] ?? []), file.id] : (previous[addon.preset] ?? []).filter(id => id !== file.id) })))} />{file.name}
            </label>)}</div>
          </fieldset>)}
          {stagingVisible && <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">Room type<select className={selectClass} value={room} onChange={e => change(() => setRoom(e.target.value))}>{['living', 'bed', 'kitchen', 'dining', 'home_office', 'outdoor', 'kids_room'].map(value => <option key={value}>{value}</option>)}</select></label>
            <label className="text-sm">Furniture style<select className={selectClass} value={style} onChange={e => change(() => setStyle(e.target.value))}>{['standard', 'modern', 'scandinavian', 'industrial', 'midcentury', 'luxury', 'farmhouse', 'coastal'].map(value => <option key={value}>{value}</option>)}</select></label>
            <label className="text-sm">Existing furniture<select className={selectClass} value={removal} onChange={e => change(() => setRemoval(e.target.value))}><option value="off">Keep</option><option value="auto">Detect and remove</option><option value="on">Remove</option></select></label>
          </div>}
        </fieldset>}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button variant="outline" disabled={busy} onClick={() => onClose(false)}>Cancel</Button>
        <Button disabled={blocked || busy} onClick={() => void send()}>{busy ? 'Sending…' : mode === 'ai' ? 'Send to AI editing' : 'Send to editor'}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
