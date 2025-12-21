import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, Mail, MessageCircle, RefreshCcw, TriangleAlert } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { fetchMessagingOverview } from '@/services/messagingService';
import { getAuthToken } from '@/utils/authToken';
import { formatDistanceToNow } from 'date-fns';

type MessagingOverviewResponse = {
  kpis: Record<string, number>;
  recentActivity: any[];
  failedMessages: any[];
  topContacts: { to_address: string; total: number }[];
  providerHealth: { id: number; display_name: string; provider: string; type: string; status: string }[];
};

const MessagingOverviewPage = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<MessagingOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken(session?.accessToken);
      const response = await fetchMessagingOverview<MessagingOverviewResponse>(token);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load overview');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const kpiCards = useMemo(
    () => [
      {
        label: 'Email sent',
        value: data?.kpis?.email_sent ?? 0,
        icon: Mail,
      },
      {
        label: 'Email failed',
        value: data?.kpis?.email_failed ?? 0,
        icon: TriangleAlert,
      },
      {
        label: 'SMS sent',
        value: data?.kpis?.sms_sent ?? 0,
        icon: MessageCircle,
      },
      {
        label: 'SMS failed',
        value: data?.kpis?.sms_failed ?? 0,
        icon: TriangleAlert,
      },
      {
        label: 'Scheduled emails',
        value: data?.kpis?.scheduled_emails ?? 0,
        icon: RefreshCcw,
      },
    ],
    [data?.kpis],
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="Messaging Overview"
        description="Centralized health view for email and SMS channels."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Refresh
            </Button>
            <Button size="sm" onClick={() => navigate('/messaging/email')}>
              Compose email
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/messaging/sms')}>
              Send SMS
            </Button>
          </div>
        }
      />

      {error && (
        <Card className="mb-4 border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load overview</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {kpiCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest outbound and inbound messages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && !data && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading activity…
              </div>
            )}
            {!loading && data?.recentActivity?.length === 0 && (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            )}
            {data?.recentActivity?.map((message) => (
              <div key={message.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{message.subject || message.body_text}</span>
                  <span className="text-muted-foreground">
                    {message.created_at
                      ? formatDistanceToNow(new Date(message.created_at), { addSuffix: true })
                      : ''}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {message.channel} • {message.status} • To {message.to_address}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provider health</CardTitle>
            <CardDescription>Quick glance at configured channels.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.providerHealth?.map((provider) => (
              <div key={provider.id} className="flex items-center justify-between rounded border p-2">
                <div>
                  <p className="text-sm font-medium">{provider.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {provider.provider} &middot; {provider.type}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium ${
                    provider.status === 'healthy' ? 'text-emerald-600' : 'text-muted-foreground'
                  }`}
                >
                  {provider.status}
                </span>
              </div>
            ))}
            {!data?.providerHealth?.length && (
              <p className="text-sm text-muted-foreground">No providers configured yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Failed messages</CardTitle>
            <CardDescription>Most recent errors across channels.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.failedMessages?.map((message) => (
              <div key={message.id} className="rounded border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium">{message.subject || message.body_text}</p>
                <p className="text-xs text-muted-foreground">
                  {message.channel} &middot; {message.error_message || 'Unknown error'}
                </p>
              </div>
            ))}
            {!data?.failedMessages?.length && (
              <p className="text-sm text-muted-foreground">No failures detected.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top contacts</CardTitle>
            <CardDescription>Most engaged contacts in the selected range.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.topContacts?.map((contact) => (
              <div key={contact.to_address} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{contact.to_address}</p>
                  <p className="text-xs text-muted-foreground">messages sent</p>
                </div>
                <span className="text-sm font-semibold">{contact.total}</span>
              </div>
            ))}
            {!data?.topContacts?.length && (
              <p className="text-sm text-muted-foreground">No contact data available.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator className="my-6" />

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => navigate('/messaging/email')}>
          Go to email workspace
        </Button>
        <Button variant="secondary" onClick={() => navigate('/messaging/sms')}>
          Go to SMS inbox
        </Button>
        <Button variant="ghost" onClick={() => navigate('/messaging/settings')}>
          Configure providers
        </Button>
      </div>
    </DashboardLayout>
  );
};

export default MessagingOverviewPage;

