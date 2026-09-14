import { StudioImage } from './StudioImage';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCheck, ChevronRight, FolderOpen, ImagePlus, Search, UploadCloud, X } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type SourceMedia, type StudioShootRef } from '@/services/studioService';
import { studioError, workspaceSources as studioService } from '@/services/studioWorkspaceService';
import { usePickerSources, type SourceTab } from './usePickerSources';
import { PickerPhotoCard } from './PickerPhotoCard';
import type { V4Media, V4Preset } from './types';

interface Props { open: boolean; onClose: () => void; selected: V4Media[]; preset: V4Preset; initialShoot?: StudioShootRef | null; onSelect: (media: V4Media[], label: string) => void }
export function MediaPicker({ open, onClose, selected, preset, initialShoot, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [shoots, setShoots] = useState<StudioShootRef[]>([]);
  const [active, setActive] = useState<StudioShootRef | null>(initialShoot || null);
  const [photos, setPhotos] = useState<SourceMedia[]>([]);
  const [tab, setTab] = useState<SourceTab>('raw');
  const [selection, setSelection] = useState<V4Media[]>(selected);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { tiles, rawCount, editedCount, retryMerge } = usePickerSources(photos, open && !!active && !loading, tab);
  const available = tiles.flatMap(tile => tile.media ? [tile.media] : []);
  useEffect(() => { if (open) { setSelection(selected); setError(null); } }, [open, selected]);
  useEffect(() => { if (initialShoot) { setActive(initialShoot); setTab('raw'); setLabels(prev => ({ ...prev, [initialShoot.id]: initialShoot.address || initialShoot.label })); } }, [initialShoot]);
  useEffect(() => {
    if (!open || active) return;
    let current = true;
    setLoading(true); setError(null);
    const timer = window.setTimeout(() => {
      studioService.searchShoots(search).then(items => { if (current) setShoots(items); }).catch(e => { if (current) setError(studioError(e)); }).finally(() => { if (current) setLoading(false); });
    }, 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [search, open, active]);
  useEffect(() => {
    if (!active || !open) return;
    let current = true; setLoading(true); setPhotos([]); setError(null);
    studioService.getShootMedia(active.id, preset.workflow).then(items => {
      if (current) {
        setPhotos(items);
        if (!items.some(m => !m.workflowStage || m.workflowStage === 'todo')) setTab('edited');
      }
    }).catch(e => { if (current) setError(studioError(e)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [active, open, preset.workflow]);
  const toggle = (media: V4Media) => setSelection(items => items.some(m => m.id === media.id) ? items.filter(m => m.id !== media.id) : [...items.filter(m => !m.fileId || !media.stackFileIds?.includes(m.fileId)), media]);
  const selectAll = () => setSelection(prev => [...prev.filter(m => !available.some(p => p.id === m.id || (m.fileId && p.stackFileIds?.includes(m.fileId)))), ...available]);
  const browseShoot = (shoot: StudioShootRef) => {
    setPhotos([]); setTab('raw'); setActive(shoot);
    setLabels(prev => ({ ...prev, [shoot.id]: shoot.address || shoot.label }));
  };
  const upload = async (files: FileList | File[]) => {
    if (!files.length || uploading) return;
    setUploading(true); setError(null);
    try {
      const result = await studioService.upload(Array.from(files), preset.workflow, (_, percent) => setProgress(percent));
      const media: V4Media[] = result.accepted.map(m => ({ id: `upload:${m.id}`, mediaRef: m.mediaRef, name: m.filename, kind: m.mediaType === 'video' ? 'video' : m.mediaType === 'raw' ? 'raw' : 'image', url: m.previewUrl || m.url, thumbnailUrl: m.previewUrl || m.url }));
      setSelection(prev => [...prev, ...media]);
      if (result.rejected.length) setError(result.rejected.map(r => `${r.filename}: ${r.violations.map(v => v.message).join(', ')}`).join('\n'));
    } catch (e) { setError(studioError(e)); } finally { setUploading(false); if (fileInput.current) fileInput.current.value = ''; }
  };
  const finish = () => {
    const ids = [...new Set(selection.map(m => m.shootId).filter(Boolean))];
    const label = ids.length > 1 ? `${ids.length} shoots` : ids.length ? labels[String(ids[0])] || shoots.find(s => s.id === ids[0])?.address || 'Selected shoot' : 'Uploaded media';
    onSelect(selection, label); onClose();
  };
  return <Dialog open={open} onOpenChange={v => !v && onClose()}><DialogContent aria-describedby={undefined} className="v4-media-dialog flex h-[min(900px,94dvh)] w-[96vw] max-w-7xl flex-col gap-0 overflow-hidden rounded-xl p-0 [&>button:last-child]:top-3">
    <header className="flex h-14 shrink-0 items-center gap-1.5 border-b px-3 pr-12 sm:gap-3">
      {active ? <>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Back to shoots" title="Shoot library" onClick={() => setActive(null)}><ArrowLeft size={17} /></Button>
        <DialogTitle className="min-w-0 flex-1 truncate text-sm" title={active.address || active.label}>{active.address || active.label}</DialogTitle>
        <Tabs value={tab} onValueChange={value => setTab(value as SourceTab)} className="shrink-0"><TabsList aria-label="Photo source" className="h-9"><TabsTrigger value="raw" className="gap-1 px-2 text-xs sm:px-3">Raw<span className="hidden sm:inline">({rawCount})</span></TabsTrigger><TabsTrigger value="edited" className="gap-1 px-2 text-xs sm:px-3">Edited<span className="hidden sm:inline">({editedCount})</span></TabsTrigger></TabsList></Tabs>
        {!loading && tiles.length > available.length && <span className="hidden shrink-0 text-xs text-muted-foreground lg:inline">{tiles.length - available.length} not ready</span>}
        <Button size="sm" variant="outline" className="h-8 shrink-0 px-2 sm:px-3" aria-label="Select all" title={`Select ${available.length} available photos`} disabled={loading || !available.length} onClick={selectAll}><CheckCheck size={16} className="sm:hidden" /><span className="hidden sm:inline">Select all</span></Button>
      </> : <>
        <FolderOpen size={18} className="hidden shrink-0 text-primary sm:block" />
        <DialogTitle className="shrink-0 text-sm">Add media</DialogTitle>
        <div className="relative ml-auto min-w-0 flex-1 sm:max-w-sm"><Search size={15} className="absolute left-2.5 top-2.5 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search shoots…" aria-label="Search shoots" className="h-9 pl-8" /></div>
      </>}
      <Button variant="ghost" size="sm" className="h-8 shrink-0 px-2" aria-label={uploading ? `Uploading ${Math.round(progress)}%` : 'Upload media'} title="Upload media" disabled={uploading} onClick={() => fileInput.current?.click()}>{uploading ? <Loader2 size={16} /> : <UploadCloud size={16} />}<span className="hidden text-xs lg:inline">{uploading ? `${Math.round(progress)}%` : 'Upload'}</span></Button>
    </header>
    <section className="flex min-h-0 min-w-0 flex-1 flex-col" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files); }}>
        {error && <p role="alert" className="shrink-0 whitespace-pre-line bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
          {loading ? <div className="flex h-36 items-center justify-center gap-2 text-muted-foreground"><Loader2 size={18} />Loading media…</div> : active ? <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{tiles.map(tile => <PickerPhotoCard key={tile.id} tile={tile} selected={!!tile.media && selection.some(s => s.id === tile.media?.id)} onSelect={toggle} onRetry={() => retryMerge(tile.id)} />)}</div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{shoots.map(shoot => <article key={shoot.id} className="overflow-hidden rounded-xl border bg-card"><button className="relative block aspect-[2/1] w-full bg-muted/30" onClick={() => browseShoot(shoot)}>{shoot.thumbnailUrl ? <StudioImage src={shoot.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <FolderOpen className="absolute inset-0 m-auto text-muted-foreground" size={32} />}<span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white">Browse photos <ChevronRight size={10} className="inline" /></span></button><div className="flex items-center gap-2 p-3"><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-medium">{shoot.address || shoot.label}</h3><p className="truncate text-xs text-muted-foreground">{shoot.location}</p></div><Button variant="outline" size="sm" onClick={() => browseShoot(shoot)}>Choose photos</Button></div></article>)}</div>}
          {!loading && !error && !(active ? tiles : shoots).length && <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center"><ImagePlus size={30} className="text-muted-foreground" /><p className="text-sm">{active ? `No compatible ${tab} media in this shoot.` : search.trim() ? 'No shoots match your search.' : 'No shoots are available to your account yet.'}</p><Button variant="outline" onClick={() => fileInput.current?.click()}>Upload media</Button></div>}
        </div>
    </section>
    <footer className="flex h-14 shrink-0 items-center gap-3 border-t bg-card px-3"><div className="hidden gap-1.5 sm:flex">{selection.slice(0, 3).map(m => <div key={m.id} className="relative"><StudioImage src={m.thumbnailUrl} alt="" className="h-8 w-10 rounded object-cover" /><button className="absolute -right-1 -top-1 rounded-full bg-background p-0.5" aria-label={`Remove ${m.name}`} onClick={() => toggle(m)}><X size={12} /></button></div>)}</div><p className="text-xs font-medium">{selection.length} selected</p><button onClick={() => setSelection([])} className="text-xs text-muted-foreground hover:text-foreground" aria-label="Clear selection">Clear</button><Button size="sm" className="ml-auto h-8" disabled={!selection.length || uploading || loading} onClick={finish}>Use {selection.length} {selection.length === 1 ? 'photo' : 'photos'}<ChevronRight size={16} className="ml-1" /></Button></footer>
    <input ref={fileInput} type="file" multiple className="hidden" accept="image/*,.cr2,.cr3,.nef,.arw,.dng,.raf,.orf,.rw2" onChange={e => e.target.files && void upload(e.target.files)} />
  </DialogContent></Dialog>;
}
