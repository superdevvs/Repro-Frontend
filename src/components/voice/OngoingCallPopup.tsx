import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, ExternalLink, Mic, PhoneCall, PhoneOff, Sparkles, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { getVoiceCalls, hangupVoiceCall } from '@/services/voice';
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

  // Re-render every second to update elapsed time while a call is ongoing.
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
  // `tick` is intentionally read so the timer re-renders every second.
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

  const dismiss = () => setDismissedIds((prev) => new Set(prev).add(ongoing.id));

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 sm:bottom-6 sm:right-6">
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

        {!collapsed && (
          <div className="space-y-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                {statusLabel}
              </Badge>
              {ongoing.intent && <Badge variant="secondary">{ongoing.intent}</Badge>}
              {ongoing.menu_digit && <Badge>Digit {ongoing.menu_digit}</Badge>}
              {ongoing.assistant_id && (
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="h-3 w-3" /> AI
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mic className="h-3.5 w-3.5" />
                <span>{ongoing.recording_url ? 'Recording' : 'Live'}</span>
              </div>
              <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                <Link to="/calls/log">
                  Open log <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                disabled={hangup.isPending}
                onClick={() => hangup.mutate(ongoing.id)}
              >
                <PhoneOff className="mr-2 h-4 w-4" />
                {hangup.isPending ? 'Ending…' : 'End call'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
