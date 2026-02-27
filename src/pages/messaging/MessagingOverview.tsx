import { useMemo } from 'react';
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
  TrendingUp,
  CheckCircle,
  Inbox,
} from 'lucide-react';
import { getMessagingOverview, getEmailMessages } from '@/services/messaging';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function MessagingOverview() {
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['messaging-overview'],
    queryFn: getMessagingOverview,
  });

  const { data: recentMessages, isLoading: messagesLoading } = useQuery({
    queryKey: ['recent-messages'],
    queryFn: () => getEmailMessages({ per_page: 10 }),
  });

  const messages = recentMessages?.data || [];

  const stats = [
    { title: 'Sent Today', value: overview?.total_sent_today || 0, icon: Send, color: 'text-emerald-500', bgColor: 'bg-emerald-100/70' },
    { title: 'Scheduled', value: overview?.total_scheduled || 0, icon: Clock, color: 'text-sky-500', bgColor: 'bg-sky-100/70' },
    { title: 'Failed', value: overview?.total_failed_today || 0, icon: AlertCircle, color: 'text-rose-500', bgColor: 'bg-rose-100/70' },
    { title: 'Unread SMS', value: overview?.unread_sms_count || 0, icon: MessageSquare, color: 'text-purple-500', bgColor: 'bg-purple-100/70' },
  ];

  const quickLinks = [
    { title: 'Compose Email', description: 'Send a new email message', icon: Mail, href: '/messaging/email/compose', color: 'text-blue-600' },
    { title: 'Email Inbox', description: 'View all email messages', icon: Mail, href: '/messaging/email/inbox', color: 'text-green-600' },
    { title: 'SMS Center', description: 'Manage SMS conversations', icon: MessageSquare, href: '/messaging/sms', color: 'text-purple-600' },
    { title: 'Templates', description: 'Manage email templates', icon: FileText, href: '/messaging/email/templates', color: 'text-yellow-600' },
    { title: 'Automations', description: 'Configure automation rules', icon: Zap, href: '/messaging/email/automations', color: 'text-orange-600' },
    { title: 'Settings', description: 'Email & SMS providers', icon: Settings, href: '/messaging/settings', color: 'text-gray-600' },
  ];

  const statusColors = {
    SENT: 'bg-green-100 text-green-800',
    SCHEDULED: 'bg-blue-100 text-blue-800',
    FAILED: 'bg-red-100 text-red-800',
    QUEUED: 'bg-yellow-100 text-yellow-800',
    DELIVERED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  };

  const heroMetrics = useMemo(() => ([
    { label: 'Delivery rate', value: overview?.delivery_rate ? `${overview.delivery_rate}%` : '—', icon: TrendingUp, lightTone: 'text-emerald-600', darkTone: 'text-emerald-100' },
    { label: 'Avg. response time', value: overview?.average_response_time || '—', icon: Clock, lightTone: 'text-indigo-600', darkTone: 'text-white' },
    { label: 'Active workflows', value: overview?.active_automations || 0, icon: Zap, lightTone: 'text-amber-600', darkTone: 'text-amber-100' },
  ]), [overview]);

  return (
    <DashboardLayout>
      <div className="space-y-4 px-2 pt-3 pb-24 sm:pb-6 sm:space-y-6 sm:p-6 overflow-hidden min-w-0">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="relative overflow-hidden border border-border bg-gradient-to-br from-indigo-50 via-purple-50 to-rose-50 dark:from-indigo-600 dark:via-purple-600 dark:to-rose-500 lg:col-span-2">
            <div className="absolute inset-y-0 right-0 opacity-10 dark:opacity-20">
              <Inbox className="h-full w-40 translate-x-12 translate-y-6 text-indigo-400 dark:text-white" />
            </div>
            <div className="relative z-10 flex flex-col gap-6 p-6">
              <div>
                <p className="text-sm uppercase tracking-wide text-indigo-600 dark:text-white/70">Messaging Center</p>
                <h1 className="text-3xl font-semibold leading-tight text-gray-900 dark:text-white">
                  All client conversations, perfectly orchestrated.
                </h1>
                <p className="mt-2 text-gray-700 dark:text-white/80 max-w-3xl">
                  Keep track of email, SMS, automations, and templates in one streamlined workspace.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-white/15 dark:hover:bg-white/25 dark:backdrop-blur">
                  <Link to="/messaging/email/compose">Compose Message</Link>
                </Button>
                <Button asChild variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-white/40 dark:text-white dark:hover:bg-white/10">
                  <Link to="/messaging/email/templates">Manage Templates</Link>
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {heroMetrics.map((metric, idx) => {
                  const Icon = metric.icon;
                  const iconClass = idx === 0 
                    ? 'h-4 w-4 text-emerald-600 dark:text-emerald-100'
                    : idx === 1
                    ? 'h-4 w-4 text-indigo-600 dark:text-white'
                    : 'h-4 w-4 text-amber-600 dark:text-amber-100';
                  return (
                    <div key={idx} className="rounded-lg bg-white/80 dark:bg-white/10 backdrop-blur border border-indigo-100 dark:border-white/20 p-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/80">
                        <Icon className={iconClass} />
                        <span>{metric.label}</span>
                      </div>
                      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{metric.value}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
          <Card className="border border-border bg-card">
            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Health</p>
                  <p className="text-3xl font-semibold mt-1">
                    {overview?.delivery_score ? `${overview.delivery_score}%` : '87%'}
                  </p>
                </div>
                <div className="rounded-full bg-emerald-100 text-emerald-600 p-3">
                  <CheckCircle className="h-5 w-5" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Based on bounce rate, template freshness, and active workflows.
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>Templates active</span>
                  <span className="font-medium">{overview?.template_usage?.active || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Automation coverage</span>
                  <span className="font-medium">{overview?.automation_summary?.coverage || '64%'}</span>
                </div>
              </div>
              <Button asChild>
                <Link to="/messaging/email/automations">Improve Health</Link>
              </Button>
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

        <div className="grid gap-4 lg:grid-cols-3 min-w-0">
          <Card className="lg:col-span-2 overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-6 pb-3 sm:pb-4 gap-3">
              <div>
                <h2 className="text-xl font-semibold">Recent Activity</h2>
                <p className="text-sm text-muted-foreground">Latest outbound and inbound messages</p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/messaging/email/inbox">View Inbox</Link>
              </Button>
            </div>
            {messagesLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto opacity-20 mb-2" />
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="divide-y">
                {messages.map((message) => (
                  <Link key={message.id} to="/messaging/email/inbox" className="block p-3 sm:p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-2 sm:gap-4 min-w-0">
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 mb-1 min-w-0">
                          <span className="font-medium truncate text-sm sm:text-base">
                            {message.direction === 'OUTBOUND' ? message.to_address : message.from_address}
                          </span>
                          <Badge className={`${statusColors[message.status]} flex-shrink-0`}>
                            {message.status}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium truncate">
                          {message.subject || '(No Subject)'}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          {message.body_text?.substring(0, 80)}
                        </p>
                      </div>
                      <div className="hidden sm:block text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(message.created_at), 'MMM d, h:mm a')}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">SMS Queue</p>
                <p className="text-2xl font-semibold">{overview?.unread_sms_count || 0}</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/messaging/sms">Open SMS</Link>
              </Button>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">Upcoming broadcasts</p>
                <p>{overview?.upcoming_broadcasts || 'No broadcasts scheduled'}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Automation alerts</p>
                <p>• {overview?.automation_summary?.paused || 0} paused rules</p>
                <p>• Deliverability steady at {overview?.delivery_rate ? `${overview.delivery_rate}%` : '92%'}</p>
              </div>
            </div>
            <Button asChild>
              <Link to="/messaging/email/automations">Review Automations</Link>
            </Button>
          </Card>
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

