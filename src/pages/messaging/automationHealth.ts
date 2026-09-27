import type { AutomationRule, AutomationRun } from '@/types/messaging';

const timestamp = (value?: string | null): number | null => {
  if (!value?.trim()) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
};

export function runTimestamp(run: AutomationRun): string | null {
  const times = [run.completed_at, run.updated_at, run.started_at, run.created_at]
    .map(timestamp).filter((value): value is number => value !== null);
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

export function orderAutomationRuns(runs: AutomationRun[]) {
  const activity = (run: AutomationRun) => {
    const dates = [run.created_at, run.started_at, run.completed_at, run.updated_at].map(timestamp);
    // Unknown failed-run chronology remains visible even beside dated successes.
    if (run.status === 'failed' && dates.some((date) => date === null)) return Infinity;
    const known = dates.filter((date): date is number => date !== null);
    return known.length ? Math.max(...known) : -Infinity;
  };
  return [...runs].sort((a, b) => {
    const left = activity(a);
    const right = activity(b);
    return left === right ? b.id - a.id : left > right ? -1 : 1;
  });
}

export function getAutomationHealth(automation: AutomationRule) {
  const runs = orderAutomationRuns(automation.recent_runs ?? []);
  const run = runs[0] ?? null;
  const configurationIssue = automation.validation_state?.valid === false
    ? automation.validation_state.errors?.find((error) => error.trim())
      || Object.values(automation.validation_state.node_errors ?? {}).flat().find((error) => error.trim())
      || 'This workflow needs a configuration fix.'
    : null;
  const failed = run?.status === 'failed';
  const editedAt = timestamp(automation.updated_at);
  const activity = run ? [run.created_at, run.started_at, run.completed_at, run.updated_at].map(timestamp) : [];
  const runChronologyKnown = activity.length > 0 && activity.every((value) => value !== null);
  // No workflow revision is stored on runs. Only describe the known chronology;
  // missing dates or activity after the edit must not dismiss a failed run.
  const updatedSinceFailedRun = Boolean(failed && editedAt !== null && runChronologyKnown
    && Math.max(...activity.filter((value): value is number => value !== null)) < editedAt);

  return {
    run,
    runs,
    configurationIssue,
    failed,
    runChronologyKnown,
    updatedSinceFailedRun,
    needsAttention: Boolean(configurationIssue) || (failed && !updatedSinceFailedRun),
  };
}
