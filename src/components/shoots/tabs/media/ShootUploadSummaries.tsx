import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Upload, X } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useUpload } from '@/context/UploadContext';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { Button } from '@/components/ui/button';
import { formatUploadFileSize } from './mediaUploadUtils';
import { canSeeUploadSummaries, uploadedAgo, type ShootMediaRequirements } from './shootMediaRequirements';
import { ShootMediaCountLine } from './ShootMediaCountLine';
import { UploadCompleteArtwork } from './UploadCompleteArtwork';

export interface UploadCompletionSummary {
  id: string;
  uploadType: 'raw' | 'edited';
  fileCount: number;
  totalBytes: number;
  completedAt: string;
}

interface Props {
  shootId: string | number;
  unitId?: string | null;
  uploadType: 'raw' | 'edited';
  role?: string | null;
  isClient: boolean;
  requirements: ShootMediaRequirements;
  onUploadMore?: () => void;
}

export function ShootUploadSummaries(props: Props) {
  const { user } = useAuth();
  if (!canSeeUploadSummaries(props.role ?? user?.role, props.isClient)) return null;
  return <StaffUploadSummaries key={`${user?.id}:${props.shootId}:${props.unitId ?? ''}`} {...props} userId={String(user?.id ?? '')} />;
}

function StaffUploadSummaries({ shootId, unitId, uploadType, requirements, onUploadMore, userId }: Props & { userId: string }) {
  const { uploads } = useUpload();
  const reducedMotion = useReducedMotion();
  const storageKey = `shoot-upload-dismissed:${userId}:${shootId}:${unitId ?? 'property'}`;
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try { const value = JSON.parse(localStorage.getItem(storageKey) ?? '[]'); return Array.isArray(value) ? value.filter(id => typeof id === 'string') : []; } catch { return []; }
  });
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const sync = () => {
      try { const value = JSON.parse(localStorage.getItem(storageKey) ?? '[]'); if (Array.isArray(value)) setDismissed(value.filter(id => typeof id === 'string')); } catch { /* Keep the current dismissal state. */ }
    };
    window.addEventListener('storage', sync);
    window.addEventListener('shoot-upload-summary-dismissed', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('shoot-upload-summary-dismissed', sync); };
  }, [storageKey]);
  const shootUploads = uploads.filter(upload => upload.shootId === String(shootId));
  const confirmationKey = shootUploads.filter(upload => upload.status === 'succeeded').map(upload => upload.id).join(',');
  const { data = [], refetch } = useQuery<UploadCompletionSummary[]>({
    queryKey: ['shootUploadSummaries', shootId, unitId ?? '', userId],
    queryFn: async ({ signal }) => {
      const params = `?unit_id=${encodeURIComponent(unitId ?? 'property')}`;
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shootId}/upload-summaries${params}`, { headers: getApiHeaders(), signal });
      if (!response.ok) throw new Error('Unable to load upload summaries');
      const payload = await response.json();
      return Array.isArray(payload.data) ? payload.data : [];
    },
    refetchInterval: shootUploads.some(upload => upload.status === 'uploading') ? 2000 : 30000,
    retry: 1,
  });
  useEffect(() => { if (confirmationKey) void refetch(); }, [confirmationKey, refetch]);
  const visible = data.filter(summary => summary.uploadType === uploadType && !dismissed.includes(summary.id));
  const youngest = visible.length ? Math.min(...visible.map(summary => now - Date.parse(summary.completedAt))) : Infinity;
  const timeInterval = youngest < 1000 ? 100 : youngest < 60000 ? 1000 : 10000;
  useEffect(() => {
    if (!visible.length) return;
    const timer = setInterval(() => setNow(Date.now()), timeInterval);
    return () => clearInterval(timer);
  }, [visible.length, timeInterval]);
  const dismiss = (id: string) => {
    const next = [...dismissed, id].slice(-200);
    setDismissed(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      window.dispatchEvent(new Event('shoot-upload-summary-dismissed'));
    } catch { /* In-memory dismissal still works when storage is unavailable. */ }
  };

  return <div className="overflow-hidden" data-testid="shoot-upload-summaries">
    <AnimatePresence initial={false}>
      {visible.map(summary => <motion.div key={summary.id} initial={false}
        exit={reducedMotion ? { opacity: 0, height: 0 } : { height: 0, opacity: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.44, height: { delay: reducedMotion ? 0 : 0.18, duration: reducedMotion ? 0 : 0.26 } }}
        className="overflow-hidden" data-testid="upload-completion-summary">
        <motion.section exit={reducedMotion ? {} : { x: 100, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.24 }}
          aria-label="Upload complete" className="relative mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-3 sm:gap-4 sm:px-4">
          <UploadCompleteArtwork animate={Date.now() - Date.parse(summary.completedAt) < 15000} />
          <div className="min-w-0 flex-1 pr-7 sm:pr-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
              Upload complete <span className="rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[10px] font-normal text-primary">{summary.fileCount} / {summary.fileCount} saved</span>
              <time className="text-[11px] font-normal text-muted-foreground" dateTime={summary.completedAt} title={new Date(summary.completedAt).toLocaleString()}>{uploadedAgo(summary.completedAt, now)}</time>
            </div>
            <p className="mb-2 mt-1 text-xs text-muted-foreground">{summary.fileCount} {uploadType === 'raw' ? 'source' : 'edited'} files{summary.totalBytes > 0 ? ` · ${formatUploadFileSize(summary.totalBytes)}` : ''}</p>
            <ShootMediaCountLine requirements={requirements} compact />
          </div>
          {onUploadMore && <Button type="button" size="sm" onClick={onUploadMore} className="ml-[68px] h-8 text-xs sm:ml-0"><Upload className="mr-1.5 h-3.5 w-3.5" />Upload more</Button>}
          <Button type="button" size="icon" variant="ghost" className="absolute right-2 top-2 h-7 w-7 text-muted-foreground sm:static" onClick={() => dismiss(summary.id)} aria-label="Dismiss upload summary"><X className="h-4 w-4" /></Button>
        </motion.section>
      </motion.div>)}
    </AnimatePresence>
  </div>;
}
