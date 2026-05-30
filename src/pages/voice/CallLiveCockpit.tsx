import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, PhoneOff, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import ScheduleBadge from '@/components/voice/ScheduleBadge';
import CoPilotPanel from '@/components/voice/CoPilotPanel';
import MemoryDrawer from '@/components/voice/MemoryDrawer';
import { useCallLiveStream } from '@/hooks/useCallLiveStream';
import { getVoiceCall, getVoiceLlmUsage, hangupVoiceCall, markCockpitOpened, pageVoiceCallStaff } from '@/services/voice';

const confidenceColor = (confidence?: number | null) => {
  if (confidence == null) return 'bg-muted';
  if (confidence >= 0.85) return 'bg-emerald-500';
  if (confidence >= 0.7) return 'bg-amber-500';
  return 'bg-red-500';
};

export default function CallLiveCockpit() {
  const params = useParams();
  const callId = Number(params.id);
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [speakerFilter, setSpeakerFilter] = useState<'all' | 'assistant' | 'customer'>('all');

  const call = useQuery({
    queryKey: ['voice-call', callId],
    queryFn: () => getVoiceCall(callId),
    enabled: Number.isFinite(callId),
    refetchInterval: 5000,
  });

  const live = useCallLiveStream(Number.isFinite(callId) ? callId : null);

  const usage = useQuery({
    queryKey: ['voice-llm-usage'],
    queryFn: getVoiceLlmUsage,
    refetchInterval: 30000,
  });

  // Fire the cockpit_opened intelligence trigger once.
  useEffect(() => {
    if (Number.isFinite(callId)) {
      markCockpitOpened(callId).catch(() => undefined);
    }
  }, [callId]);

  const hangup = useMutation({
    mutationFn: () => hangupVoiceCall(callId),
    onSuccess: () => toast({ title: 'Call ended' }),
  });

  const transfer = useMutation({
    mutationFn: (reason: string) => pageVoiceCallStaff(callId, reason),
    onSuccess: () => toast({ title: 'Staff paged', description: 'A callback/handoff was queued.' }),
  });

  const insights = live.insights ?? live.finalSummary;

  const filteredTranscript = useMemo(() => {
    return live.transcript.filter((c) => {
      if (speakerFilter !== 'all' && c.speaker !== speakerFilter) return false;
      if (search && !c.text.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [live.transcript, search, speakerFilter]);

  const callerName =
    call.data?.callerUser?.name || call.data?.callerContact?.name || call.data?.from_phone || 'Caller';

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <Button asChild size="sm" variant="ghost" className="h-8 px-2">
          <Link to="/calls/log">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Link>
        </Button>
        <ScheduleBadge state={live.scheduleState} />
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{callerName}</span>
          <Badge variant="secondary">{call.data?.status ?? '—'}</Badge>
          {call.data?.intent && <Badge variant="outline">{call.data.intent}</Badge>}
          {!live.connected && !live.closed && <Badge variant="outline">connecting…</Badge>}
          {live.closed && <Badge variant="outline">stream closed</Badge>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="h-8">
            <Link to="/calls/log">
              Detail page <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8"
            disabled={hangup.isPending}
            onClick={() => hangup.mutate()}
          >
            <PhoneOff className="mr-1 h-4 w-4" /> End
          </Button>
        </div>
      </div>

      {usage.data?.exceeded && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Robbie intelligence paused — monthly budget reached. Realtime signals still active.
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[40%_35%_25%]">
        {/* Left: transcript */}
        <div className="flex min-h-0 flex-col border-r border-border">
          <div className="flex items-center gap-2 border-b border-border p-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="h-8 pl-7 text-xs"
                placeholder="Search transcript…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'assistant', 'customer'] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={speakerFilter === f ? 'default' : 'outline'}
                  className="h-8 px-2 text-[11px] capitalize"
                  onClick={() => setSpeakerFilter(f)}
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {filteredTranscript.length === 0 && (
              <p className="text-xs text-muted-foreground">No transcript yet.</p>
            )}
            {filteredTranscript.map((chunk) => (
              <div key={chunk.seq} className="flex gap-2">
                <span className={`mt-1 h-full w-1 shrink-0 rounded ${confidenceColor(chunk.telnyx_confidence)}`} />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {chunk.speaker}
                    {chunk.telnyx_confidence != null && ` · ${Math.round(chunk.telnyx_confidence * 100)}%`}
                  </div>
                  <p className="text-sm">{chunk.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Middle: co-pilot */}
        <div className="min-h-0 overflow-y-auto border-r border-border p-3">
          <CoPilotPanel
            realtime={live.realtime}
            insights={insights ?? null}
            onTransfer={() => transfer.mutate('cockpit_transfer')}
            onTakeover={() => transfer.mutate('cockpit_takeover')}
          />
        </div>

        {/* Right: memory */}
        <div className="min-h-0 overflow-y-auto p-3">
          <MemoryDrawer callId={callId} streamMemory={live.memory} call={call.data ?? null} />
        </div>
      </div>
    </div>
  );
}
