import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock3, PhoneIncoming, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePageLoading } from '@/hooks/use-page-loading';
import { getVoiceInsights } from '@/services/voice';
import { EmptyCalls, MetricDelta } from './workspace/bits';

const ranges = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
];

export default function CallsInsights() {
  const [range, setRange] = useState('7d');
  const insights = useQuery({ queryKey: ['voice-insights', range], queryFn: () => getVoiceInsights(range) });
  usePageLoading(insights.isLoading);
  const data = insights.data;
  const maxVolume = Math.max(1, ...(data?.volume_by_day ?? []).map((day) => day.total));
  const hasVolume = Boolean(data?.volume_by_day.some((day) => day.total > 0));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-[28px] font-semibold leading-9">What your conversations are telling you</h2>
          <p className="mt-1 text-sm text-[var(--calls-muted)]">
            Call coverage, completed follow-ups and confirmed booking outcomes.
          </p>
        </div>
        <div className="flex gap-2">
          {ranges.map((item) => (
            <button key={item.id} type="button" className="calls-filter" data-active={range === item.id} onClick={() => setRange(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {insights.isError && (
        <div role="alert" className="calls-panel p-4 text-sm text-[var(--calls-danger)]">
          Could not load insights.
          <Button variant="outline" className="mt-3 calls-secondary" onClick={() => void insights.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {insights.isLoading && <p role="status" className="calls-panel p-5 text-sm text-[var(--calls-muted)]">Loading call insights…</p>}
      {data && <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InsightCard icon={PhoneIncoming} label="Answered" value={data?.answered_rate == null ? '—' : `${data.answered_rate}%`} delta={data?.answered_rate_delta} unit=" pts" />
        <InsightCard icon={Clock3} label="Median answer" value={data?.median_answer_seconds == null ? '—' : `${data.median_answer_seconds}s`} delta={data?.median_answer_delta} unit="s" lowerIsBetter />
        <InsightCard icon={TrendingUp} label="Bookings from calls" value={data ? String(data.bookings_from_calls) : '—'} delta={data?.bookings_delta} />
        <InsightCard icon={Sparkles} label="Missed recovered" value={data?.missed_recovered_rate == null ? '—' : `${data.missed_recovered_rate}%`} delta={data?.missed_recovered_delta} unit=" pts" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <section className="calls-panel p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Inbound call volume</h3>
            <div className="flex gap-3 text-xs text-[var(--calls-muted)]">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--calls-brand)]" />Team</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--calls-ai)]" />Robbie</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--calls-warning)]" />Missed</span>
            </div>
          </div>
          {!hasVolume ? (
            <EmptyCalls title="No call volume in this window" />
          ) : (
            <div className="mt-4 overflow-x-auto" aria-label="Daily call volume">
              <div style={{ minWidth: Math.max(280, (data?.volume_by_day.length ?? 0) * 42) }}>
              <div className="calls-bar-stack">
                {data!.volume_by_day.map((day) => (
                  <div key={day.date} role="img" aria-label={`${day.date}: ${day.team} team, ${day.ai} Robbie, ${day.missed} missed, ${day.total} total`} title={`${day.date}: ${day.total} calls`}>
                    <span style={{ height: `${(day.missed / maxVolume) * 100}%`, background: 'var(--calls-warning)' }} />
                    <span style={{ height: `${(day.ai / maxVolume) * 100}%`, background: 'var(--calls-ai)' }} />
                    <span style={{ height: `${(day.team / maxVolume) * 100}%`, background: 'var(--calls-brand)' }} />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2 text-xs text-[var(--calls-muted)]">
                {data!.volume_by_day.map((day) => (
                  <span key={day.date} className="flex-1 text-center">
                    {range === '30d' ? new Date(`${day.date}T12:00:00`).toLocaleDateString([], { month: 'numeric', day: 'numeric' }) : day.label}
                  </span>
                ))}
              </div>
              </div>
            </div>
          )}
          <p className="mt-4 text-sm text-[var(--calls-muted)]">{data ? `${data.inbound_total} inbound calls in this window.` : 'Loading…'}</p>
        </section>

        <div className="space-y-4">
          <section className="calls-panel p-5">
            <h3 className="text-lg font-semibold">Intent mix</h3>
            <div className="mt-4 space-y-3">
              {(data?.intents ?? []).map((intent) => (
                <div key={intent.key}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{intent.label}</span>
                    <span className="text-[var(--calls-muted)]">{intent.pct}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-[var(--calls-subtle)]">
                    <div className="h-full rounded-full bg-[var(--calls-brand)]" style={{ width: `${intent.pct}%` }} />
                  </div>
                </div>
              ))}
              {(data?.intents?.length ?? 0) === 0 && <p className="text-sm text-[var(--calls-muted)]">No intents tagged in this window.</p>}
            </div>
          </section>
          <section className="calls-panel p-5">
            <h3 className="text-lg font-semibold">Handoff quality</h3>
            <p className="mt-2 text-3xl font-semibold">{data?.handoff_connected_rate == null ? '—' : `${data.handoff_connected_rate}%`}</p>
            <p className="mt-1 text-sm text-[var(--calls-muted)]">
              {data ? `${data.handoffs_needing_callback} handoff${data.handoffs_needing_callback === 1 ? '' : 's'} still need a callback` : 'Handoff data unavailable'}
            </p>
          </section>
        </div>
      </div>

      {data?.opportunity && (
        <section className="calls-panel bg-[var(--calls-ai-soft)] p-5">
          <p className="text-sm font-medium text-[var(--calls-ai)]">Opportunity</p>
          <h3 className="mt-2 text-xl font-semibold">{data.opportunity.title}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--calls-muted)]">{data.opportunity.detail}</p>
        </section>
      )}
      </>}
    </div>
  );
}

function InsightCard({
  icon: Icon,
  label,
  value,
  delta,
  unit,
  lowerIsBetter = false,
}: {
  icon: typeof PhoneIncoming;
  label: string;
  value: string;
  delta: number | null | undefined;
  unit?: string;
  lowerIsBetter?: boolean;
}) {
  return (
    <section className="calls-panel p-4">
      <p className="flex items-center gap-2 text-sm text-[var(--calls-muted)]">
        <Icon className="h-4 w-4" />
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      <div className="mt-2">
        {lowerIsBetter && delta != null ? (
          <span className={`text-xs ${delta <= 0 ? 'text-[var(--calls-brand)]' : 'text-[var(--calls-danger)]'}`}>
            {delta > 0 ? '+' : ''}{delta}{unit} · {delta < 0 ? 'faster' : delta > 0 ? 'slower' : 'unchanged'}
          </span>
        ) : <MetricDelta value={delta} unit={unit} />}
      </div>
    </section>
  );
}
