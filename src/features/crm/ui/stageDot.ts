import type { StageKey } from '../types';

/** Column dots on the pipeline board. */
export const STAGE_DOT: Record<StageKey, string> = {
  outreach: 'bg-slate-400',
  inquiry: 'bg-primary',
  estimate: 'bg-amber-500',
  booked: 'bg-violet-500',
  client_pool: 'bg-emerald-500',
  lost: 'bg-rose-500',
};
