import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/AuthProvider';
import { getImpersonatedUserId } from '@/services/api';
import { fetchAccountingAiUsage, type AiUsageTotals } from '@/services/accountingAiUsageService';
import { AccountingMetricStrip } from './AccountingMetricStrip';

const count = (value: number) => value.toLocaleString('en-US');
const cost = (value: number | null) => value === null ? 'Unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(value);
const tokens = (row: AiUsageTotals, value: number) => value === 0 && row.unknown_token_calls > 0 ? 'Unavailable' : count(value);

export function AccountingAiUsage({ start, end }: { start: string; end: string }) {
  const { user, role } = useAuth();
  const query = useQuery({
    queryKey: ['accounting-ai-usage', user?.id, role, getImpersonatedUserId(), start, end],
    queryFn: ({ signal }) => fetchAccountingAiUsage(start, end, signal),
    enabled: role === 'superadmin', staleTime: 30000, refetchInterval: 60000,
  });
  if (role !== 'superadmin') return null;
  if (query.isPending) return <p role="status" className="py-8 text-sm text-muted-foreground">Loading OpenAI usage…</p>;
  if (query.isError) return <div role="alert" className="space-y-3 rounded-xl border p-4"><p>OpenAI usage could not be loaded.</p><Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>;
  const data = query.data;
  if (!data) return null;
  const s = data.summary;
  return <div className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">OpenAI · USD · Daily totals in UTC · Updates every minute</p><Button size="sm" variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Refresh usage</Button></div>
    <AccountingMetricStrip label="OpenAI usage summary" metrics={[
      { label: 'Calls', value: count(s.metered_calls + s.historical_calls), detail: `${count(s.metered_calls)} metered · ${count(s.historical_calls)} historical minimum` },
      { label: 'Input tokens', value: tokens(s, s.input_tokens), detail: `${count(s.cached_tokens)} cached tokens recorded` },
      { label: 'Output tokens', value: tokens(s, s.output_tokens), detail: `${count(s.unknown_token_calls)} calls without full token data` },
      { label: 'Estimated cost', value: cost(s.estimated_cost_usd), detail: `${count(s.unpriced_calls)} calls without cost data · not billed spend` },
    ]} />
    <div className="rounded-xl border bg-card px-4 py-3 text-sm"><p>{data.scope_note}</p><p className="mt-1 text-muted-foreground">{data.cost_note}</p><p className="mt-1 text-muted-foreground">{data.history_note}</p><p className="mt-2 text-xs text-muted-foreground">New calls are metered automatically. Failed: {count(s.failed_calls)} · Pending or unconfirmed: {count(s.unconfirmed_calls)}.</p></div>
    <section aria-label="Daily OpenAI usage" className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-4 py-3"><h2 className="font-semibold">Daily usage</h2><p className="mt-1 text-xs text-muted-foreground">Historical counts are minimums. Missing tokens and cost stay unavailable.</p></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/30 text-left text-xs text-muted-foreground"><tr>{['Date (UTC)', 'Metered calls', 'Historical minimum', 'Input / output tokens', 'Estimated USD'].map(label => <th key={label} className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>)}</tr></thead>
        <tbody>{[...data.daily].reverse().map(row => <tr key={row.date} className="border-t"><td className="whitespace-nowrap px-4 py-3">{row.date}{row.date === new Date().toISOString().slice(0, 10) && <span className="ml-2 text-xs text-muted-foreground">partial</span>}</td><td className="px-4 py-3">{count(row.metered_calls)}</td><td className="px-4 py-3">{count(row.historical_calls)}</td><td className="whitespace-nowrap px-4 py-3">{tokens(row, row.input_tokens)} / {tokens(row, row.output_tokens)}{row.unknown_token_calls > 0 && row.input_tokens + row.output_tokens > 0 && <span className="ml-2 text-xs text-muted-foreground">partial</span>}</td><td className="whitespace-nowrap px-4 py-3">{cost(row.estimated_cost_usd)}{row.estimated_cost_usd !== null && row.unpriced_calls > 0 && <span className="ml-2 text-xs text-muted-foreground">partial</span>}</td></tr>)}</tbody>
      </table></div>
    </section>
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <section aria-label="Usage by feature" className="rounded-xl border bg-card p-4"><h2 className="mb-3 font-semibold">By feature</h2>{data.features.length ? data.features.map(row => <div key={row.feature} className="flex flex-wrap items-center justify-between gap-2 border-t py-3 text-sm"><div><p>{row.label}</p><p className="text-xs text-muted-foreground">{count(row.metered_calls)} metered · {count(row.historical_calls)} historical minimum</p></div><span>{cost(row.estimated_cost_usd)}</span></div>) : <p className="text-sm text-muted-foreground">No recorded calls for these dates.</p>}</section>
      <section aria-label="Usage by model" className="rounded-xl border bg-card p-4"><h2 className="mb-3 font-semibold">By model</h2>{data.models.length ? data.models.map(row => <div key={row.model} className="flex flex-wrap items-center justify-between gap-2 border-t py-3 text-sm"><div className="min-w-0"><p className="break-all">{row.model}</p><p className="text-xs text-muted-foreground">{count(row.metered_calls + row.historical_calls)} calls</p></div><span>{cost(row.estimated_cost_usd)}</span></div>) : <p className="text-sm text-muted-foreground">No recorded models for these dates.</p>}<p className="mt-3 text-xs text-muted-foreground">Standard pricing verified {data.pricing_version}. Unknown model rates stay unpriced.</p></section>
    </div>
  </div>;
}
