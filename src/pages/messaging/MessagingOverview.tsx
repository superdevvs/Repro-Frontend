import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Mail,
  MessageSquare,
  Send,
  Clock,
  AlertCircle,
  Zap,
  Settings,
  FileText,
  Inbox,
  ArrowRight,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { getEmailMessages, getMessagingOverview, getSmsThreads } from '@/services/messaging';
import { Skeleton } from '@/components/ui/skeleton';
import type { Message, SmsThreadSummary } from '@/types/messaging';

function formatMessageTime(dateString?: string | null): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
}

const emailStatusTone: Record<string, string> = {
  SENT: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  DELIVERED: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  SCHEDULED: 'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300',
  QUEUED: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  FAILED: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300',
  CANCELLED: 'border-muted bg-muted text-muted-foreground',
};

function LatestEmailRow({ message }: { message: Message }) {
  const recipient = message.direction === 'OUTBOUND'
    ? message.to_address
    : message.from_address || message.sender_display_name || 'Inbound email';
  const preview = message.body_text?.trim() || message.subject || 'No preview available';

  return (
    <Link
      to="/messaging/email/inbox"
      className="block rounded-lg border border-transparent px-3 py-3 transition hover:border-border hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{message.subject || '(No subject)'}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{recipient}</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{formatMessageTime(message.created_at)}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{preview}</p>
      <div className="mt-3 flex items-center gap-2">
        <Badge variant="outline" className={emailStatusTone[message.status] || 'border-muted bg-muted text-muted-foreground'}>
          {message.status.toLowerCase()}
        </Badge>
        {message.send_source === 'AUTOMATION' && <Badge variant="secondary">Auto</Badge>}
      </div>
    </Link>
  );
}

function LatestSmsRow({ thread }: { thread: SmsThreadSummary }) {
  const contact = thread.contact?.name || thread.contact?.primaryNumber || 'Unknown contact';

  return (
    <Link
      to={`/messaging/sms?thread=${thread.id}`}
      className="block rounded-lg border border-transparent px-3 py-3 transition hover:border-border hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {thread.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
            <p className="truncate text-sm font-semibold">{contact}</p>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {thread.lastDirection === 'OUTBOUND' ? 'Sent message' : 'Received message'}
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{formatMessageTime(thread.lastMessageAt)}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{thread.lastMessageSnippet || 'No preview available'}</p>
      <div className="mt-3 flex items-center gap-2">
        {thread.contact?.type && (
          <Badge variant="outline" className="capitalize">
            {thread.contact.type}
          </Badge>
        )}
        {thread.unread && <Badge variant="secondary">Unread</Badge>}
      </div>
    </Link>
  );
}

function LatestPanelSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-lg px-3 py-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/3" />
          <Skeleton className="mt-3 h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function MessagingOverview() {
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['messaging-overview'],
    queryFn: getMessagingOverview,
  });

  const { data: emailMessagesData, isLoading: emailMessagesLoading } = useQuery({
    queryKey: ['messaging-overview-email-messages'],
    queryFn: () => getEmailMessages({ per_page: 5 }),
  });

  const { data: smsThreadsData, isLoading: smsThreadsLoading } = useQuery({
    queryKey: ['messaging-overview-sms-threads'],
    queryFn: () => getSmsThreads({ per_page: 5 }),
  });

  const latestEmails = emailMessagesData?.data || [];
  const latestSmsThreads = smsThreadsData?.data || [];

  const stats = [
    { title: 'Sent Today', value: overview?.total_sent_today || 0, icon: Send, color: 'text-emerald-500 dark:text-emerald-300', bgColor: 'bg-emerald-100/70 dark:bg-emerald-500/15' },
    { title: 'Scheduled', value: overview?.total_scheduled || 0, icon: Clock, color: 'text-sky-500 dark:text-sky-300', bgColor: 'bg-sky-100/70 dark:bg-sky-500/15' },
    { title: 'Failed', value: overview?.total_failed_today || 0, icon: AlertCircle, color: 'text-rose-500 dark:text-rose-300', bgColor: 'bg-rose-100/70 dark:bg-rose-500/15' },
    { title: 'Unread SMS', value: overview?.unread_sms_count || 0, icon: MessageSquare, color: 'text-purple-500 dark:text-purple-300', bgColor: 'bg-purple-100/70 dark:bg-purple-500/15' },
  ];

  const quickLinks = [
    { title: 'Compose Email', description: 'Send a new email message', icon: Mail, href: '/messaging/email/compose', color: 'text-blue-600' },
    { title: 'Email Inbox', description: 'View all email messages', icon: Mail, href: '/messaging/email/inbox', color: 'text-green-600' },
    { title: 'SMS Center', description: 'Manage SMS conversations', icon: MessageSquare, href: '/messaging/sms', color: 'text-purple-600' },
    { title: 'Templates', description: 'Manage email templates', icon: FileText, href: '/messaging/email/templates', color: 'text-yellow-600' },
    { title: 'Automations', description: 'Configure automation rules', icon: Zap, href: '/messaging/email/automations', color: 'text-orange-600' },
    { title: 'Settings', description: 'Email & SMS providers', icon: Settings, href: '/messaging/settings', color: 'text-gray-600' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4 px-2 pt-3 pb-24 sm:space-y-6 sm:px-6 sm:pb-6 sm:pt-0 overflow-hidden min-w-0">
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="overflow-hidden border border-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-300">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Email</p>
                  <p className="truncate text-xs text-muted-foreground">Latest email messages</p>
                </div>
              </div>
              <Button asChild variant="ghost" size="sm" className="shrink-0 gap-1">
                <Link to="/messaging/email/inbox">
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="p-2">
              {emailMessagesLoading ? (
                <LatestPanelSkeleton />
              ) : latestEmails.length > 0 ? (
                latestEmails.map((message) => <LatestEmailRow key={message.id} message={message} />)
              ) : (
                <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-4 py-8 text-center text-sm text-muted-foreground">
                  <Inbox className="h-10 w-10 opacity-25" />
                  <p>No email messages yet.</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden border border-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Messages</p>
                  <p className="truncate text-xs text-muted-foreground">Latest SMS conversations</p>
                </div>
              </div>
              <Button asChild variant="ghost" size="sm" className="shrink-0 gap-1">
                <Link to="/messaging/sms">
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="p-2">
              {smsThreadsLoading ? (
                <LatestPanelSkeleton />
              ) : latestSmsThreads.length > 0 ? (
                latestSmsThreads.map((thread) => <LatestSmsRow key={thread.id} thread={thread} />)
              ) : (
                <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-4 py-8 text-center text-sm text-muted-foreground">
                  <MessageSquare className="h-10 w-10 opacity-25" />
                  <p>No SMS conversations yet.</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {overviewLoading
            ? [...Array(4)].map((_, i) => (
                <Card key={i} className="p-6">
                  <Skeleton className="h-20 w-full" />
                </Card>
              ))
            : stats.map((stat, idx) => {
                const Icon = stat.icon;
                return (
                  <Card key={idx} className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.title}</p>
                        <p className="text-3xl font-bold mt-1">{stat.value}</p>
                      </div>
                      <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                        <Icon className={`h-6 w-6 ${stat.color}`} />
                      </div>
                    </div>
                  </Card>
                );
              })}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Quick Actions</h2>
            <Button variant="ghost" asChild>
              <Link to="/messaging/settings">Configure channels</Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickLinks.map((link, idx) => {
              const Icon = link.icon;
              return (
                <Link key={idx} to={link.href}>
                  <Card className="p-5 hover:shadow-lg transition-shadow border border-muted cursor-pointer">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        <Icon className={`h-5 w-5 ${link.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">{link.title}</h3>
                        <p className="text-sm text-muted-foreground">{link.description}</p>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900">Automations Snapshot</h3>
                <p className="text-sm text-blue-800">
                  Automations are handling emails for account creation, shoot bookings, payments, and more.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-blue-900 border-blue-200 bg-white">
              {overview?.active_automations || 0} Active
            </Badge>
          </div>
          <Button variant="link" asChild className="mt-2 px-0 text-blue-700">
            <Link to="/messaging/email/automations">Manage Automations →</Link>
          </Button>
        </Card>
      </div>
    </DashboardLayout>
  );
}
