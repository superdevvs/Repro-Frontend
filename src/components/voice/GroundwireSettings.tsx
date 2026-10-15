import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Smartphone, RefreshCw, Eye, EyeOff, Trash2 } from 'lucide-react';
import GroundwireSmsSettings from './GroundwireSmsSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { usePermissions } from '@/context/PermissionsContext';
import { useToast } from '@/hooks/use-toast';
import { createSipDevice, getSipDevices, revealSipCredentials, revokeSipDevice, updateSipDevice, type SipCredentials } from '@/services/voiceSip';

export default function GroundwireSettings() {
  const { can } = usePermissions();
  const operate = can('voice-calls', 'operate');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const query = useQuery({ queryKey: ['voice-sip-devices'], queryFn: getSipDevices, enabled: operate });
  const [label, setLabel] = useState('My Groundwire phone');
  const [callerId, setCallerId] = useState('');
  const [credentials, setCredentials] = useState<SipCredentials | null>(null);
  const creationKey = useRef<string | null>(null);
  useEffect(() => {
    if (credentials) { const timer = window.setTimeout(() => setCredentials(null), 120000); return () => window.clearTimeout(timer); }
  }, [credentials]);
  const action = useMutation({
    mutationFn: async (kind: 'create' | 'reveal' | 'revoke' | 'toggle' | 'caller') => {
      const device = query.data?.devices[0];
      if (kind === 'create') {
        creationKey.current ??= crypto.randomUUID();
        await createSipDevice(device ? {label: device.label, caller_id: device.caller_id, creation_key: device.creation_key} : {label, caller_id: callerId || query.data?.lines[0]?.number || '', creation_key: creationKey.current});
        creationKey.current = null;
      } else if (device && kind === 'reveal') setCredentials(await revealSipCredentials(device.id));
      else if (device && kind === 'revoke') { await revokeSipDevice(device.id); setCredentials(null); }
      else if (device && kind === 'toggle') await updateSipDevice(device.id, {enabled: !device.enabled});
      else if (device && kind === 'caller') { await updateSipDevice(device.id, {caller_id: callerId}); setCredentials(null); }
    },
    onSuccess: () => { void queryClient.invalidateQueries({queryKey: ['voice-sip-devices']}); void queryClient.invalidateQueries({queryKey: ['voice-numbers']}); },
    onError: (error) => { void queryClient.invalidateQueries({queryKey: ['voice-sip-devices']}); toast({title: 'Groundwire setup needs attention', description: error instanceof Error ? error.message : 'Retry the same operation.', variant: 'destructive'}); },
  });
  if (!operate) return null;
  const state = query.data;
  const device = state?.devices[0];
  return <section className="calls-panel space-y-4 p-4 sm:p-5" aria-labelledby="groundwire-heading">
    <div className="flex items-start justify-between gap-3"><div><h3 id="groundwire-heading" className="flex items-center gap-2 text-base font-semibold"><Smartphone className="h-4 w-4" />Groundwire mobile phone</h3><p className="mt-1 text-sm text-muted-foreground">Answer your assigned lines on your phone. Dashboard hours and voicemail still apply.</p></div><Button size="icon" variant="ghost" aria-label="Refresh Groundwire registration" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className="h-4 w-4" /></Button></div>
    {query.isError ? <p className="text-sm text-destructive">Could not load your Groundwire device. Refresh to retry.</p> : !state ? <p className="text-sm text-muted-foreground">Loading your phone settings…</p> : !state.configured ? <p className="text-sm text-muted-foreground">The business voice connection needs configuration.</p> : <>
      <div className="flex flex-wrap gap-2">{state.lines.filter(line => line.receives_calls).map(line => <span className="rounded-lg bg-muted px-3 py-2 text-xs" key={line.number}>{line.label} · {line.number}<span className="block text-muted-foreground">{line.timezone}</span></span>)}</div>
      {device ? <>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><p className="text-sm font-medium">{device.label}</p><p className="text-xs text-muted-foreground">{device.state !== 'ready' ? 'Provider setup pending · retry with the same details' : !device.enabled ? 'Paused' : device.registered ? 'Registered with Telnyx' : 'Waiting for app registration'}</p></div><label className="flex items-center gap-2 text-xs">Phone enabled<Switch checked={device.enabled} disabled={action.isPending || device.state !== 'ready'} onCheckedChange={() => action.mutate('toggle')} /></label></div>
        <label className="block space-y-1 text-sm">Outgoing caller ID<select className="h-10 w-full rounded-md border bg-background px-3" value={callerId || device.caller_id} onChange={event => {setCallerId(event.target.value);}}>{state.lines.map(line => <option value={line.number} key={line.number}>{line.label} · {line.number}</option>)}</select></label>
        {callerId && callerId !== device.caller_id && <Button variant="outline" disabled={action.isPending} onClick={() => action.mutate('caller')}>Save outgoing caller ID</Button>}
        <div className="flex flex-wrap gap-2">{device.state !== 'ready' && <Button variant="outline" disabled={action.isPending} onClick={() => action.mutate('create')}>Retry same setup</Button>}<Button variant="outline" disabled={action.isPending || device.state !== 'ready' || !device.enabled} onClick={() => credentials ? setCredentials(null) : action.mutate('reveal')}>{credentials ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}{credentials ? 'Hide SIP login' : 'Show my SIP login'}</Button><Button variant="ghost" disabled={action.isPending} onClick={() => action.mutate('revoke')}><Trash2 className="mr-2 h-4 w-4" />Revoke device</Button></div>
      </> : state.lines.length ? <div className="space-y-3"><label className="block space-y-1 text-sm">Device name<Input value={label} maxLength={80} onChange={event => setLabel(event.target.value)} /></label><label className="block space-y-1 text-sm">Outgoing caller ID<select className="h-10 w-full rounded-md border bg-background px-3" value={callerId || state.lines[0].number} onChange={event => setCallerId(event.target.value)}>{state.lines.map(line => <option value={line.number} key={line.number}>{line.label} · {line.number}</option>)}</select></label><Button disabled={action.isPending || !label.trim()} onClick={() => action.mutate('create')}>Set up my Groundwire phone</Button></div> : <p className="text-sm text-muted-foreground">A business line assignment is required.</p>}
      {device && <GroundwireSmsSettings device={device} />}
      {credentials && <div className="rounded-xl border bg-muted/40 p-3 text-sm" role="region" aria-label="Private Groundwire SIP login"><p className="mb-3 text-xs text-muted-foreground">Use this login on your own phone. It hides after two minutes.</p><dl className="grid min-w-0 grid-cols-[6rem_minmax(0,1fr)] gap-2">{[['Title', credentials.title], ['Username', credentials.username], ['Password', credentials.password], ['Domain', credentials.domain], ['Port', String(credentials.port)], ['Transport', credentials.transport], ['Audio', credentials.media]].map(([key,value]) => <div key={key} className="contents"><dt className="text-muted-foreground">{key}</dt><dd className="min-w-0 select-all break-all font-mono text-xs">{value}</dd></div>)}</dl></div>}
      <details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-medium">Groundwire setup steps</summary><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground"><li>Install Acrobits Groundwire from your phone’s App Store or Google Play.</li><li>Settings → Accounts → Add account → Generic SIP. Copy your private SIP login above; it is different from your Dashboard password.</li><li>Advanced settings → Transport: TLS (sip), port 5061. Secure calls → SDES: Required for incoming and outgoing audio, with G.722 / G.711 codecs and RFC 2833 DTMF.</li><li>Incoming calls → Standard for the first audio test. Then choose Push notifications for background testing. Allow notifications and microphone access.</li><li>Keep auto-answer off and call waiting off. Save, then refresh registration here.</li><li>Test while the app is open and while the phone is locked, on Wi-Fi and mobile data. Dial customers with + and country code.</li></ol><p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">Encrypted push calls need a locked-phone test before rollout. <a className="underline" href="https://faq.acrobits.net/srtp-on-acrobits-softphone-and-groundwire" target="_blank" rel="noopener noreferrer">Acrobits documents an SDES restriction for pushed calls.</a> Keep TLS and SRTP required. If push fails, pause this phone and use Dashboard calling while compatibility is resolved.</p><p className="mt-3 text-xs text-muted-foreground">The first person to answer gets the call; other devices stop ringing. A second call goes to another available recipient or voicemail. SMS can sync with Groundwire after the setup above. Saved voicemail stays in Dashboard. Support continues answering through Robbie.</p></details>
    </>}
  </section>;
}
