import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, ClipboardList, PhoneCall, PhoneForwarded, Settings, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getScheduledVoiceCalls, getVoiceCalls, getVoiceSettings, getVoiceStats } from '@/services/voice';

export default function CallsOverview() {
  const stats = useQuery({ queryKey: ['voice-stats', '7d'], queryFn: () => getVoiceStats('7d') });
  const calls = useQuery({ queryKey: ['voice-calls', 'overview'], queryFn: () => getVoiceCalls({ per_page: 6 }) });
  const callbacks = useQuery({ queryKey: ['scheduled-voice-calls', 'overview'], queryFn: () => getScheduledVoiceCalls({ per_page: 6 }) });
  const settings = useQuery({ queryKey: ['voice-settings'], queryFn: getVoiceSettings });

  const statCards = stats.data?.cards ?? [];
  const recentCalls = calls.data?.data ?? [];
  const callbackRows = callbacks.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.key}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <div className="mt-1 text-2xl font-semibold">
                    {card.value}
                    {card.suffix && <span className="ml-1 text-sm text-muted-foreground">{card.suffix}</span>}
                  </div>
                </div>
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  <PhoneCall className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-blue-600" /> Recent Calls
            </CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link to="/calls/log">Open log</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentCalls.map((call) => (
              <div key={call.id} className="rounded-md border border-border bg-muted/20 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{call.caller_user?.name ?? call.caller_contact?.name ?? call.from_phone ?? call.to_phone ?? 'Unknown caller'}</span>
                      <Badge variant="outline">{call.direction}</Badge>
                      <Badge variant="secondary">{call.status}</Badge>
                      {call.intent && <Badge>{call.intent}</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{call.summary || call.transcript?.slice(0, 160) || 'No summary yet.'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Menu: {call.menu_digit || 'none'} · Callback: {call.callback_status || 'none'} · Disposition: {call.disposition || 'none'}
                    </p>
                  </div>
                  {call.callback_status && (
                    <Badge variant="outline" className="self-start">
                      <PhoneForwarded className="mr-1 h-3 w-3" /> Callback
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {calls.isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Loading calls...</div>}
            {!calls.isLoading && recentCalls.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No voice calls yet.</div>}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-blue-600" /> AI Receptionist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={settings.data?.enabled ? 'default' : 'secondary'}>{settings.data?.enabled ? 'Enabled' : 'Disabled'}</Badge>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Assistant</span>
                <span className="max-w-[180px] truncate">{settings.data?.assistant_id || 'Not configured'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Handoff</span>
                <span>{settings.data?.support_handoff_number || 'Not configured'}</span>
              </div>
              <Button asChild size="sm" variant="outline" className="mt-2 w-full">
                <Link to="/calls/settings">
                  <Settings className="mr-2 h-4 w-4" /> Voice settings
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-blue-600" /> Callback Queue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {callbackRows.map((item) => (
                <div key={item.id} className="rounded-md border border-border bg-muted/20 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{item.target_phone}</span>
                    <Badge variant="outline">{item.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.reason || item.automation_type || 'Follow-up call'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.next_attempt_at ? new Date(item.next_attempt_at).toLocaleString() : 'Not scheduled'}</p>
                </div>
              ))}
              {!callbacks.isLoading && callbackRows.length === 0 && (
                <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  <AlertTriangle className="mx-auto mb-2 h-5 w-5" /> No callbacks waiting.
                </div>
              )}
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link to="/calls/automations">Open automations</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
