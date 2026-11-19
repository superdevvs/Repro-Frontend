import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, ImageOff, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { downloadBlob } from '@/hooks/shootHistoryDownloadHelpers';
import { cn } from '@/lib/utils';
import { fetchMessageMediaBlob, type MessageMediaFile } from '@/services/messageMedia';
import { formatFileSize, isInlineImage } from './smsAttachments';

interface SmsMessageAttachmentsProps {
  attachments: MessageMediaFile[];
  outbound: boolean;
}

const PENDING = new Set(['importing', 'scanning', 'uploading']);

/** Loads a private file with the signed-in session once its tile is near the viewport. */
function useMediaObjectUrl(file: MessageMediaFile, enabled: boolean) {
  const query = useQuery({
    queryKey: ['message-media-blob', file.id],
    queryFn: ({ signal }) => fetchMessageMediaBlob(file.preview_url ?? file.download_url, signal),
    enabled,
    staleTime: Infinity,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!query.data) { setUrl(undefined); return; }
    const next = URL.createObjectURL(query.data);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [query.data]);
  return { url, blob: query.data, failed: query.isError, retry: () => void query.refetch() };
}

function useNearViewport<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const node = ref.current;
    if (near || !node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNear(true); observer.disconnect(); }
    }, { rootMargin: '300px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [near]);
  return { ref, near };
}

function ImageTile({ file, single, wide, outbound }: { file: MessageMediaFile; single: boolean; wide: boolean; outbound: boolean }) {
  const { ref, near } = useNearViewport<HTMLDivElement>();
  const { url, blob, failed, retry } = useMediaObjectUrl(file, near);
  const [open, setOpen] = useState(false);
  const frame = cn(
    'relative overflow-hidden rounded-xl',
    single ? 'h-44 w-60 max-w-full' : wide ? 'col-span-2 aspect-[2/1] w-full' : 'aspect-square w-full',
    outbound ? 'bg-primary-foreground/15' : 'bg-background/70',
  );

  if (failed) {
    return (
      <div ref={ref} className={cn(frame, 'flex flex-col items-center justify-center gap-1.5 p-3 text-center text-xs')}>
        <ImageOff className="h-4 w-4 opacity-70" aria-hidden />
        <span>{file.name} did not load.</span>
        <button type="button" onClick={retry} className="rounded underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current">Try again</button>
      </div>
    );
  }

  return (
    <div ref={ref} className={frame}>
      {url ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`View ${file.name} larger`}
          className="block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-current"
        >
          <img src={url} alt={file.name} className="h-full w-full object-cover" draggable={false} />
        </button>
      ) : (
        <div className="flex h-full w-full animate-pulse items-center justify-center motion-reduce:animate-none" role="status" aria-label={`Loading ${file.name}`} />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-auto max-w-[min(94vw,72rem)] gap-3 rounded-xl p-3 sm:rounded-xl">
          <DialogTitle className="max-w-[calc(100%-2.5rem)] truncate pl-1 text-sm font-medium">{file.name}</DialogTitle>
          <DialogDescription className="sr-only">Larger view of the attached image.</DialogDescription>
          {url && <img src={url} alt={file.name} className="max-h-[78vh] max-w-full rounded-lg object-contain" />}
          <div className="flex items-center justify-between gap-3 pl-1">
            <span className="text-xs tabular-nums text-muted-foreground">{formatFileSize(file.size)}</span>
            <Button type="button" variant="outline" size="sm" disabled={!blob} onClick={() => blob && downloadBlob(file.name, blob)}>
              <Download className="mr-2 h-3.5 w-3.5" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FileRow({ file, outbound }: { file: MessageMediaFile; outbound: boolean }) {
  const [state, setState] = useState<'idle' | 'downloading' | 'failed'>('idle');
  const surface = outbound ? 'bg-primary-foreground/15 hover:bg-primary-foreground/25' : 'bg-background/70 hover:bg-background';

  if (PENDING.has(file.status)) {
    return (
      <div className={cn('flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs', outbound ? 'bg-primary-foreground/15' : 'bg-background/70')} role="status">
        <InlineSpinner aria-hidden className="h-3.5 w-3.5" />
        <span>{file.status === 'importing' ? 'Receiving attachment…' : 'Checking attachment for viruses…'}</span>
      </div>
    );
  }
  if (file.status !== 'ready') {
    return (
      <div className={cn('flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs', outbound ? 'bg-primary-foreground/15' : 'bg-background/70')}>
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        <span>{file.status === 'rejected' ? 'An attachment was blocked by the virus scan.' : 'An attachment could not be retrieved from the carrier.'}</span>
      </div>
    );
  }

  const download = async () => {
    setState('downloading');
    try {
      downloadBlob(file.name, await fetchMessageMediaBlob(file.download_url));
      setState('idle');
    } catch {
      setState('failed');
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => void download()}
        disabled={state === 'downloading'}
        aria-label={`Download ${file.name}`}
        className={cn(
          'flex w-full min-w-[12rem] max-w-[18rem] items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current disabled:cursor-wait',
          surface,
        )}
      >
        <FileText className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-tight">{file.name}</span>
          <span className="block text-[11px] tabular-nums opacity-75">{state === 'downloading' ? 'Downloading…' : formatFileSize(file.size) || 'File'}</span>
        </span>
        {state === 'downloading' ? <InlineSpinner aria-hidden className="h-4 w-4" /> : <Download className="h-4 w-4 shrink-0 opacity-80" aria-hidden />}
      </button>
      {state === 'failed' && <p role="alert" className="mt-1 text-[11px]">Download failed. Select the file to try again.</p>}
    </div>
  );
}

/** Images show inline with a larger view; every other file is a named download. */
export const SmsMessageAttachments = ({ attachments, outbound }: SmsMessageAttachmentsProps) => {
  const images = attachments.filter(file => file.status === 'ready' && isInlineImage(file));
  const others = attachments.filter(file => !images.includes(file));
  if (attachments.length === 0) return null;

  return (
    <div className="space-y-1.5" aria-label="Message attachments">
      {images.length > 0 && (
        <div className={cn(images.length > 1 && 'grid w-60 max-w-full grid-cols-2 gap-1.5')}>
          {images.map((file, index) => (
            <ImageTile
              key={file.id}
              file={file}
              single={images.length === 1}
              // An odd last picture spans the row instead of leaving a gap.
              wide={images.length % 2 === 1 && index === images.length - 1}
              outbound={outbound}
            />
          ))}
        </div>
      )}
      {others.map(file => <FileRow key={file.id} file={file} outbound={outbound} />)}
    </div>
  );
};
