import { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/services/api';
import { studioError } from '@/services/studioWorkspaceService';
import { registerEditingDialog, type EditingDialogRequest } from '@/services/shootEditingDispatch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { StudioImage } from '@/components/studio/v4/StudioImage';

type Lane = 'photo' | 'video';
type Source = { id: number; version: number; name: string };
type Media = Source & { lane: Lane; source: 'raw' | 'edited'; available: boolean; url?: string; stack: Source[] };
interface EditingPlan {
  media: Media[];
  workflows: { id: string; label: string; available: boolean; provider: string; reason?: string }[];
  editors: { id: number; name: string; lanes: string[] }[];
  addons: { preset: string; label: string; fileIds: number[] }[];
  lanes?: Record<Lane, { available: boolean; sent: boolean }>;
  assignments?: { lane: string; editor?: { name: string } | null }[];
  status?: string;
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

const DEFAULT_PRESET = 'listing-ready';
const laneLabel: Record<Lane, string> = { photo: 'Photos', video: 'Videos' };

/**
 * Without a selection the shoot's lanes go to their editors, or the photos to the AI full-shoot workflow.
 * With a selection only those files go, to an editor or to AI with a preset per photo.
 */
export function ShootEditingDialog({ shootId, fileIds, onClose }: { shootId: string | number; fileIds?: number[]; onClose: (sent: boolean) => void }) {
  const selected = Boolean(fileIds?.length);
  const [plan, setPlan] = useState<EditingPlan | null>(null);
  const [mode, setMode] = useState<'ai' | 'editor'>('editor');
  const [lanes, setLanes] = useState<Record<Lane, boolean>>({ photo: false, video: false });
  const [presets, setPresets] = useState<Record<number, string>>({});
  const [instructions, setInstructions] = useState('');
  const [editor, setEditor] = useState('');
  const [targets, setTargets] = useState<Record<string, number[]>>({});
  const [room, setRoom] = useState('living');
  const [style, setStyle] = useState('modern');
  const [removal, setRemoval] = useState('off');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [sentGroups, setSentGroups] = useState<string[]>([]);
  const inFlight = useRef(false);
  const requestIds = useRef<Record<string, string>>({});
  useEffect(() => {
    const controller = new AbortController();
    setPlan(null); setError(null);
    apiClient.get<{ data: EditingPlan }>(`/shoots/${shootId}/editing-plan`, { signal: controller.signal }).then(({ data }) => {
      setPlan(data.data);
      setTargets(Object.fromEntries(data.data.addons.map(addon => [addon.preset, addon.fileIds])));
      const open = (lane: Lane) => Boolean(data.data.lanes?.[lane].available && !data.data.lanes?.[lane].sent);
      setLanes({ photo: open('photo'), video: open('video') });
    }).catch(e => { if (!controller.signal.aborted) setError(studioError(e)); });
    return () => controller.abort();
  }, [shootId, attempt]);
  const change = (action: () => void) => { action(); setError(null); requestIds.current = {}; };

  const lane = (value: Lane) => plan?.lanes?.[value] ?? { available: false, sent: false };
  const selectedMedia = useMemo(() => (plan?.media ?? []).filter(file => fileIds?.includes(file.id)), [plan, fileIds]);
  const selectedVideo = selectedMedia.some(file => file.lane === 'video');
  const assignedPhotoEditor = plan?.assignments?.find(value => value.lane === 'photo')?.editor?.name;
  const beforeDelivery = !plan?.status || ['uploaded', 'editing'].includes(plan.status);
  const photoPresets = (plan?.workflows ?? []).filter(value => !['full-shoot', 'revision'].includes(value.id));
  const fullShoot = plan?.workflows.find(value => value.id === 'full-shoot');
  // One row per photo: the exposures of an HDR stack share a preset and are merged before editing.
  const rows = useMemo(() => {
    const byStack = new Map<string, { key: number; file: Media; ids: number[] }>();
    for (const file of selectedMedia) {
      const stackKey = file.stack.length > 1 ? file.stack.map(member => member.id).sort((a, b) => a - b).join(',') : String(file.id);
      const row = byStack.get(stackKey);
      if (row) row.ids.push(file.id); else byStack.set(stackKey, { key: file.id, file, ids: [file.id] });
    }
    return [...byStack.values()];
  }, [selectedMedia]);
  const presetOf = (key: number) => presets[key] ?? DEFAULT_PRESET;
  const groups = useMemo(() => {
    const byPreset: Record<string, number[]> = {};
    for (const row of rows) (byPreset[presets[row.key] ?? DEFAULT_PRESET] ??= []).push(...row.ids);
    return Object.entries(byPreset);
  }, [rows, presets]);
  const addons = mode === 'ai' && !selected ? plan?.addons ?? [] : [];
  const stagingVisible = mode === 'ai' && (selected ? groups.some(([preset]) => preset === 'virtual-staging') : addons.some(addon => addon.preset === 'virtual-staging'));

  const nothingLeft = !selected && !lane('photo').available && !lane('video').available ? 'No uploaded media is ready to send yet.'
    : !selected && ['photo', 'video'].every(value => !lane(value as Lane).available || lane(value as Lane).sent)
      ? 'This shoot has already been sent to editing. Select photos or videos in the media tab, then press Editing to send them again.' : null;
  const blockedReason = !plan ? null
    : nothingLeft
    ?? (selected && mode === 'ai' && selectedVideo ? plan.videoAi.reason : null)
    ?? (selected && mode === 'ai' ? groups.map(([preset]) => plan.workflows.find(value => value.id === preset)).find(value => value && !value.available)?.reason ?? null : null)
    ?? (!selected && mode === 'ai' && lane('photo').sent ? 'The photos were already sent to editing.' : null)
    ?? (!selected && mode === 'ai' && !fullShoot?.available ? fullShoot?.reason || 'Full shoot enhancement is not configured.' : null)
    ?? (!selected && mode === 'ai' && addons.some(addon => !targets[addon.preset]?.length) ? 'Select the photos for each add-on before sending.' : null)
    ?? (!selected && mode === 'editor' && !lanes.photo && !lanes.video ? 'Turn on Photos or Videos.' : null);

  const base = () => ({
    mode, instructions, source_versions: Object.fromEntries(plan!.media.flatMap(file => file.stack.length ? file.stack : [file]).map(file => [file.id, file.version])),
    photo_editor_id: selected && mode === 'editor' && editor ? Number(editor) : null, video_editor_id: null,
    staging: { roomType: room, furnitureStyle: style, removal },
  });
  const requests = (): [string, Record<string, unknown>][] => {
    if (selected && mode === 'ai') return groups.map(([preset, ids]) => [preset, { ...base(), scope: 'selected', preset, file_ids: ids }]);
    if (selected) return [['editor', { ...base(), scope: 'selected', preset: 'revision', file_ids: fileIds }]];
    // AI edits the photos; when Videos is on they go to the video editor in the same request.
    if (mode === 'ai') return [['full-shoot', { ...base(), scope: lanes.video ? 'whole' : 'photos', preset: 'full-shoot', targets: addons.length ? targets : {} }]];
    return [['editor', { ...base(), scope: lanes.photo && lanes.video ? 'whole' : lanes.photo ? 'photos' : 'videos' }]];
  };
  const send = async () => {
    if (!plan || blockedReason || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    const done = [...sentGroups];
    try {
      for (const [key, body] of requests()) {
        if (done.includes(key)) continue;
        requestIds.current[key] ??= crypto.randomUUID();
        try {
          await apiClient.post(`/shoots/${shootId}/editing-dispatch`, { ...body, request_id: requestIds.current[key] });
        } catch (e) {
          const label = plan.workflows.find(value => value.id === key)?.label;
          throw new Error(selected && mode === 'ai' && label ? `${label}: ${studioError(e)}` : studioError(e));
        }
        done.push(key); setSentGroups([...done]);
      }
      onClose(true);
    } catch (e) { setError((e as Error).message); } finally { inFlight.current = false; setBusy(false); }
  };

  const selectClass = 'mt-1 w-full rounded-md border bg-background p-2 text-sm';
  const route = (value: 'editor' | 'ai', title: string, text: string) => <button type="button" aria-pressed={mode === value}
    onClick={() => change(() => setMode(value))}
    className={`rounded-xl border p-4 text-left ${mode === value ? 'border-primary bg-primary/5' : 'border-border'}`}>
    <span className="block font-medium">{title}</span><span className="text-sm text-muted-foreground">{text}</span>
  </button>;
  const laneToggle = (value: Lane) => {
    const state = lane(value);
    const aiPhoto = mode === 'ai' && value === 'photo';
    const disabled = aiPhoto || !state.available || state.sent;
    const checked = aiPhoto ? state.available && !state.sent : lanes[value];
    const note = state.sent ? 'Already sent to editing.' : !state.available ? `No ${laneLabel[value].toLowerCase()} uploaded.`
      : aiPhoto ? 'Full shoot enhancement (Fotello).'
        : mode === 'ai' ? 'Goes to the video editor. AI video editing is not available yet.' : `Goes to the ${value} editor.`;
    return <label key={value} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${disabled && !checked ? 'opacity-60' : ''}`}>
      <span><span className="block text-sm font-medium">{laneLabel[value]}</span><span className="text-xs text-muted-foreground">{note}</span></span>
      <Switch aria-label={laneLabel[value]} checked={checked} disabled={disabled} onCheckedChange={on => change(() => setLanes(previous => ({ ...previous, [value]: on })))} />
    </label>;
  };

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(sentGroups.length > 0); }}>
    <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col overflow-hidden">
      <DialogHeader><DialogTitle>Send to editing</DialogTitle>
        <DialogDescription>{selected ? `${fileIds!.length} selected file${fileIds!.length === 1 ? '' : 's'}` : 'Send this shoot to its editors or to AI editing.'}</DialogDescription></DialogHeader>
      <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
        {!plan && !error && <p role="status">Loading shoot media…</p>}
        {error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}{!plan && <Button variant="outline" onClick={() => setAttempt(value => value + 1)} className="ml-2">Refresh</Button>}</div>}
        {plan && <fieldset disabled={busy || sentGroups.length > 0} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {route('editor', 'Send to editor', selected ? 'The photo or video editor receives these files.' : 'Photos go to the photo editor. Videos go to the video editor.')}
            {route('ai', 'Send to AI editing', selected ? 'Choose an AI preset for each photo.' : 'Photos get Full shoot enhancement. Videos go to the video editor.')}
          </div>
          {!selected && <div className="grid gap-2 sm:grid-cols-2">{(['photo', 'video'] as const).map(laneToggle)}</div>}
          {selected && mode === 'editor' && <>
            <ul aria-label="Selected files" className="max-h-40 space-y-1 overflow-auto rounded-lg border p-2 text-sm">{selectedMedia.map(file => <li key={file.id}>{file.name}</li>)}</ul>
            {!selectedVideo && <label className="block text-sm">Editor<select className={selectClass} value={editor} onChange={e => change(() => setEditor(e.target.value))}>
              <option value="">{assignedPhotoEditor ? `Assigned photo editor (${assignedPhotoEditor})` : 'Assigned photo editor'}</option>{plan.editors.filter(value => value.lanes.includes('photo')).map(value => <option key={value.id} value={value.id}>{value.name}</option>)}
            </select></label>}
            {!selectedVideo && editor && assignedPhotoEditor && plan.editors.find(value => String(value.id) === editor)?.name !== assignedPhotoEditor
              && <p className="text-xs text-muted-foreground">This reassigns the shoot's photos from {assignedPhotoEditor}.</p>}
            <p className="text-xs text-muted-foreground">{beforeDelivery
              ? "The editor works these files from the shoot's media and uploads the edits in Edited. The file names and instructions are added to the shoot's editing notes."
              : 'The editor receives these files as a revision task in their Editing tasks.'}</p>
          </>}
          {selected && mode === 'ai' && !selectedVideo && <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">Set all to<select aria-label="Set all presets" className="rounded-md border bg-background p-1.5 text-sm" value="" onChange={e => { const value = e.target.value; if (value) change(() => setPresets(Object.fromEntries(rows.map(row => [row.key, value])))); }}>
              <option value="">Choose…</option>{photoPresets.map(value => <option key={value.id} value={value.id} disabled={!value.available}>{value.label}</option>)}
            </select></label>
            <ul aria-label="Selected photos" className="max-h-72 space-y-2 overflow-auto rounded-lg border p-2">{rows.map(({ key, file, ids }) => <li key={key} className="flex items-center gap-3">
              <div className="h-12 w-16 shrink-0 overflow-hidden rounded bg-muted">{file.url && <StudioImage src={file.url} alt="" className="h-full w-full object-cover" />}</div>
              <span className="min-w-0 flex-1 truncate text-sm" title={file.name}>{file.name}{file.stack.length > 1 && <span className="block text-xs text-muted-foreground">HDR · {file.stack.length} exposures{ids.length < file.stack.length ? ` (${ids.length} selected)` : ''}</span>}</span>
              <select aria-label={`Preset for ${file.name}`} className="w-44 rounded-md border bg-background p-1.5 text-sm" value={presetOf(key)} onChange={e => change(() => setPresets(previous => ({ ...previous, [key]: e.target.value })))}>
                {photoPresets.map(value => <option key={value.id} value={value.id} disabled={!value.available}>{value.label}{value.available ? '' : ` — ${value.reason || 'Not configured'}`}</option>)}
              </select>
            </li>)}</ul>
            <p className="text-xs text-muted-foreground">{groups.map(([preset]) => `${plan.workflows.find(value => value.id === preset)?.label ?? preset}: ${rows.filter(row => presetOf(row.key) === preset).length}`).join(' · ')} — each preset is sent as its own AI editing project.</p>
          </div>}
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
        {plan && blockedReason && <p role="note" className="text-sm text-muted-foreground">{blockedReason}</p>}
        {sentGroups.length > 0 && error && <p className="text-sm">Already sent: {sentGroups.map(key => plan?.workflows.find(value => value.id === key)?.label ?? key).join(', ')}. Retry sends only the rest.</p>}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button variant="outline" disabled={busy} onClick={() => onClose(sentGroups.length > 0)}>Cancel</Button>
        <Button disabled={!plan || Boolean(blockedReason) || busy} onClick={() => void send()}>{busy ? 'Sending…' : sentGroups.length > 0 ? 'Retry remaining' : mode === 'ai' ? 'Send to AI editing' : 'Send to editor'}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
