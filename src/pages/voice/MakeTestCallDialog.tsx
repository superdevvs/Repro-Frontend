import { ReactNode, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, PhoneOutgoing, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getScheduleState, getVoiceHealth, placeVoiceCall } from '@/services/voice';

interface MakeTestCallDialogProps {
  trigger?: ReactNode;
  initialTo?: string;
  initialFrom?: string;
  initialContext?: string;
}

export default function MakeTestCallDialog({ trigger, initialTo = '', initialFrom = '', initialContext = 'Dashboard test call' }: MakeTestCallDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(initialTo);
  const [from, setFrom] = useState(initialFrom);
  const [reason, setReason] = useState(initialContext);

  const schedule = useQuery({
    queryKey: ['voice-schedule-state'],
    queryFn: () => getScheduleState(),
    enabled: open,
  });
  const health = useQuery({
    queryKey: ['voice-health'],
    queryFn: getVoiceHealth,
    enabled: open,
  });
  const scheduleState = schedule.data?.state?.state;
  const inQuietOrClosed =
    scheduleState === 'quiet_hours' || scheduleState === 'holiday_closed' || scheduleState === 'override_closed';

  useEffect(() => {
    if (open) {
      setTo(initialTo);
      setFrom(initialFrom);
      setReason(initialContext);
    }
  }, [initialContext, initialFrom, initialTo, open]);

  const call = useMutation({
    mutationFn: () =>
      placeVoiceCall({
        to: to.trim(),
        from: from.trim() || undefined,
        assistant_mode: 'robbie_ai',
        source: 'test_call_dialog',
        dynamic_variables: {
          reason: reason.trim() || 'Dashboard test call',
          source: 'calls_dashboard_test_call',
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-calls'] });
      queryClient.invalidateQueries({ queryKey: ['voice-stats'] });
      toast({ title: 'Test call started', description: 'The outbound AI call was sent through direct Telnyx Call Control.' });
      setTo(initialTo);
      setFrom(initialFrom);
      setReason(initialContext);
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Unable to start test call',
        description: error instanceof Error ? error.message : 'Please check the canary allowlist and Telnyx voice readiness.',
        variant: 'destructive',
      });
    },
  });

  const canSubmit = to.trim().length > 0 && !call.isPending && health.data?.can_place_calls === true;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneOutgoing className="h-4 w-4 text-blue-600" /> Make Test Call
          </DialogTitle>
          <DialogDescription>Place an immediate outbound Robbie AI call through direct Telnyx Call Control.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="test-call-to">Target phone</Label>
            <Input
              id="test-call-to"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="+12025550123"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="test-call-from">From phone</Label>
            <Input
              id="test-call-from"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              placeholder="Default Telnyx number"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="test-call-reason">Call context</Label>
            <Textarea
              id="test-call-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          {inQuietOrClosed && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Heads up: the schedule is currently <strong>{scheduleState?.replace(/_/g, ' ')}</strong>
                {schedule.data?.state?.label ? ` (${schedule.data.state.label})` : ''}. You may be dialing into
                quiet hours.
              </span>
            </div>
          )}
          {health.data && !health.data.can_place_calls && (
            <div className="flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Calling is blocked: {health.data.readiness_blockers.join(' ')}
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => call.mutate()} disabled={!canSubmit}>
            <Send className="mr-2 h-4 w-4" /> {call.isPending ? 'Calling...' : 'Start AI call'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
