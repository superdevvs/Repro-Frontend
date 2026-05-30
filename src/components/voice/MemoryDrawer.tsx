import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Layers, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { loadVoiceCallFullContext } from '@/services/voice';
import type { MemorySnapshot } from '@/hooks/useCallLiveStream';
import type { VoiceCall } from '@/types/voice';

interface MemoryDrawerProps {
  callId: number;
  streamMemory: MemorySnapshot;
  call: VoiceCall | null;
}

const REASON_LABEL: Record<string, string> = {
  repeat_caller: 'Repeat caller',
  open_invoice: 'Open invoice',
  recent_complaint: 'Recent complaint',
  vip_flag: 'VIP',
  operator_request: 'Operator request',
};

function ReasonChips({ reasons }: { reasons?: unknown }) {
  const list = Array.isArray(reasons) ? (reasons as string[]) : [];
  if (list.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 pt-1">
      {list.map((r) => (
        <Badge key={r} variant="secondary" className="text-[10px]">
          {REASON_LABEL[r] ?? r}
        </Badge>
      ))}
    </div>
  );
}

export default function MemoryDrawer({ callId, streamMemory, call }: MemoryDrawerProps) {
  const [tier3, setTier3] = useState<Record<string, unknown> | null>(null);

  const loadFull = useMutation({
    mutationFn: () => loadVoiceCallFullContext(callId),
    onSuccess: (data) => setTier3((data.all?.tier3 as Record<string, unknown>) ?? data.memory),
  });

  const tier1 = (streamMemory.tier1 ?? {}) as Record<string, any>;
  const tier2 = (streamMemory.tier2 ?? null) as Record<string, any> | null;
  const tier3Resolved = tier3 ?? (streamMemory.tier3 as Record<string, any> | null);

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Layers className="h-4 w-4 text-primary" /> Memory
      </h3>

      {/* Tier 1 instant chips */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Tier 1 · Instant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex flex-wrap gap-2">
            {tier1.caller_name && <Badge variant="outline">{tier1.caller_name}</Badge>}
            {tier1.phone_e164 && <Badge variant="outline">{tier1.phone_e164}</Badge>}
            {typeof tier1.identified === 'boolean' && (
              <Badge variant="outline">{tier1.identified ? 'Known caller' : 'Unknown'}</Badge>
            )}
          </div>
          {Array.isArray(tier1.recent_calls) && tier1.recent_calls.length > 0 && (
            <div>
              <div className="font-medium">Recent calls</div>
              {tier1.recent_calls.slice(0, 3).map((c: any, i: number) => (
                <div key={i} className="text-muted-foreground">
                  {c.date} · {c.intent ?? '—'} · {c.disposition ?? '—'}
                </div>
              ))}
            </div>
          )}
          {tier1.unpaid_invoices && (tier1.unpaid_invoices.count ?? 0) > 0 && (
            <div className="text-muted-foreground">
              Unpaid: {tier1.unpaid_invoices.count} (${tier1.unpaid_invoices.total})
            </div>
          )}
          {tier1.active_issue && (
            <div className="text-amber-600">Active issue: {tier1.active_issue.reason ?? 'open'}</div>
          )}
        </CardContent>
      </Card>

      {/* Tier 2 when loaded */}
      {tier2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Tier 2 · Behavioral</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <div className="text-muted-foreground">Unresolved complaints: {tier2.unresolved_complaints ?? 0}</div>
            <div className="text-muted-foreground">Prior callbacks: {tier2.prior_callbacks ?? 0}</div>
            {Array.isArray(tier2.recent_escalations) && tier2.recent_escalations.length > 0 && (
              <div>Recent escalations: {tier2.recent_escalations.length}</div>
            )}
            <ReasonChips reasons={tier2.reasons} />
          </CardContent>
        </Card>
      )}

      {/* Tier 3 collapsible */}
      {tier3Resolved ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Tier 3 · Full 360</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <div className="text-muted-foreground">Lifetime spend: ${tier3Resolved.lifetime_spend_usd ?? 0}</div>
            <div className="text-muted-foreground">Total shoots: {tier3Resolved.total_shoots ?? 0}</div>
            <ReasonChips reasons={tier3Resolved.reasons} />
          </CardContent>
        </Card>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={loadFull.isPending}
          onClick={() => loadFull.mutate()}
        >
          {loadFull.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Load full context
        </Button>
      )}

      {/* Quick links */}
      <div className="flex flex-col gap-1 text-xs">
        {call?.related_shoot ? <span className="text-muted-foreground">Related shoot linked</span> : null}
        <span className="text-muted-foreground">Caller: {call?.from_phone ?? '—'}</span>
      </div>
    </div>
  );
}
