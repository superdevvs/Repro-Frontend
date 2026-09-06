import { StudioImage } from './StudioImage';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, FolderOpen, ImagePlus, Loader2, Search, UploadCloud, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type StudioShootRef } from '@/services/studioService';
import { sourceMedia, studioError, workspaceSources as studioService } from '@/services/studioWorkspaceService';
import type { V4Media, V4Preset } from './types';

interface Props { open: boolean; onClose: () => void; selected: V4Media[]; preset: V4Preset; onSelect: (media: V4Media[], label: string) => void }
export function MediaPicker({ open, onClose, selected, preset, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [shoots, setShoots] = useState<StudioShootRef[]>([]);
  const [active, setActive] = useState<StudioShootRef | null>(null);
  const [photos, setPhotos] = useState<V4Media[]>([]);
  const [selection, setSelection] = useState<V4Media[]>(selected);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setSelection(selected); setError(null); } }, [open, selected]);
  useEffect(() => {
    if (!open) return;
    let current = true;
    const timer = window.setTimeout(() => {
      setLoading(true); setError(null);
      studioService.searchShoots(search).then(items => { if (current) setShoots(items); }).catch(e => { if (current) setError(studioError(e)); }).finally(() => { if (current) setLoading(false); });
    }, 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [search, open]);
  useEffect(() => {
    if (!active || !open) return;
    let current = true; setLoading(true); setPhotos([]); setError(null);
    studioService.getShootMedia(active.id, preset.workflow).then(items => { if (current) setPhotos(items.map(sourceMedia)); }).catch(e => { if (current) setError(studioError(e)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [active, open, preset.workflow]);
  const toggle = (media: V4Media) => setSelection(items => items.some(m => m.id === media.id) ? items.filter(m => m.id !== media.id) : [...items, media]);
  const selectShoot = async (shoot: StudioShootRef) => {
    setLoading(true); setError(null);
    try {
      const items = (await studioService.getShootMedia(shoot.id, preset.workflow)).map(sourceMedia);
      setSelection(prev => [...prev.filter(m => m.shootId !== shoot.id), ...items]);
      setLabels(prev => ({ ...prev, [shoot.id]: shoot.address || shoot.label }));
      if (!items.length) setError('This shoot has no compatible media yet. Choose another shoot or upload media.');
    } catch (e) { setError(studioError(e)); } finally { setLoading(false); }
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
  return <Dialog open={open} onOpenChange={v => !v && onClose()}><DialogContent className="v4-media-dialog flex h-[min(820px,92dvh)] max-w-6xl flex-col gap-0 overflow-hidden p-0">
    <header className="flex shrink-0 items-center gap-3 border-b px-5 py-4 pr-12"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><FolderOpen size={21} /></div><div><DialogTitle>Add media</DialogTitle><DialogDescription>Choose a shoot, select individual photos, or upload your own.</DialogDescription></div></header>
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="flex shrink-0 gap-2 border-b bg-muted/20 p-3 md:w-52 md:flex-col md:border-b-0 md:border-r md:p-4">
        <Button variant={!active ? 'secondary' : 'ghost'} className="justify-start" onClick={() => setActive(null)}><FolderOpen size={16} className="mr-2" />Shoot library</Button>
        <Button variant="ghost" className="justify-start" disabled={uploading} onClick={() => fileInput.current?.click()}><UploadCloud size={16} className="mr-2" />{uploading ? `Uploading ${Math.round(progress)}%` : 'Upload media'}</Button>
        <p className="mt-auto hidden text-xs leading-relaxed text-muted-foreground md:block">Select photos from several shoots. Each edit stays connected to its original shoot.</p>
      </aside>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files); }}>
        <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
          {active ? <><Button variant="ghost" size="icon" aria-label="Back to shoots" onClick={() => setActive(null)}><ArrowLeft size={18} /></Button><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-medium">{active.address || active.label}</h3><p className="text-xs text-muted-foreground">{photos.length} available files</p></div><Button size="sm" variant="outline" disabled={loading} onClick={() => setSelection(prev => [...prev.filter(m => !photos.some(p => p.id === m.id)), ...photos])}>Select all</Button></> : <div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search address or shoot…" aria-label="Search shoots" className="pl-9" /></div>}
        </div>
        {error && <p role="alert" className="shrink-0 whitespace-pre-line bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? <div className="flex h-36 items-center justify-center gap-2 text-muted-foreground"><Loader2 size={18} className="animate-spin" />Loading media…</div> : active ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{photos.map(m => <button key={m.id} onClick={() => toggle(m)} aria-pressed={selection.some(s => s.id === m.id)} className="group min-w-0 text-left"><div className={`relative aspect-[4/3] overflow-hidden rounded-xl border-2 bg-muted/30 ${selection.some(s => s.id === m.id) ? 'border-primary' : 'border-transparent'}`}><StudioImage src={m.thumbnailUrl} alt={m.name} className="h-full w-full object-contain" /><span className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border ${selection.some(s => s.id === m.id) ? 'border-primary bg-primary text-white' : 'border-white/60 bg-black/40'}`}>{selection.some(s => s.id === m.id) && <Check size={14} />}</span></div><p className="mt-2 truncate text-xs">{m.name}</p></button>)}</div> : <div className="grid gap-3 sm:grid-cols-2">{shoots.map(shoot => <article key={shoot.id} className="overflow-hidden rounded-xl border bg-card"><button className="relative block aspect-[2/1] w-full bg-muted/30" onClick={() => { setActive(shoot); setLabels(prev => ({ ...prev, [shoot.id]: shoot.address || shoot.label })); }}>{shoot.thumbnailUrl ? <StudioImage src={shoot.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <FolderOpen className="absolute inset-0 m-auto text-muted-foreground" size={32} />}<span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white">Browse photos <ChevronRight size={10} className="inline" /></span></button><div className="flex items-center gap-2 p-3"><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-medium">{shoot.address || shoot.label}</h3><p className="truncate text-xs text-muted-foreground">{shoot.location}</p></div><Button variant="outline" size="sm" onClick={() => void selectShoot(shoot)}>{selection.some(m => m.shootId === shoot.id) ? <Check size={16} /> : 'Add shoot'}</Button></div></article>)}</div>}
          {!loading && !(active ? photos : shoots).length && <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center"><ImagePlus size={30} className="text-muted-foreground" /><p className="text-sm">{active ? 'No compatible media in this shoot.' : search ? 'No shoots match your search.' : 'Your shoot library is empty.'}</p><Button variant="outline" onClick={() => fileInput.current?.click()}>Upload media</Button></div>}
        </div>
      </section>
    </div>
    <footer className="flex shrink-0 items-center gap-3 border-t bg-card px-4 py-3"><div className="hidden gap-1 sm:flex">{selection.slice(0, 4).map(m => <div key={m.id} className="relative"><StudioImage src={m.thumbnailUrl} alt="" className="h-10 w-12 rounded-md object-cover" /><button className="absolute -right-1 -top-1 rounded-full bg-background p-0.5" aria-label={`Remove ${m.name}`} onClick={() => toggle(m)}><X size={12} /></button></div>)}</div><div className="mr-auto"><p className="text-sm font-medium">{selection.length} selected</p><button onClick={() => setSelection([])} className="text-xs text-muted-foreground hover:text-foreground">Clear selection</button></div><Button disabled={!selection.length || uploading || loading} onClick={finish}>Use {selection.length || ''} files <ChevronRight size={16} className="ml-2" /></Button></footer>
    <input ref={fileInput} type="file" multiple className="hidden" accept="image/*,.cr2,.cr3,.nef,.arw,.dng,.raf,.orf,.rw2" onChange={e => e.target.files && void upload(e.target.files)} />
  </DialogContent></Dialog>;
}
