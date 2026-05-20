import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Save } from 'lucide-react';
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
import { createScheduledVoiceCall } from '@/services/voice';

interface ScheduleVoiceCallDialogProps {
  trigger?: ReactNode;
  initialTargetPhone?: string;
  initialFromPhone?: string;
  initialReason?: string;
  initialScheduledAt?: string;
}

const localDateTime = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function ScheduleVoiceCallDialog({
  trigger,
  initialTargetPhone = '',
  initialFromPhone = '',
  initialReason = 'manual_callback',
  initialScheduledAt,
}: ScheduleVoiceCallDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const defaultTime = useMemo(() => localDateTime(new Date(Date.now() + 60 * 60 * 1000)), []);
  const [open, setOpen] = useState(false);
  const [targetPhone, setTargetPhone] = useState(initialTargetPhone);
  const [fromPhone, setFromPhone] = useState(initialFromPhone);
  const [reason, setReason] = useState(initialReason);
  const [scheduledAt, setScheduledAt] = useState(initialScheduledAt ?? defaultTime);
  const [maxAttempts, setMaxAttempts] = useState(3);

  useEffect(() => {
    if (open) {
      setTargetPhone(initialTargetPhone);
      setFromPhone(initialFromPhone);
      setReason(initialReason);
      setScheduledAt(initialScheduledAt ?? defaultTime);
      setMaxAttempts(3);
    }
  }, [defaultTime, initialFromPhone, initialReason, initialScheduledAt, initialTargetPhone, open]);

  const create = useMutation({
    mutationFn: () =>
      createScheduledVoiceCall({
        target_phone: targetPhone.trim(),
        from_phone: fromPhone.trim() || undefined,
        reason: reason.trim() || 'manual_callback',
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        max_attempts: maxAttempts,
        summary: reason.trim() || 'Manual callback',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-voice-calls'] });
      queryClient.invalidateQueries({ queryKey: ['voice-calls'] });
      toast({ title: 'Callback scheduled', description: 'The call was added to the callback queue.' });
      setTargetPhone(initialTargetPhone);
      setFromPhone(initialFromPhone);
      setReason(initialReason);
      setScheduledAt(initialScheduledAt ?? defaultTime);
      setMaxAttempts(3);
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Unable to schedule callback',
        description: error instanceof Error ? error.message : 'Please check the call details and try again.',
        variant: 'destructive',
      });
    },
  });

  const canSubmit = targetPhone.trim().length > 0 && !create.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-blue-600" /> Schedule Callback
          </DialogTitle>
          <DialogDescription>Add a manual outbound follow-up to the callback queue.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="scheduled-target-phone">Target phone</Label>
            <Input
              id="scheduled-target-phone"
              value={targetPhone}
              onChange={(event) => setTargetPhone(event.target.value)}
              placeholder="+12025550123"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scheduled-from-phone">From phone</Label>
            <Input
              id="scheduled-from-phone"
              value={fromPhone}
              onChange={(event) => setFromPhone(event.target.value)}
              placeholder="Default Telnyx number"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="scheduled-at">Scheduled time</Label>
              <Input
                id="scheduled-at"
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scheduled-attempts">Max attempts</Label>
              <Input
                id="scheduled-attempts"
                type="number"
                min={1}
                max={10}
                value={maxAttempts}
                onChange={(event) => setMaxAttempts(Number(event.target.value))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scheduled-reason">Reason</Label>
            <Textarea
              id="scheduled-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="manual_callback"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => create.mutate()} disabled={!canSubmit}>
            <Save className="mr-2 h-4 w-4" /> {create.isPending ? 'Scheduling...' : 'Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
