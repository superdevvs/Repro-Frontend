import { AlertTriangle, ArrowRightLeft, Lightbulb, PhoneForwarded, TrendingUp, UserCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MoodChips } from '@/components/voice/MoodChips';
import type { VoiceInsights } from '@/types/voice';
import type { RealtimeSignals } from '@/hooks/useCallLiveStream';

interface CoPilotPanelProps {
  realtime: RealtimeSignals;
  insights: VoiceInsights | null;
  onTransfer?: () => void;
  onTakeover?: () => void;
}

export default function CoPilotPanel({ realtime, insights, onTransfer, onTakeover }: CoPilotPanelProps) {
  const confidence = realtime.confidence != null ? Math.round(realtime.confidence * 100) : null;

  return (
    <div className="space-y-3">
      {/* Confidence bar */}
      <Card>
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Transcript confidence</span>
            <span>{confidence != null ? `${confidence}%` : '—'}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-muted">
            <div
              className={`h-full rounded ${
                (confidence ?? 0) >= 85 ? 'bg-emerald-500' : (confidence ?? 0) >= 70 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${confidence ?? 0}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-muted-foreground">
            <span>silence {realtime.silence_sec ?? 0}s</span>
            <span>· pace {realtime.speaking_pace_wpm ?? 0} wpm</span>
            <span>· interrupt {Math.round((realtime.interruption_rate ?? 0) * 100)}%</span>
          </div>
        </CardContent>
      </Card>

      <MoodChips
        customerMood={insights?.customer_mood}
        robbieQuality={insights?.robbie_quality}
      />

      {insights?.intent && (
        <Card>
          <CardContent className="flex items-center justify-between p-3 text-xs">
            <span className="text-muted-foreground">Intent</span>
            <span className="font-medium">
              {insights.intent}
              {insights.intent_confidence != null && (
                <span className="ml-1 text-muted-foreground">
                  ({Math.round(insights.intent_confidence * 100)}%)
                </span>
              )}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Suggested replies with why */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Lightbulb className="h-4 w-4 text-amber-500" /> Suggested replies
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(insights?.suggested_replies ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No suggestions yet.</p>
          )}
          <TooltipProvider>
            {(insights?.suggested_replies ?? []).map((reply, idx) => (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="w-full rounded-md border border-border bg-muted/30 p-2 text-left transition-colors hover:bg-muted"
                  >
                    <div className="text-xs font-medium">{reply.label}</div>
                    <div className="text-[11px] text-muted-foreground">{reply.spoken}</div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <span className="text-xs">Why: {reply.why}</span>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </CardContent>
      </Card>

      {insights?.next_best_action && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ArrowRightLeft className="h-4 w-4 text-blue-500" /> Next best action
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs">{insights.next_best_action}</CardContent>
        </Card>
      )}

      {insights?.risk && (
        <Card className="border-red-300 dark:border-red-900">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" /> Risk · {insights.risk.type}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <div>Score: {Math.round(insights.risk.score * 100)}%</div>
            <div className="text-muted-foreground">Why: {insights.risk.why}</div>
          </CardContent>
        </Card>
      )}

      {insights?.sales_opportunity ? (
        <Card className="border-emerald-300 dark:border-emerald-900">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-emerald-600">
              <TrendingUp className="h-4 w-4" /> Sales opportunity
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs">{String(insights.sales_opportunity)}</CardContent>
        </Card>
      ) : null}

      {insights?.human_takeover_recommended && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Robbie recommends a human takeover.
        </div>
      )}

      {/* Takeover buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={onTransfer}>
          <PhoneForwarded className="mr-1 h-4 w-4" /> Transfer
        </Button>
        <Button size="sm" variant="outline" onClick={onTakeover}>
          <UserCog className="mr-1 h-4 w-4" /> Take over
        </Button>
      </div>
    </div>
  );
}
