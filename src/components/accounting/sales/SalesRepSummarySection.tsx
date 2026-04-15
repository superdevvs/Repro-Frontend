import React from 'react';
import { format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  BarChart3,
  Loader2,
  Target,
  TrendingUp,
  UserPlus,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  SalesRepNewClient,
  SalesRepSummaryResponse,
  SalesRepTopClient,
} from '@/types/salesSummary';

interface SalesRepSummarySectionProps {
  data: SalesRepSummaryResponse | null;
  loading: boolean;
  error: string | null;
  daysWindow: number;
  onRetry: () => void | Promise<unknown>;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-US');

const formatCurrency = (value: number) => currencyFormatter.format(value || 0);

const formatPercent = (value: number) =>
  `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}%`;

const formatOptionalDate = (value?: string | null, formatPattern = 'MMM d, yyyy') => {
  if (!value) {
    return 'No activity yet';
  }

  try {
    return format(parseISO(value), formatPattern);
  } catch {
    return value;
  }
};

const formatBucketLabel = (bucket: string, daysWindow: number) =>
  formatOptionalDate(bucket, daysWindow >= 365 ? 'MMM' : 'MMM d');

const SummaryStateCard = ({
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<unknown>;
  compact?: boolean;
}) => (
  <div
    className={`flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 px-6 text-center ${
      compact ? 'py-8' : 'py-12'
    }`}
  >
    <AlertTriangle className="mb-3 h-5 w-5 text-muted-foreground" />
    <p className="text-sm font-semibold">{title}</p>
    <p className="mt-2 max-w-sm text-xs text-muted-foreground">{message}</p>
    {actionLabel && onAction ? (
      <Button variant="outline" size="sm" className="mt-4" onClick={onAction}>
        {actionLabel}
      </Button>
    ) : null}
  </div>
);

const MetricSkeleton = () => (
  <Card className="border border-border/70 bg-card/80">
    <CardContent className="space-y-3 p-5">
      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      <div className="h-8 w-32 animate-pulse rounded bg-muted" />
      <div className="h-3 w-36 animate-pulse rounded bg-muted" />
    </CardContent>
  </Card>
);

const SectionSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <Card className="border border-border/70 bg-card/80">
    <CardHeader className="space-y-2">
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="h-3 w-52 animate-pulse rounded bg-muted" />
    </CardHeader>
    <CardContent className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-2xl bg-muted" />
      ))}
    </CardContent>
  </Card>
);

const MetricCard = ({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}) => (
  <Card className="border border-border/70 bg-card/80 shadow-sm">
    <CardContent className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className="rounded-xl border border-primary/15 bg-primary/10 p-2 text-primary">
          {icon}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </CardContent>
  </Card>
);

const SalesRepMetricsRow = ({
  data,
  loading,
  error,
  onRetry,
}: {
  data: SalesRepSummaryResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void | Promise<unknown>;
}) => {
  if (loading) {
    return (
      <>
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
      </>
    );
  }

  if (error || !data) {
    return (
      <div className="md:col-span-2 xl:col-span-4">
        <Card className="border border-destructive/20 bg-destructive/5">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Unable to load sales summary</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {error || 'The latest rep metrics could not be loaded right now.'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summary } = data;

  return (
    <>
      <MetricCard
        icon={<UserPlus className="h-4 w-4" />}
        label="New Clients"
        value={numberFormatter.format(summary.new_clients)}
        description="Clients newly added to your book in this window."
      />
      <MetricCard
        icon={<Wallet className="h-4 w-4" />}
        label="Revenue"
        value={formatCurrency(summary.paid_revenue)}
        description="Paid invoice revenue from your accounts."
      />
      <MetricCard
        icon={<TrendingUp className="h-4 w-4" />}
        label="Commission"
        value={
          summary.commission_rate === null
            ? 'Rate not set'
            : formatCurrency(summary.commission_earned ?? 0)
        }
        description={
          summary.commission_rate === null
            ? 'Add repDetails.commissionPercentage to calculate earnings.'
            : `${formatPercent(summary.commission_rate)} commission rate`
        }
      />
      <MetricCard
        icon={<Target className="h-4 w-4" />}
        label="Average Client Value"
        value={formatCurrency(summary.average_client_value)}
        description="Paid revenue per active client in the selected window."
      />
    </>
  );
};

const SalesRepTrendCard = ({
  data,
  loading,
  error,
  daysWindow,
  onRetry,
}: {
  data: SalesRepSummaryResponse | null;
  loading: boolean;
  error: string | null;
  daysWindow: number;
  onRetry: () => void | Promise<unknown>;
}) => {
  if (loading) {
    return <SectionSkeleton rows={5} />;
  }

  return (
    <Card className="border border-border/70 bg-card/80 shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-primary" />
          Growth And Revenue Trend
        </CardTitle>
        <CardDescription>
          New clients and paid revenue moving together across the selected window.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error || !data ? (
          <SummaryStateCard
            title="Trend unavailable"
            message={error || 'The activity trend could not be loaded right now.'}
            actionLabel="Retry"
            onAction={onRetry}
          />
        ) : data.trend.length === 0 ? (
          <SummaryStateCard
            title="No activity in this window"
            message={`Paid revenue and new clients will appear here once your ${daysWindow}-day window has activity.`}
          />
        ) : (
          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.trend} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.18)" />
                <XAxis
                  dataKey="bucket"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: 'rgb(100 116 139)' }}
                  tickFormatter={(value) => formatBucketLabel(String(value), data.period.days_window || daysWindow)}
                />
                <YAxis
                  yAxisId="revenue"
                  tickLine={false}
                  axisLine={false}
                  width={78}
                  tick={{ fontSize: 12, fill: 'rgb(100 116 139)' }}
                  tickFormatter={(value) => formatCurrency(Number(value))}
                />
                <YAxis
                  yAxisId="clients"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tick={{ fontSize: 12, fill: 'rgb(100 116 139)' }}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'Revenue') {
                      return [formatCurrency(Number(value)), name];
                    }

                    return [numberFormatter.format(Number(value)), name];
                  }}
                  labelFormatter={(value) =>
                    formatBucketLabel(String(value), data.period.days_window || daysWindow)
                  }
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    backgroundColor: 'rgba(255,255,255,0.98)',
                  }}
                />
                <Legend />
                <Bar
                  yAxisId="revenue"
                  dataKey="paid_revenue"
                  name="Revenue"
                  fill="#2563eb"
                  radius={[10, 10, 0, 0]}
                  maxBarSize={42}
                />
                <Line
                  yAxisId="clients"
                  type="monotone"
                  dataKey="new_clients"
                  name="New Clients"
                  stroke="#0f766e"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ClientRow = ({
  client,
  index,
  showCreatedAt = false,
}: {
  client: SalesRepTopClient | SalesRepNewClient;
  index: number;
  showCreatedAt?: boolean;
}) => (
  <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {index + 1}
          </div>
          <p className="truncate text-sm font-semibold">{client.client_name}</p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {showCreatedAt && 'created_at' in client
            ? `Added ${formatOptionalDate(client.created_at)}`
            : 'Paid revenue in the selected window'}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold">{formatCurrency(client.paid_revenue)}</p>
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Revenue</p>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>Outstanding {formatCurrency(client.outstanding_balance)}</span>
      <span>Last shoot {formatOptionalDate(client.last_shoot_date)}</span>
    </div>
  </div>
);

