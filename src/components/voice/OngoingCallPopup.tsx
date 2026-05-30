import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, ExternalLink, Maximize2, PhoneCall, PhoneOff, Sparkles, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { getVoiceCalls, hangupVoiceCall } from '@/services/voice';
import { useCallLiveStream } from '@/hooks/useCallLiveStream';
import { MoodChips } from '@/components/voice/MoodChips';
import { scheduleStateMeta } from '@/components/voice/ScheduleBadge';
import type { VoiceCall } from '@/types/voice';

const ACTIVE_STATUSES = new Set(['dialing', 'ringing', 'active', 'in_progress']);

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const computeElapsed = (call: VoiceCall): number => {
  const start = call.started_at || call.created_at;
  if (!start) return 0;
  const startMs = new Date(start).getTime();
  if (Number.isNaN(startMs)) return 0;
  return Math.max(0, Math.floor((Date.now() - startMs) / 1000));
};

export default function OngoingCallPopup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const [tick, setTick] = useState(0);

  const calls = useQuery({
    queryKey: ['voice-calls', 'ongoing'],
    queryFn: () => getVoiceCalls({ per_page: 5 }),
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const ongoing = useMemo(() => {
    const rows = calls.data?.data ?? [];
    return rows.find(
      (call) => ACTIVE_STATUSES.has((call.status || '').toLowerCase()) && !dismissedIds.has(call.id),
    );
  }, [calls.data?.data, dismissedIds]);

  const live = useCallLiveStream(ongoing?.id ?? null);

  useEffect(() => {
    if (!ongoing) return;
    const interval = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [ongoing]);

  const hangup = useMutation({
    mutationFn: (id: number) => hangupVoiceCall(id),
    onSuccess: () => {
      toast({ title: 'Call ended', description: 'Hangup signal sent to Telnyx.' });
      queryClient.invalidateQueries({ queryKey: ['voice-calls'] });
      queryClient.invalidateQueries({ queryKey: ['voice-stats'] });
    },
    onError: (error: unknown) => {
      const axiosErr = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
      toast({
        title: 'Unable to hang up',
        description:
          axiosErr?.response?.data?.error
          || axiosErr?.response?.data?.message
          || axiosErr?.message
          || 'Try again or end the call from Telnyx Mission Control.',
        variant: 'destructive',
      });
    },
  });

  if (!ongoing) return null;

  const callerName =
    ongoing.callerUser?.name
    || ongoing.caller_user?.name
    || ongoing.callerContact?.name
    || ongoing.caller_contact?.name
    || ongoing.to_phone
    || ongoing.from_phone
    || 'Unknown caller';

  const peerNumber = ongoing.direction === 'OUTBOUND' ? ongoing.to_phone : ongoing.from_phone;
  void tick;
  const elapsed = computeElapsed(ongoing);
  const status = (ongoing.status || '').toLowerCase();
  const statusLabel =
    status === 'dialing'
      ? 'Dialing…'
      : status === 'ringing'
        ? 'Ringing…'
        : status === 'in_progress' || status === 'active'
          ? 'In progress'
          : ongoing.status;

  const insights = live.insights;
  const scheduleMeta = scheduleStateMeta(live.scheduleState?.state);
  const confidence = live.realtime.confidence != null ? Math.round(live.realtime.confidence * 100) : null;
  const dismiss = () => setDismissedIds((prev) => new Set(prev).add(ongoing.id));

  const topAction = insights?.suggested_replies?.[0];

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2 sm:bottom-6 sm:right-6">
      <div className="pointer-events-auto rounded-xl border border-border bg-card text-card-foreground shadow-xl">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            <PhoneCall className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{callerName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {peerNumber || 'Unknown number'} · {ongoing.direction}
            </p>
          </div>
          <span className="font-mono text-xs text-muted-foreground">{formatDuration(elapsed)}</span>
          <Link
            to={`/calls/live/${ongoing.id}`}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Open full cockpit"
          >
            <Maximize2 className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={collapsed ? 'Expand call popup' : 'Collapse call popup'}
          >
            {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Hide call popup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {collapsed ? (
          <div className="flex items-center justify-between gap-2 px-4 py-2 text-xs">
            <Badge variant="outline" className={scheduleMeta.className}>
              {scheduleMeta.icon} {scheduleMeta.label}
            </Badge>
            <span className="truncate text-muted-foreground">
              {topAction ? topAction.label : statusLabel}
            </span>
          </div>
        ) : (
          <Tabs defaultValue="live" className="px-2 py-2">
            <div className="flex items-center justify-between px-2">
              <TabsList className="h-8">
                <TabsTrigger value="live" className="text-xs">Live</TabsTrigger>
                <TabsTrigger value="memory" className="text-xs">Memory</TabsTrigger>
                <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
              </TabsList>
              <Badge variant="outline" className={`${scheduleMeta.className} h-6`}>
                {scheduleMeta.icon}
              </Badge>
            </div>

            <TabsContent value="live" className="space-y-3 px-2 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                  {statusLabel}
                </Badge>
                {ongoing.assistant_id && (
                  <Badge variant="outline" className="gap-1">
                    <Sparkles className="h-3 w-3" /> AI
                  </Badge>
                )}
              </div>

              {confidence != null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Confidence</span>
                    <span>{confidence}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
                    <div
                      className={`h-full ${confidence >= 85 ? 'bg-emerald-500' : confidence >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${confidence}%` }}
                    />
                  </div>
                </div>
              )}

              <MoodChips customerMood={insights?.customer_mood} robbieQuality={insights?.robbie_quality} />

              {(insights?.suggested_replies ?? []).slice(0, 3).map((reply, idx) => (
                <div key={idx} className="rounded-md border border-border bg-muted/30 p-2" title={`Why: ${reply.why}`}>
                  <div className="text-xs font-medium">{reply.label}</div>
                  <div className="text-[11px] text-muted-foreground">{reply.spoken}</div>
                </div>
              ))}

              {insights?.human_takeover_recommended && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  Robbie recommends a human takeover.
                </div>
              )}

              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline" className="flex-1">
                  <Link to={`/calls/live/${ongoing.id}`}>
                    Open cockpit <ExternalLink className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={hangup.isPending}
                  onClick={() => hangup.mutate(ongoing.id)}
                >
                  <PhoneOff className="mr-1 h-4 w-4" />
                  {hangup.isPending ? 'Ending…' : 'End'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="memory" className="space-y-2 px-2 pt-2 text-xs">
              {(() => {
                const t1 = (live.memory.tier1 ?? {}) as Record<string, any>;
                return (
                  <>
                    <div className="flex flex-wrap gap-1">
                      {t1.caller_name && <Badge variant="outline">{t1.caller_name}</Badge>}
                      {typeof t1.identified === 'boolean' && (
                        <Badge variant="outline">{t1.identified ? 'Known' : 'Unknown'}</Badge>
                      )}
                    </div>
                    {t1.unpaid_invoices && (t1.unpaid_invoices.count ?? 0) > 0 && (
                      <div className="text-muted-foreground">
                        Unpaid: {t1.unpaid_invoices.count} (${t1.unpaid_invoices.total})
                      </div>
                    )}
                    {t1.active_issue && <div className="text-amber-600">Active issue open</div>}
                    {!t1.caller_name && <p className="text-muted-foreground">Loading memory…</p>}
                  </>
                );
              })()}
            </TabsContent>

            <TabsContent value="timeline" className="space-y-1 px-2 pt-2 text-xs">
              {live.transcript.slice(-6).map((c) => (
                <div key={c.seq} className="text-muted-foreground">
                  <span className="font-medium capitalize">{c.speaker}:</span> {c.text}
                </div>
              ))}
              {live.transcript.length === 0 && <p className="text-muted-foreground">No transcript yet.</p>}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
