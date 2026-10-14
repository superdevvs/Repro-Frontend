import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Upload, X } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useUpload } from '@/context/UploadContext';
import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';
import { Button } from '@/components/ui/button';
import { formatUploadFileSize } from './mediaUploadUtils';
import { canSeeUploadSummaries, uploadedAgo, type ShootMediaRequirements } from './shootMediaRequirements';
import { ShootMediaCountLine } from './ShootMediaCountLine';
import { UploadCompleteArtwork } from './UploadCompleteArtwork';
import './ShootUploadSummaries.css';

const SUMMARY_LIFETIME_MS = 5 * 60 * 1000;

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
  return <StaffUploadSummaries key={`${user?.id}:${props.shootId}:${props.unitId ?? ''}:${props.uploadType}`} {...props} userId={String(user?.id ?? '')} />;
}

function StaffUploadSummaries({ shootId, unitId, uploadType, requirements, onUploadMore, userId }: Props & { userId: string }) {
  const { uploads } = useUpload();
  const reducedMotion = useReducedMotion();
  const storageKey = `shoot-upload-dismissed:${userId}:${shootId}:${unitId ?? 'property'}`;
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try { const value = JSON.parse(localStorage.getItem(storageKey) ?? '[]'); return Array.isArray(value) ? value.filter(id => typeof id === 'string') : []; } catch { return []; }
  });
  const [now, setNow] = useState(Date.now);
  const [selection, setSelection] = useState<{ id: string; index: number } | null>(null);
  const [dismissMotion, setDismissMotion] = useState(false);
  const newestRef = useRef<string>();
  const gesture = useRef<{ x: number; y: number } | null>(null);
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
  const lane = data.filter(summary => summary.uploadType === uploadType)
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  const newestId = lane[0]?.id;
  const currentTime = Math.max(now, Date.now());
  const visible = lane.filter(summary => !dismissed.includes(summary.id)
    && Date.parse(summary.completedAt) + SUMMARY_LIFETIME_MS > currentTime);
  const foundIndex = visible.findIndex(summary => summary.id === selection?.id);
  const index = foundIndex >= 0 ? foundIndex : Math.min(selection?.index ?? 0, Math.max(0, visible.length - 1));
  const active = visible[index];
  // Refetches retain the selected history entry; a newly completed batch comes to the front.
  useEffect(() => {
    if (newestId && newestId !== newestRef.current && !dismissed.includes(newestId)) {
      setSelection({ id: newestId, index: 0 });
      setDismissMotion(false);
    }
    newestRef.current = newestId;
  }, [newestId, dismissed]);
  const move = (direction: number) => {
    const next = (index + direction + visible.length) % visible.length;
    if (!visible[next]) return;
    setDismissMotion(false);
    setSelection({ id: visible[next].id, index: next });
  };
  const youngest = visible.length ? Math.min(...visible.map(summary => now - Date.parse(summary.completedAt))) : Infinity;
  const timeInterval = youngest < 1000 ? 100 : youngest < 60000 ? 1000 : 10000;
  useEffect(() => {
    if (!visible.length) return;
    const timer = setInterval(() => setNow(Date.now()), timeInterval);
    return () => clearInterval(timer);
  }, [visible.length, timeInterval]);
  const nextExpiry = visible.length
    ? Math.min(...visible.map(summary => Date.parse(summary.completedAt) + SUMMARY_LIFETIME_MS)) : Infinity;
  useEffect(() => {
    if (!Number.isFinite(nextExpiry)) return;
    const refreshTime = () => setNow(Date.now());
    const onVisible = () => { if (document.visibilityState === 'visible') refreshTime(); };
    const timer = setTimeout(refreshTime, Math.max(0, nextExpiry - Date.now()));
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refreshTime);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refreshTime);
    };
  }, [nextExpiry]);
  const dismiss = (id: string) => {
    setDismissMotion(true);
    const remaining = visible.filter(summary => summary.id !== id);
    const nextIndex = Math.min(index, Math.max(0, remaining.length - 1));
    setSelection(remaining[nextIndex] ? { id: remaining[nextIndex].id, index: nextIndex } : null);
    const next = [...dismissed, id].slice(-200);
    setDismissed(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      window.dispatchEvent(new Event('shoot-upload-summary-dismissed'));
    } catch { /* In-memory dismissal still works when storage is unavailable. */ }
  };

  return <div className="shoot-upload-summaries" data-testid="shoot-upload-summaries">
    {visible.length > 1 && <div className="upload-summary-stack-heading">
      <span className="text-xs font-semibold">Recent uploads <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{visible.length}</span></span>
      <div className="flex items-center gap-1">
        <span aria-live="polite" className="mr-1 text-[10px] tabular-nums text-muted-foreground">{index + 1} / {visible.length}</span>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg border" aria-label="Previous upload summary" onClick={() => move(-1)}><ArrowLeft className="h-3.5 w-3.5" /></Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg border" aria-label="Next upload summary" onClick={() => move(1)}><ArrowRight className="h-3.5 w-3.5" /></Button>
      </div>
    </div>}
    <div className="upload-summary-stack-stage" data-stacked={visible.length > 1}>
      {visible.length > 2 && <div aria-hidden="true" className="upload-summary-stack-back upload-summary-stack-far" />}
      {visible.length > 1 && <div aria-hidden="true" className="upload-summary-stack-back" />}
      <AnimatePresence initial={false} mode="wait" custom={dismissMotion}>
      {active && <motion.div key={active.id} initial={false} custom={dismissMotion}
        variants={{ exit: (dismissing: boolean) => reducedMotion ? { opacity: 0 } : { x: dismissing || Date.now() >= Date.parse(active.completedAt) + SUMMARY_LIFETIME_MS ? 100 : 0, opacity: 0 } }} exit="exit"
        transition={{ duration: reducedMotion ? 0 : 0.24 }}
        className="upload-summary-stack-card" data-testid="upload-completion-summary" data-summary-id={active.id}
        onPointerDown={event => { if (event.pointerType === 'touch') gesture.current = { x: event.clientX, y: event.clientY }; }}
        onPointerCancel={() => { gesture.current = null; }}
        onPointerUp={event => {
          const start = gesture.current; gesture.current = null;
          if (!start || visible.length < 2) return;
          const dx = event.clientX - start.x; const dy = event.clientY - start.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
        }}>
        <section
          aria-label="Upload complete" className="shoot-upload-summary-banner rounded-xl border border-primary/25 bg-card">
          <UploadCompleteArtwork animate={Date.now() - Date.parse(active.completedAt) < 15000} />
          <div className="shoot-upload-summary-content">
            <div className="shoot-upload-summary-main">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
              <span className="whitespace-nowrap">Upload complete</span> <span className="whitespace-nowrap rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[10px] font-normal text-primary">{active.fileCount} / {active.fileCount} saved</span>
              <time className="text-[11px] font-normal text-muted-foreground" dateTime={active.completedAt} title={new Date(active.completedAt).toLocaleString()}>{uploadedAgo(active.completedAt, now)}</time>
            </div>
            <p className="shoot-upload-summary-files mt-1 text-xs text-muted-foreground">{active.fileCount} {uploadType === 'raw' ? 'source' : 'edited'} files{active.totalBytes > 0 ? ` · ${formatUploadFileSize(active.totalBytes)}` : ''}</p>
            </div>
            <div className="shoot-upload-summary-counts"><ShootMediaCountLine requirements={requirements} compact concise /></div>
          </div>
          {onUploadMore && <Button type="button" size="sm" onClick={onUploadMore} className="shoot-upload-summary-more h-8 text-xs"><Upload className="mr-1.5 h-3.5 w-3.5" />Upload more</Button>}
          <Button type="button" size="icon" variant="ghost" className="shoot-upload-summary-dismiss h-7 w-7 text-muted-foreground" onClick={() => dismiss(active.id)} aria-label="Dismiss upload summary"><X className="h-4 w-4" /></Button>
        </section>
      </motion.div>}
    </AnimatePresence>
    </div>
  </div>;
}
