import { useOptionalShoots } from '@/context/shootsContextState';

export const DashboardRefreshNotice = () => {
  const context = useOptionalShoots();
  if (!context?.refreshIssue) return null;
  return <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
    <p>{context.refreshIssue}</p>
    <button type="button" className="mt-1 underline" onClick={() => void context.fetchShoots(undefined, 1, 25, { includeFiles: false })}>Retry dashboard refresh</button>
  </div>;
};
