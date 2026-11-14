import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Info, Maximize, Minimize, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { GuestZoomPhoto } from './GuestZoomPhoto';
import { guestFileSize, isGuestImage, type GuestFile } from './guestOverviewTypes';
import './guestMediaLightbox.css';

type Props = { files: GuestFile[]; selected: GuestFile | null; onSelect: (file: GuestFile | null) => void };
export function GuestMediaLightbox({ files, selected, onSelect }: Props) {
  const content = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [details, setDetails] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const index = selected ? files.findIndex(file => file.id === selected.id) : -1;
  const file = index >= 0 ? files[index] : null;
  useEffect(() => { setZoom(1); setFullscreenError(''); }, [file?.id]);
  useEffect(() => {
    const change = () => setFullscreen(Boolean(document.fullscreenElement && document.fullscreenElement === content.current));
    document.addEventListener('fullscreenchange', change);
    return () => { document.removeEventListener('fullscreenchange', change); };
  }, []);
  const move = (direction: number) => { if (files.length > 1) onSelect(files[(index + direction + files.length) % files.length]); };
  const image = file ? isGuestImage(file) : false;
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || ['INPUT', 'TEXTAREA', 'SELECT', 'VIDEO'].includes((event.target as HTMLElement).tagName)) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }
    if (image && ['+', '=', '-', '0'].includes(event.key)) { event.preventDefault(); setZoom(value => event.key === '0' ? 1 : Math.max(1, Math.min(5, value + (event.key === '-' ? -0.25 : 0.25)))); }
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (content.current?.requestFullscreen) await content.current.requestFullscreen();
      else setFullscreenError('Fullscreen is not available in this browser.');
    } catch { setFullscreenError('Fullscreen is not available in this browser.'); }
  };
  return <Dialog open={Boolean(file)} onOpenChange={open => { if (!open) onSelect(null); }}>
    <DialogContent ref={content} onKeyDown={keys} className="guest-media-lightbox dark flex h-[calc(100dvh-16px)] w-[calc(100vw-16px)] max-w-none flex-col gap-0 overflow-hidden bg-[#060a0e] p-0 text-white sm:rounded-xl"
      onEscapeKeyDown={event => { if (document.fullscreenElement === content.current) { event.preventDefault(); void document.exitFullscreen(); } }}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3 py-3 pr-12 sm:px-4 sm:pr-12">
        <div className="min-w-0"><DialogTitle className="truncate text-sm font-semibold">{file?.name}</DialogTitle><p className="mt-1 text-[11px] text-slate-400" aria-live="polite">{index + 1} of {files.length}</p></div>
        <div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" aria-label="File details" aria-pressed={details} onClick={() => setDetails(!details)} className="h-8 w-8"><Info className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={() => void toggleFullscreen()} className="h-8 w-8">{fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}</Button></div>
      </header>
      <DialogDescription className="sr-only">Use left and right arrow keys to browse. Photos support pinch, wheel or plus and minus to zoom, dragging to pan, and zero to fit. Press Escape to close.</DialogDescription>
      <div className="relative min-h-0 flex-1 bg-black/30">
        {file && (image ? <GuestZoomPhoto key={`${file.id}:${file.preview_url}`} file={file} zoom={zoom} onZoom={setZoom} onMove={move} />
          : file.kind === 'video' ? <div className="flex h-full items-center justify-center px-3"><video key={file.preview_url} controls playsInline preload="metadata" src={file.preview_url} className="max-h-full max-w-full" /></div>
            : <div className="flex h-full flex-col items-center justify-center gap-4 px-12 text-center"><FileText className="h-12 w-12 text-slate-400" /><p className="break-all text-sm text-slate-300">{file.name}</p><Button asChild variant="outline"><a href={file.preview_url} target="_blank" rel="noopener noreferrer">Open file preview<ExternalLink className="ml-2 h-4 w-4" /></a></Button></div>)}
        {files.length > 1 && <><Button variant="ghost" size="icon" aria-label="Previous file" onClick={() => move(-1)} className="absolute left-2 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full border border-white/10 bg-black/60 text-white hover:bg-black/80"><ChevronLeft className="h-5 w-5" /></Button><Button variant="ghost" size="icon" aria-label="Next file" onClick={() => move(1)} className="absolute right-2 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full border border-white/10 bg-black/60 text-white hover:bg-black/80"><ChevronRight className="h-5 w-5" /></Button></>}
      </div>
      {fullscreenError && <p role="status" className="shrink-0 px-4 py-2 text-xs text-amber-300">{fullscreenError}</p>}
      {details && file && <dl className="grid max-h-[24dvh] shrink-0 grid-cols-2 gap-3 overflow-y-auto border-t border-white/10 p-3 text-xs sm:grid-cols-4"><div><dt className="text-slate-400">File</dt><dd className="mt-1 break-all">{file.name}</dd></div><div><dt className="text-slate-400">Type</dt><dd className="mt-1">{file.mime_type || file.kind}</dd></div><div><dt className="text-slate-400">Dimensions</dt><dd className="mt-1">{file.width && file.height ? `${file.width} × ${file.height}` : '—'}</dd></div><div><dt className="text-slate-400">Full size</dt><dd className="mt-1">{guestFileSize(file.size_bytes)}</dd></div></dl>}
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 px-3 py-2 sm:px-4">
        {image ? <div className="flex items-center gap-1"><Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - 0.25))}><ZoomOut className="h-4 w-4" /></Button><span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span><Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Zoom in" disabled={zoom >= 5} onClick={() => setZoom(value => Math.min(5, value + 0.25))}><ZoomIn className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Fit photo" onClick={() => setZoom(1)}><RotateCcw className="h-4 w-4" /></Button></div> : <span className="text-xs capitalize text-slate-400">{file?.kind}</span>}
        {file && <div className="flex flex-wrap gap-2">{file.mls_download_url && <Button asChild size="sm" variant="outline" className="h-9 gap-1.5 text-xs"><a href={file.mls_download_url}><Download className="h-3.5 w-3.5" />MLS size</a></Button>}<Button asChild size="sm" className="h-9 gap-1.5 text-xs"><a href={file.download_url}><Download className="h-3.5 w-3.5" />Full size</a></Button></div>}
      </footer>
    </DialogContent>
  </Dialog>;
}
