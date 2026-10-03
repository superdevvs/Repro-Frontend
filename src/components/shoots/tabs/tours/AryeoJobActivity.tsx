import { AlertTriangle, Loader2 } from 'lucide-react';

export type AryeoJob = {
  id: string; status: string; media_version: string; error: string | null;
  steps: Record<string, string>; receipt: { verified_at: string } | null;
  updated_at?: string; lease_expires_at?: string | null;
  progress?: { action: string; message: string; completed?: number; total?: number; current_file?: string | null; updated_at: string; activity_at: string } | null;
};

const age = (timestamp: string | null | undefined, now: number) => timestamp && Number.isFinite(Date.parse(timestamp)) ? Math.max(0, Math.floor((now - Date.parse(timestamp)) / 1000)) : null;
const elapsed = (seconds: number) => seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

export function AryeoJobActivity({ job, online, now }: { job: AryeoJob; online: boolean; now: number }) {
  const active = ['queued', 'running', 'reconciling'].includes(job.status);
  const progress = job.progress;
  const legacyPhase = job.error?.startsWith('Progress: ') ? job.error.slice(10) : null;
  const error = legacyPhase ? null : job.error;
  const updateAge = age(progress?.updated_at ?? job.updated_at, now);
  const activityAge = age(progress?.activity_at, now);
  const leaseLost = active && job.status !== 'queued' && job.lease_expires_at && Date.parse(job.lease_expires_at) <= now;
  const warning = active && (!online ? 'Mac is offline. Waiting for the worker to reconnect.'
    : leaseLost ? 'Worker stopped responding to this job. Waiting for recovery; do not start another delivery.'
      : activityAge !== null && activityAge >= 120 ? `No activity change for ${elapsed(activityAge)}. The worker is connected, but this step may be waiting.` : null);
  const message = active ? (progress?.message || (legacyPhase ? `${legacyPhase} — waiting for detailed Mac activity` : job.status === 'queued' ? 'Waiting for the Mac to pick up this job' : 'Waiting for Mac activity'))
    : job.status === 'completed' ? 'Delivery and follow-up steps completed' : job.receipt ? 'Delivered · follow-up needs attention' : 'Processing stopped';

  return <div className="min-w-0 flex-1 space-y-1 text-xs" aria-label="Mac activity">
    <div className="flex items-start gap-2" role="status" aria-live="polite">
      {active && !warning && <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />}
      {warning && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />}
      <p className="break-words font-medium">{message}{active && progress?.total !== undefined && progress.total > 0 ? ` · ${progress.completed ?? 0} / ${progress.total}` : ''}</p>
    </div>
    {active && progress?.current_file && <p className="truncate text-muted-foreground" title={progress.current_file}>{progress.current_file}</p>}
    <p className="text-muted-foreground">{updateAge !== null ? `Last worker update ${elapsed(updateAge)} ago` : 'No worker update yet'}{active ? ' · Refreshes every 5s' : ''}</p>
    {warning && <p role="alert" className="text-amber-700 dark:text-amber-400">{warning}</p>}
    {error && <p role="alert" className="break-words text-destructive">{error.replaceAll('_', ' ')}</p>}
  </div>;
}
