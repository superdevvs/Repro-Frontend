import type { AutomationRun } from '@/types/messaging';
import { runTimestamp } from './automationHealth';

function RunDate({ run }: { run: AutomationRun }) {
  const date = runTimestamp(run);
  return date ? <time dateTime={date}>{new Date(date).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })}</time> : <span>Date unavailable</span>;
}

export function AutomationRunHistory({ runs, updatedSinceFailedRun, runChronologyKnown }: {
  runs: AutomationRun[];
  updatedSinceFailedRun: boolean;
  runChronologyKnown: boolean;
}) {
  const run = runs[0];
  if (!run) return null;
  const currentFailure = run.status === 'failed' && !updatedSinceFailedRun;
  const label = updatedSinceFailedRun ? 'Previous run failed'
    : currentFailure && !runChronologyKnown ? 'Failed run; timing needs review'
      : `Last run ${run.status}`;

  return (
    <div className={`mt-2 text-xs ${currentFailure ? 'text-amber-800 dark:text-amber-400' : 'text-muted-foreground'}`}>
      <p>{label} · <RunDate run={run} /></p>
      {updatedSinceFailedRun && <p className="mt-1">Updated since this failed run; awaiting next run.</p>}
      <details className="mt-1">
        <summary className="w-fit cursor-pointer underline underline-offset-2">View run history</summary>
        <ol className="mt-2 space-y-2 border-l pl-3">
          {runs.map((item) => (
            <li key={item.id}>
              <p>Run #{item.id} · {item.status} · <RunDate run={item} /></p>
              {(item.status === 'failed' || item.error_message) && (
                <p className="mt-1 break-words">{item.error_message || 'This run failed without an error message.'}</p>
              )}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
