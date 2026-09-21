import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Phone } from 'lucide-react';
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
import { getSmsThreads } from '@/services/messaging';
import { getScheduleState, getVoiceHealth, getVoiceNumbers, placeVoiceCall } from '@/services/voice';
import type { SmsContact } from '@/types/messaging';
import { usePermissions } from '@/context/PermissionsContext';
import { useBrowserPhone } from '@/context/BrowserPhoneContext';
import { BrowserPhoneConnectButton } from '@/components/voice/BrowserPhoneControls';

interface NewCallDialogProps {
  trigger?: ReactNode;
  initialTo?: string;
  initialFrom?: string;
  initialReason?: string;
}

const uniqueContacts = (threads: Array<{ contact?: SmsContact | null }> = []) => {
  const seen = new Set<string>();
  return threads
    .map((thread) => thread.contact)
    .filter((contact): contact is SmsContact => Boolean(contact?.primaryNumber || contact?.numbers?.[0]?.number))
    .filter((contact) => {
      const key = String(contact.id || contact.primaryNumber);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export default function NewCallDialog({
  trigger,
  initialTo = '',
  initialFrom = '',
  initialReason = '',
}: NewCallDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { can } = usePermissions();
  const canOperate = can('voice-calls', 'operate');
  const phone = useBrowserPhone();
  const [caller, setCaller] = useState<'robbie' | 'me'>('robbie');
  const canReadContacts = can('messaging-sms', 'view');
  const initializedOpen = useRef(false);
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(initialTo);
  const [from, setFrom] = useState(initialFrom);
  const [reason, setReason] = useState(initialReason);
  const [search, setSearch] = useState('');

  const numbers = useQuery({ queryKey: ['voice-numbers'], queryFn: getVoiceNumbers, enabled: open });
  const schedule = useQuery({ queryKey: ['voice-schedule-state'], queryFn: () => getScheduleState(), enabled: open });
  const health = useQuery({ queryKey: ['voice-health'], queryFn: getVoiceHealth, enabled: open });
  const threads = useQuery({
    queryKey: ['sms-threads', 'new-call', search],
    queryFn: () => getSmsThreads({ per_page: 8, search: search || undefined }),
    enabled: open && canReadContacts,
  });

  const contacts = useMemo(() => uniqueContacts(threads.data?.data), [threads.data?.data]);
  const defaultFrom = numbers.data?.find((item) => item.is_default)?.phone_number || numbers.data?.[0]?.phone_number || initialFrom;
  const scheduleState = schedule.data?.state?.state;
  const closed = scheduleState === 'quiet_hours' || scheduleState === 'holiday_closed' || scheduleState === 'override_closed';

  useEffect(() => {
    if (!open) { initializedOpen.current = false; return; }
    if (initializedOpen.current) return;
    initializedOpen.current = true;
    setTo(initialTo);
    setFrom(initialFrom || defaultFrom || '');
    setReason(initialReason);
    setSearch('');
    setCaller('robbie');
  }, [defaultFrom, initialFrom, initialReason, initialTo, open]);

  useEffect(() => {
    if (open && defaultFrom) setFrom((current) => current || defaultFrom);
  }, [open, defaultFrom]);

  const normalizedTo = to.replace(/[\s().-]/g, '');
  const normalizedFrom = from.replace(/[\s().-]/g, '');
  const validDestination = /^\+[1-9]\d{7,14}$/.test(normalizedTo);
  const validFrom = /^\+[1-9]\d{7,14}$/.test(normalizedFrom) && Boolean(numbers.data?.some((item) => item.phone_number.replace(/[\s().-]/g, '') === normalizedFrom));
  const lineReady = canOperate && validDestination && validFrom && !numbers.isError && !numbers.isFetching;
  const ready = lineReady && (caller === 'me'
    ? phone.config?.capabilities.human_outbound && phone.status === 'ready' && phone.session?.registered && !phone.active && !phone.busy
    : !health.isError && !health.isFetching && health.data?.can_place_calls === true);

  const call = useMutation({
    mutationFn: () => {
      if (!ready) return Promise.reject(new Error('Check the destination, business line, and calling readiness.'));
      if (caller === 'me') return phone.startHuman({ to: normalizedTo, from: normalizedFrom, reason: reason.trim() || undefined });
      return placeVoiceCall({
        to: normalizedTo,
        from: normalizedFrom,
        assistant_mode: 'robbie_ai',
        source: 'new_call_dialog',
        dynamic_variables: {
          reason: reason.trim() || 'New call from Calls workspace',
          source: 'calls_workspace_new_call',
        },
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['voice-calls'] });
      queryClient.invalidateQueries({ queryKey: ['voice-stats'] });
      toast({ title: caller === 'me' ? 'Answer your browser phone' : 'Call started', description: caller === 'me' ? 'The customer is dialed after you answer.' : `Robbie is connecting to ${to.trim()}.` });
      setOpen(false);
      if (created?.id) navigate(`/calls/live/${created.id}`);
    },
    onError: (error) => {
      toast({
        title: 'Unable to start the call',
        description: error instanceof Error ? error.message : 'Check the number and voice readiness.',
        variant: 'destructive',
      });
    },
  });

  const canCall = ready && !call.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next || canOperate) setOpen(next); }}>
      {trigger ? <DialogTrigger asChild disabled={!canOperate}>{trigger}</DialogTrigger> : null}
      <DialogContent className="calls-workspace sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start a new call</DialogTitle>
          <DialogDescription>
            Choose who speaks using your business line. Follow the conversation from the live view.
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={!canOperate || call.isPending} className="min-w-0 space-y-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">Who’s calling?</p>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Who is calling">
              <Button type="button" variant="outline" className={caller === 'robbie' ? 'calls-primary h-11' : 'calls-secondary h-11'} aria-pressed={caller === 'robbie'} onClick={() => setCaller('robbie')}>Robbie AI</Button>
              <Button type="button" variant="outline" className={caller === 'me' ? 'calls-primary h-11' : 'calls-secondary h-11'} aria-pressed={caller === 'me'} onClick={() => setCaller('me')}>Me · browser phone</Button>
            </div>
            {caller === 'me' && <div className="space-y-2 rounded-lg bg-[var(--calls-subtle)] p-3">
              <p className="text-xs text-[var(--calls-muted)]">{phone.active ? 'Finish your current call first.' : phone.status === 'ready' ? 'Your phone is connected. Answer it to dial the customer.' : phone.config?.blockers?.[0] || 'Connect your microphone to make this call from your browser.'}</p>
              <BrowserPhoneConnectButton />
              {phone.error && <p role="alert" className="text-xs text-[var(--calls-danger)]">{phone.error}</p>}
            </div>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-call-search">Find someone</Label>
            <Input
              id="new-call-search"
              disabled={!canReadContacts}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, number, property or phrase"
            />
            {!canReadContacts && <p className="text-xs text-[var(--calls-muted)]">Enter a number below. SMS access is required to search contacts.</p>}
          </div>
          {contacts.length > 0 && (
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-[var(--calls-border)] p-1">
              {contacts.map((contact) => {
                const phone = contact.primaryNumber || contact.numbers?.[0]?.number || '';
                return (
                  <button
                    key={contact.id || phone}
                    type="button"
                    onClick={() => setTo(phone)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--calls-subtle)]"
                  >
                    <span className="truncate">{contact.name || phone}</span>
                    <span className="ml-2 shrink-0 text-[var(--calls-muted)]">{phone}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="new-call-to">Number</Label>
              <Input id="new-call-to" type="tel" inputMode="tel" autoComplete="tel" value={to} onChange={(event) => setTo(event.target.value)} placeholder="+1 (202) 555-0124" />
              {to.trim() && !validDestination && <p className="text-xs text-[var(--calls-warning)]">Enter a full phone number with country code, starting with +.</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-call-from">From</Label>
              <select
                id="new-call-from"
                value={validFrom ? from : ''}
                onChange={(event) => setFrom(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="" disabled>Choose a business line</option>
                {(numbers.data ?? []).map((item) => {
                  const available = /^\+[1-9]\d{7,14}$/.test(item.phone_number.replace(/[\s().-]/g, ''));
                  return <option key={item.id} value={item.phone_number} disabled={!available}>
                    {item.label || 'Line'} · {item.phone_number}{!available ? ' · Unavailable for calling' : ''}
                  </option>;
                })}
              </select>
              {!numbers.isLoading && !numbers.isError && !validFrom && <p className="text-xs text-[var(--calls-warning)]">Select an available business line.</p>}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-call-reason">Why you’re calling</Label>
            <Textarea
              id="new-call-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Property access, booking follow-up, reschedule…"
              className="min-h-20"
            />
          </div>
          {closed && (
            <p className="text-sm text-[var(--calls-warning)]">
              Coverage is closed right now. The call can still be placed if you need an exception.
            </p>
          )}
          {((caller === 'robbie' && health.isError) || numbers.isError) && <div role="alert" className="space-y-2 text-sm text-[var(--calls-danger)]">
            <p>Could not check calling readiness or load your lines.</p>
            <Button type="button" variant="outline" onClick={() => { void health.refetch(); void numbers.refetch(); }}>Try again</Button>
          </div>}
          {caller === 'robbie' && health.data && !health.data.can_place_calls && (
            <p className="text-sm text-[var(--calls-warning)]">{health.data.readiness_blockers[0] || 'Outbound calling is not ready.'}</p>
          )}
        </fieldset>
        <DialogFooter>
          <Button type="button" variant="outline" className="calls-secondary h-11 rounded-lg" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" className="calls-primary h-11 rounded-lg" disabled={!canCall} onClick={() => call.mutate()}>
            <Phone className="h-4 w-4" />
            {call.isPending ? 'Starting…' : 'Start call'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
