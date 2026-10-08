import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { downloadShootMediaFile } from '@/utils/shootMediaDownload';

export interface TaggedRequestMedia {
  id: string;
  filename: string;
  thumbnail?: string;
  url?: string;
  canDownload?: boolean;
}

export function TaggedRequestPhoto({ shootId, file, onPreview }: {
  shootId: string | number;
  file: TaggedRequestMedia;
  onPreview: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();
  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadShootMediaFile({ shootId, fileId: file.id });
    } catch (error) {
      toast({ title: 'Download failed', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };
  return <div className="flex items-center gap-1.5">
    <button type="button" onClick={onPreview} aria-label={`Preview ${file.filename}`}
      className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 border-orange-500 bg-muted">
      {file.thumbnail || file.url ? <img src={file.thumbnail || file.url} alt={file.filename} className="h-full w-full object-cover" />
        : <span className="text-xs break-all">{file.filename}</span>}
    </button>
    {file.canDownload === true && <Button type="button" size="icon" variant="outline"
      aria-label={`Download ${file.filename}`} title={`Download ${file.filename}`} aria-busy={downloading}
      disabled={downloading} onClick={() => void download()}>
      {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
    </Button>}
  </div>;
}
