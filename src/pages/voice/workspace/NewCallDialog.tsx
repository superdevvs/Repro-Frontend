import { ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Loader2, Phone, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getVoiceDirectory, getVoiceHealth, getVoiceNumbers, placeVoiceCall } from '@/services/voice';
import { usePermissions } from '@/context/PermissionsContext';
import { useBrowserPhone } from '@/context/BrowserPhoneContext';
import { CallsPagination } from './CallsPagination';
import { useCallSearch } from './useCallSearch';
import { directoryRoles, directoryRoleLabel, nameInitials, validCallPhone } from './directoryDisplay';
import { CallsAvatar } from './bits';

interface NewCallDialogProps {
  trigger?: ReactNode;
  initialTo?: string;
  initialFrom?: string;
  initialReason?: string;
  initialCaller?: 'me' | 'robbie';
}

export default function NewCallDialog({ trigger, initialTo = '', initialFrom = '', initialReason = '', initialCaller = 'me' }: NewCallDialogProps) {
  const cache = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { can } = usePermissions();
  const canOperate = can('voice-calls', 'operate');
  const phone = useBrowserPhone();
  const initializedOpen = useRef(false);
  const [open, setOpen] = useState(false);
  const [caller, setCaller] = useState(initialCaller);
  const [to, setTo] = useState(initialTo);
  const [from, setFrom] = useState(initialFrom);
  const [reason, setReason] = useState(initialReason);
  const [search, setSearch] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [role, setRole] = useState('all');
  const [page, setPage] = useState(1);
  const [options, setOptions] = useState(false);
  const query = useCallSearch(search);
  const numbers = useQuery({ queryKey: ['voice-numbers'], queryFn: getVoiceNumbers, enabled: open });
  const health = useQuery({ queryKey: ['voice-health'], queryFn: getVoiceHealth, enabled: open && caller === 'robbie' });
  const directory = useQuery({ queryKey: ['voice-directory', query, role, page, 6], queryFn: () => getVoiceDirectory({ q: query, role, page, per_page: 6 }), enabled: open && canOperate });
  const defaultFrom = numbers.data?.find((item) => item.is_default)?.phone_number || numbers.data?.[0]?.phone_number || initialFrom;
  useEffect(() => {
    if (!open) { initializedOpen.current = false; return; }
    if (initializedOpen.current) return;
    initializedOpen.current = true;
    setTo(initialTo); setFrom(initialFrom || defaultFrom || ''); setReason(initialReason); setSearch(''); setSelectedName(''); setCaller(initialCaller); setRole('all'); setPage(1); setOptions(false);
  }, [open, initialTo, initialFrom, initialReason, defaultFrom, initialCaller]);
  useEffect(() => { if (open && defaultFrom) setFrom((value) => value || defaultFrom); }, [open, defaultFrom]);
  const normalizedTo = to.replace(/[\s().-]/g, '');
  const normalizedFrom = from.replace(/[\s().-]/g, '');
  const validTo = /^\+[1-9]\d{7,14}$/.test(normalizedTo);
  const validFrom = validCallPhone(normalizedFrom) && Boolean(numbers.data?.some((item) => item.phone_number.replace(/[\s().-]/g, '') === normalizedFrom));
  const line = numbers.data?.find((item) => item.phone_number === from);
  const ready = canOperate && validTo && validFrom && !numbers.isError && (caller === 'me' ? !phone.active && !phone.busy && phone.config?.ready && phone.config?.capabilities.human_outbound : health.data?.can_place_calls && !health.isError);
  const call = useMutation({
    mutationFn: async () => {
      if (!ready) throw new Error('Choose a number and an available business line.');
      return caller === 'me' ? phone.startHuman({ to: normalizedTo, from: normalizedFrom, reason: reason.trim() || undefined }) : placeVoiceCall({ to: normalizedTo, from: normalizedFrom, assistant_mode: 'robbie_ai', source: 'new_call_dialog', dynamic_variables: { reason: reason.trim() || 'New call from Calls workspace', source: 'calls_workspace_new_call' } });
    },
    onSuccess: (created) => { void cache.invalidateQueries({ queryKey: ['voice-calls'] }); setOpen(false); navigate(`/calls/live/${created.id}`); },
    onError: (error) => toast({ title: 'Unable to start the call', description: error instanceof Error ? error.message : 'Check calling readiness.', variant: 'destructive' }),
  });
  const close = (next: boolean) => { if (call.isPending) return; if (!next || canOperate) setOpen(next); };
  return <Dialog open={open} onOpenChange={close}>
    {trigger && <DialogTrigger asChild disabled={!canOperate}>{trigger}</DialogTrigger>}
    <DialogContent className="calls-workspace sm:max-w-[600px]">
      <DialogHeader><DialogTitle>{caller === 'me' ? 'Call someone' : 'Ask Robbie to call'}</DialogTitle><DialogDescription>{caller === 'me' ? 'Call from your business line. Your personal number stays private.' : 'Robbie will speak on this call. Review the number and reason first.'}</DialogDescription></DialogHeader>
      <fieldset disabled={call.isPending} className="min-w-0 space-y-3">
        <div className="relative"><Search className="absolute left-3 top-4 h-4 w-4 text-[var(--calls-muted)]" /><Input aria-label="Search everyone or enter a number" className="calls-search pl-10" placeholder="Search everyone or enter a number" value={search} onChange={(event) => { const value = event.target.value; setSearch(value); setPage(1); if (/^[+\d\s().-]+$/.test(value)) { setTo(value); setSelectedName(''); } }} /></div>
        <div className="calls-filter-row" aria-label="Directory roles">{directoryRoles.slice(0, 4).map(([value, label]) => <button key={value} type="button" className="calls-filter" data-active={role === value} aria-pressed={role === value} onClick={() => { setRole(value); setPage(1); }}>{label}</button>)}</div>
        <div className="max-h-[25dvh] min-h-12 space-y-2 overflow-y-auto p-0.5" aria-label="Call directory">
          {directory.isLoading && <p role="status" className="p-3 text-sm text-[var(--calls-muted)]">Loading people…</p>}
          {directory.isError && <div role="alert" className="text-sm text-[var(--calls-danger)]">Could not load people. Enter a number below or <button type="button" className="underline" onClick={() => void directory.refetch()}>try again</button>.</div>}
          {directory.data?.data.map((person) => <button key={person.id} type="button" disabled={!person.callable} className="calls-panel calls-item flex w-full items-center gap-3 p-3 text-left disabled:opacity-50" data-selected={to === person.phone} onClick={() => { setTo(person.phone || ''); setSelectedName(person.name); }}><CallsAvatar initials={nameInitials(person.name)} size={36} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{person.name}</span><span className="block truncate text-xs text-[var(--calls-muted)]">{directoryRoleLabel(person.role)} · {person.phone || 'No phone number'}</span></span></button>)}
          {directory.data?.data.length === 0 && <p className="p-2 text-sm text-[var(--calls-muted)]">No matches. You can enter a full phone number below.</p>}
        </div>
        {(directory.data?.last_page || 1) > 1 && <CallsPagination page={page} pages={directory.data?.last_page} total={directory.data?.total} count={directory.data?.data.length} perPage={6} pending={directory.isFetching} onChange={setPage} label="Contacts" />}
        <div><Label htmlFor="new-call-to">{selectedName || 'Phone number'}</Label><Input id="new-call-to" type="tel" inputMode="tel" value={to} onChange={(event) => { setTo(event.target.value); setSelectedName(''); }} placeholder="+1 (202) 555-0124" />{to && !validTo && <p className="mt-1 text-xs text-[var(--calls-warning)]">Include the country code, starting with +.</p>}</div>
        <p className="text-sm">Calling as {caller === 'me' ? 'you' : 'Robbie'} · {line?.label || from || 'Choose a business line'}</p>
        {!numbers.isLoading && !numbers.isError && numbers.data?.length && !validFrom ? <p role="alert" className="text-xs text-[var(--calls-warning)]">Select an available business line in options.</p> : null}
        {caller === 'me' && <div className="rounded-xl bg-[var(--calls-brand-soft)] p-3 text-sm"><p>{phone.active ? 'Finish your current call first.' : phone.status === 'ready' ? 'This browser · microphone ready' : 'First call on this device?'}</p><p className="mt-1 text-xs text-[var(--calls-muted)]">{phone.config?.blockers?.[0] || 'Call asks for microphone access only when needed.'}</p></div>}
        {caller === 'robbie' && <div><Label htmlFor="new-call-reason">What should Robbie say?</Label><Textarea id="new-call-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the purpose of this call…" />{health.data && !health.data.can_place_calls && <p role="alert" className="text-xs text-[var(--calls-warning)]">{health.data.readiness_blockers?.join(' ') || 'Robbie calling is unavailable.'}</p>}</div>}
        <button type="button" className="flex min-h-11 items-center gap-2 text-sm text-[var(--calls-muted)]" onClick={() => setOptions(!options)} aria-expanded={options}><ChevronDown className="h-4 w-4" />Business line & options</button>
        {options && <div className="space-y-3 rounded-xl border border-[var(--calls-border)] p-3"><Label htmlFor="new-call-from">Business line</Label><select id="new-call-from" className="h-11 w-full rounded-lg border bg-[var(--calls-surface)] px-3 text-sm" value={from} onChange={(event) => setFrom(event.target.value)}><option value="">Choose a line</option>{numbers.data?.map((item) => <option key={item.id} value={item.phone_number} disabled={!validCallPhone(item.phone_number)}>{item.label || 'Line'} · {item.phone_number}{!validCallPhone(item.phone_number) ? ' · Unavailable for calling' : ''}</option>)}</select>{caller === 'me' && <><Label htmlFor="human-call-reason">Private reason (optional)</Label><Input id="human-call-reason" value={reason} onChange={(event) => setReason(event.target.value)} /></>}</div>}
        {numbers.isError && <p role="alert" className="text-sm text-[var(--calls-danger)]">Could not load business lines. <button type="button" className="underline" onClick={() => void numbers.refetch()}>Try again</button></p>}
        {!numbers.isLoading && !numbers.isError && !numbers.data?.length && <p role="alert" className="text-sm text-[var(--calls-warning)]">Add a business line in Calls settings first.</p>}
        {call.isError && <p role="alert" className="text-sm text-[var(--calls-danger)]">{call.error instanceof Error ? call.error.message : 'Could not start call.'}</p>}
      </fieldset>
      <DialogFooter className="flex-col gap-2 sm:flex-col"><Button className="calls-call h-12 w-full rounded-xl" disabled={!ready || call.isPending} onClick={() => call.mutate()}>{call.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}{call.isPending ? 'Connecting…' : caller === 'me' ? `Call ${selectedName.split(' ')[0] || (validTo ? normalizedTo : 'now')}` : 'Start Robbie call'}</Button>{call.isPending && caller === 'me' ? <Button variant="outline" className="h-11" onClick={() => void phone.cancelPending()}>Cancel connection</Button> : <button type="button" className="min-h-11 text-sm text-[var(--calls-brand)]" onClick={() => setCaller((value) => value === 'me' ? 'robbie' : 'me')}>{caller === 'me' ? 'Ask Robbie to call instead' : 'Make this call myself'}</button>}</DialogFooter>
    </DialogContent>
  </Dialog>;
}