const SalesRepClientListCard = ({
  title,
  description,
  emptyTitle,
  emptyMessage,
  clients,
  loading,
  error,
  onRetry,
  showCreatedAt = false,
}: {
  title: string;
  description: string;
  emptyTitle: string;
  emptyMessage: string;
  clients: Array<SalesRepTopClient | SalesRepNewClient>;
  loading: boolean;
  error: string | null;
  onRetry: () => void | Promise<unknown>;
  showCreatedAt?: boolean;
}) => (
  <Card className="border border-border/70 bg-card/80 shadow-sm">
    <CardHeader className="space-y-2">
      <CardTitle className="text-base">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>
      {loading ? (
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-2xl bg-muted" />
          <div className="h-16 animate-pulse rounded-2xl bg-muted" />
          <div className="h-16 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : error ? (
        <SummaryStateCard
          title={`${title} unavailable`}
          message={error}
          actionLabel="Retry"
          onAction={onRetry}
          compact
        />
      ) : clients.length === 0 ? (
        <SummaryStateCard title={emptyTitle} message={emptyMessage} compact />
      ) : (
        <div className="space-y-3">
          {clients.map((client, index) => (
            <ClientRow
              key={`${title}-${client.client_id}`}
              client={client}
              index={index}
              showCreatedAt={showCreatedAt}
            />
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

export function SalesRepSummarySection({
  data,
  loading,
  error,
  daysWindow,
  onRetry,
}: SalesRepSummarySectionProps) {
  const hasNoActivity = Boolean(
    data &&
      !loading &&
      !error &&
      data.summary.new_clients === 0 &&
      data.summary.paid_revenue === 0,
  );

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border border-border/70 bg-[linear-gradient(135deg,rgba(37,99,235,0.08),rgba(15,23,42,0.02))] shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/80">
              Sales Snapshot
            </p>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Client growth and paid revenue, in sync</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                The top half of this page is now tuned to your actual book of business: new clients,
                paid revenue, commission, and the accounts driving this window.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-background/75 px-4 py-3 text-sm">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Selected Window</p>
            <p className="mt-1 font-semibold">
              Last {data?.period.days_window || daysWindow} day{(data?.period.days_window || daysWindow) === 1 ? '' : 's'}
            </p>
            {data?.summary.commission_rate === null ? (
              <p className="mt-1 text-xs text-muted-foreground">Commission rate is not configured yet.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {hasNoActivity ? (
        <Card className="border border-border/70 bg-muted/20">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4" />
            No paid revenue or new clients landed in this window yet. The cards below stay live and will
            update as soon as activity comes in.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SalesRepMetricsRow data={data} loading={loading} error={error} onRetry={onRetry} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
        <SalesRepTrendCard
          data={data}
          loading={loading}
          error={error}
          daysWindow={daysWindow}
          onRetry={onRetry}
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <SalesRepClientListCard
            title="Top Clients"
            description="Accounts ranked by paid revenue in the selected window."
            emptyTitle="No top clients yet"
            emptyMessage="Once paid revenue lands, the strongest client accounts will surface here with balance and last activity details."
            clients={data?.top_clients ?? []}
            loading={loading}
            error={error}
            onRetry={onRetry}
          />

          <SalesRepClientListCard
            title="New Clients"
            description="The newest accounts that entered your scope during this window."
            emptyTitle="No new clients in this window"
            emptyMessage="Newly assigned or created accounts will appear here with revenue, outstanding balance, and last shoot activity."
            clients={data?.new_clients ?? []}
            loading={loading}
            error={error}
            onRetry={onRetry}
            showCreatedAt
          />
        </div>
      </div>
    </div>
  );
}

export default SalesRepSummarySection;
