import { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { MediaFile } from '@/hooks/useShootFiles';
import { downloadShootRawFiles } from '@/utils/shootMediaDownload';
import { buildRawDownloadBatches, formatRawBatchSize, type RawDownloadBatch } from './rawDownloadBatchPlan';

type PartState = { status: 'preparing' | 'started' | 'error'; message: string };

export function RawDownloadBatches({ shootId, files, disabled = false }: {
  shootId: string | number;
  files: MediaFile[];
  disabled?: boolean;
}) {
  const available = buildRawDownloadBatches(files);
  const [open, setOpen] = useState(false);
  const [batches, setBatches] = useState<RawDownloadBatch[]>([]);
  const [states, setStates] = useState<Record<number, PartState>>({});
  const active = useRef<AbortController | null>(null);
  const [preparing, setPreparing] = useState<number | null>(null);

  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);

  const close = () => {
    active.current?.abort();
    active.current = null;
    setPreparing(null);
    setOpen(false);
  };
  const download = async (index: number) => {
    if (active.current || disabled) return;
    const controller = new AbortController();
    active.current = controller;
    setPreparing(index);
    setStates(previous => ({ ...previous, [index]: { status: 'preparing', message: 'Preparing this part…' } }));
    try {
      await downloadShootRawFiles({ shootId, fileIds: batches[index].fileIds, signal: controller.signal,
        onPreparing: () => {
          if (!controller.signal.aborted) setStates(previous => ({ ...previous, [index]: { status: 'preparing', message: 'Preparing this part…' } }));
        },
      });
      if (!controller.signal.aborted) setStates(previous => ({ ...previous, [index]: {
        status: 'started', message: 'Sent to your browser. Check its downloads for progress.',
      } }));
    } catch (error) {
      if (!controller.signal.aborted) setStates(previous => ({ ...previous, [index]: {
        status: 'error', message: error instanceof Error ? error.message : 'This part could not start. Please try again.',
      } }));
    } finally {
      if (active.current === controller) {
        active.current = null;
        setPreparing(null);
      }
    }
  };

  if (available.length < 2 && !open) return null;

  return <>
    <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 px-2 text-xs sm:h-8" disabled={disabled}
      onClick={() => { setBatches(available); setStates({}); setOpen(true); }}>
      <Download className="h-4 w-4" />Download in parts
    </Button>
    <Dialog open={open} onOpenChange={next => { if (!next) close(); }}>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Download in smaller parts</DialogTitle>
          <DialogDescription>The same original files, grouped into smaller ZIPs. Download one part at a time. If a transfer stops, retry just that part.</DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">A single large file stays whole. Your browser shows transfer progress; “sent” does not mean the download has finished.</p>
        <div className="space-y-2">
          {batches.map((batch, index) => <div key={batch.fileIds.join(',')} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Part {index + 1} of {batches.length}</p>
                <p className="text-xs text-muted-foreground">{batch.fileIds.length} files · {formatRawBatchSize(batch)}</p>
              </div>
              <Button type="button" variant="outline" size="sm" disabled={preparing !== null || disabled}
                aria-label={`Download part ${index + 1}`} aria-busy={preparing === index} onClick={() => void download(index)}>
                {preparing === index ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                {states[index]?.status === 'started' ? 'Download again' : states[index]?.status === 'error' ? 'Try again' : 'Download'}
              </Button>
            </div>
            {states[index] && <p role={states[index].status === 'error' ? 'alert' : 'status'} className="mt-2 text-xs text-muted-foreground">{states[index].message}</p>}
          </div>)}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
