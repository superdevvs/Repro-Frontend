import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';
import { cn } from '@/lib/utils';
import { crmApi } from '../api';
import { useCrmQueryKey } from '../hooks';
import type { Insight } from '../types';
import { useCrmRobbie } from './useCrmRobbie';

/**
 * The CRM version of the top-bar Robbie strip. Rule-based insights scoped to
 * the user; clicking one opens the side panel with that question rather than
 * leaving for the chat page.
 */
export function CrmRobbieStrip({ className }: { className?: string }) {
  const robbie = useCrmRobbie();
  const { data } = useQuery({
    queryKey: useCrmQueryKey(['crm', 'robbie', 'insights']),
    queryFn: () => crmApi.get<{ data: Insight[] }>('/robbie/insights'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const insights = data?.data ?? [];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (insights.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % insights.length), 6000);
    return () => window.clearInterval(id);
  }, [insights.length]);

  const current = insights[index % Math.max(insights.length, 1)];

  return (
    <div className={cn('flex min-w-0 items-center gap-2.5 px-4', className)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-accent"><ReproAiIcon className="h-[18px] w-[18px]" /></span>
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[.2em] text-muted-foreground">Robbie</span>
      {current ? (
        <button type="button" onClick={() => robbie?.ask(current.prompt)} className="flex min-w-0 items-center gap-2 text-left" title={current.text}>
          <span className={cn('h-2 w-2 shrink-0 rounded-full', current.tone === 'warning' ? 'bg-amber-500' : 'bg-primary')} aria-hidden="true" />
          <span className="truncate text-sm font-medium">{current.text}</span>
        </button>
      ) : (
        <span className="truncate text-sm text-muted-foreground">You’re all caught up.</span>
      )}
      <button type="button" onClick={() => robbie?.toggle()} className="ml-auto flex shrink-0 items-center gap-1.5 text-xs font-medium text-accent-foreground hover:underline">
        {robbie?.open ? 'Close Robbie' : 'Ask Robbie'}
        <kbd className="rounded border bg-secondary px-1 font-sans text-[11px] leading-4 text-muted-foreground">R</kbd>
      </button>
    </div>
  );
}

export default CrmRobbieStrip;
