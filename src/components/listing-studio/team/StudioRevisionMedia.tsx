import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { listingStudioTeam } from '@/services/listingStudioTeamService';

export function StudioRevisionMedia({ taskId, variant, accountId }: { taskId: string; variant: 'original' | 'result' | 'delivery'; accountId: string }) {
  const [url, setUrl] = useState(''); const [failed, setFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController(); let canceled = false; let objectUrl = ''; setUrl(''); setFailed(false);
    void listingStudioTeam.preview(taskId, variant, abort.signal).then(blob => {
      if (canceled) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch(() => { if (!canceled) setFailed(true); });
    return () => { canceled = true; abort.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [taskId, variant, accountId]);
  const label = variant === 'original' ? 'Property original' : variant === 'result' ? 'Prior edited result' : 'Delivered revision';
  return <figure className="space-y-2"><div className="flex aspect-[3/2] items-center justify-center overflow-hidden rounded-xl border bg-muted">{url ? <img src={url} alt={label} className="h-full w-full object-contain" /> : <p role="status" className="flex items-center gap-2 p-3 text-center text-xs text-muted-foreground">{!failed && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}{failed ? 'Preview unavailable. Refresh this task to try again.' : 'Loading preview…'}</p>}</div><figcaption className="text-xs text-muted-foreground">{label}</figcaption></figure>;
}
