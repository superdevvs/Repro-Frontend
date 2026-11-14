import { useEffect, useState } from 'react';
import { ExternalLink, Globe, Play, View } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { normalizePublicTourUrl, preparePublicIguideEmbedUrl } from '@/components/tourLinks/publicIguideModel';
import { getTourMediaEmbedUrl } from '@/components/tourLinks/tourMediaIdentity';
import type { GuestFile, GuestTour } from './guestOverviewTypes';

export function GuestTourCards({ tours, files, onPreview }: { tours: GuestTour[]; files: GuestFile[]; onPreview: (file: GuestFile) => void }) {
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  useEffect(() => { if (activeUrl && !tours.some(tour => tour.url === activeUrl)) setActiveUrl(null); }, [activeUrl, tours]);
  const active = tours.find(tour => tour.url === activeUrl);
  const url = normalizePublicTourUrl(active?.url);
  const directVideo = active?.kind === 'video' && /\.(mp4|webm|mov)(?:[?#]|$)/i.test(url);
  const embed = active?.provider === 'iguide' ? preparePublicIguideEmbedUrl(url) : getTourMediaEmbedUrl(url);
  const videoHost = url ? /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com)$/i.test(new URL(url).hostname) : false;
  const canEmbed = Boolean(active && (directVideo || active.kind === 'video' && videoHost || ['repro', 'iguide', 'matterport', 'zillow', 'cubicasa'].includes(active.provider || '')));
  return <section aria-label="Property tours" className="space-y-2">
    {tours.length ? tours.map(tour => {
      const Icon = tour.kind === 'video' ? Play : tour.kind === '3d' ? View : Globe;
      const label = tour.kind === 'video' ? 'Video tour' : tour.kind === '3d' ? '3D tour' : 'Property tour';
      const safeUrl = normalizePublicTourUrl(tour.url);
      const localFile = tour.file_id ? files.find(file => file.id === tour.file_id) : null;
      return <article key={`${tour.kind}:${tour.url}`} className="rounded-lg border bg-card p-2.5">
        <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><div className="min-w-0"><p className="text-[10px] uppercase text-muted-foreground">{label}</p><h2 className="break-words text-xs font-semibold">{tour.label}</h2></div></div>
        <div className="flex gap-2"><Button variant="outline" size="sm" className="h-9 min-w-0 flex-1 gap-1.5 text-xs" disabled={!safeUrl} onClick={() => localFile ? onPreview(localFile) : setActiveUrl(tour.url)}><Icon className="h-3.5 w-3.5" />View tour</Button>{safeUrl && <a href={safeUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${tour.label}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-primary hover:bg-muted"><ExternalLink className="h-3.5 w-3.5" /></a>}</div>
      </article>;
    }) : <div className="rounded-lg border bg-card px-4 py-10 text-center"><View className="mx-auto mb-3 h-7 w-7 text-muted-foreground/60" /><p className="text-xs text-muted-foreground">Tours will appear when released.</p></div>}
    <Dialog open={Boolean(active)} onOpenChange={open => { if (!open) setActiveUrl(null); }}><DialogContent className="flex h-[90dvh] w-[calc(100vw-24px)] max-w-6xl flex-col gap-3 p-3 sm:p-4">
      <DialogTitle className="pr-9 text-sm">{active?.label}</DialogTitle><DialogDescription className="sr-only">Shared property tour viewer</DialogDescription>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-black/90">
        {directVideo ? <video key={url} controls playsInline src={url} className="h-full w-full" />
          : canEmbed ? <iframe key={embed} src={embed || url} title={active?.label || 'Property tour'} className="h-full w-full border-0" allow="autoplay; fullscreen; gyroscope; accelerometer; xr-spatial-tracking" allowFullScreen referrerPolicy="no-referrer" />
            : <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center text-white"><View className="h-10 w-10" /><p className="text-sm">Open this tour in a new tab to explore it.</p>{url && <Button asChild><a href={url} target="_blank" rel="noopener noreferrer">Open tour<ExternalLink className="ml-2 h-4 w-4" /></a></Button>}</div>}
      </div>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center justify-center gap-2 text-xs text-primary">Open in a new tab<ExternalLink className="h-3.5 w-3.5" /></a>}
    </DialogContent></Dialog>
  </section>;
}
