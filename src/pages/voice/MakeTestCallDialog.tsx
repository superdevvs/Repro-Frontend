import { ReactNode, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PhoneOutgoing, Send } from 'lucide-react';
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
import { placeVoiceCall } from '@/services/voice';

interface MakeTestCallDialogProps {
  trigger?: ReactNode;
}

export default function MakeTestCallDialog({ trigger }: MakeTestCallDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [from, setFrom] = useState('');
  const [reason, setReason] = useState('Dashboard test call');

  const call = useMutation({
    mutationFn: () =>
      placeVoiceCall({
        to: to.trim(),
        from: from.trim() || undefined,
        dynamic_variables: {
          reason: reason.trim() || 'Dashboard test call',
          source: 'calls_dashboard_test_call',
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-calls'] });
      queryClient.invalidateQueries({ queryKey: ['voice-stats'] });
      toast({ title: 'Test call started', description: 'The outbound call was sent to Telnyx.' });
      setTo('');
      setFrom('');
      setReason('Dashboard test call');
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Unable to start test call',
        description: error instanceof Error ? error.message : 'Please check the number and Telnyx settings.',
        variant: 'destructive',
      });
    },
  });

  const canSubmit = to.trim().length > 0 && !call.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneOutgoing className="h-4 w-4 text-blue-600" /> Make Test Call
          </DialogTitle>
          <DialogDescription>Place an immediate outbound AI voice call through Telnyx.</DialogDescription>
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
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => call.mutate()} disabled={!canSubmit}>
            <Send className="mr-2 h-4 w-4" /> {call.isPending ? 'Calling...' : 'Start call'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
