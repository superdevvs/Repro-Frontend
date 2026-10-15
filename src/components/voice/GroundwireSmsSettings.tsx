import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { configureSipSms, type SipDevice } from '@/services/voiceSip';

export default function GroundwireSmsSettings({ device }: { device: SipDevice }) {
  const { toast } = useToast();
  const client = useQueryClient();
  const [number, setNumber] = useState('');
  const sms = device.sms;
  const action = useMutation({
    mutationFn: (reset: boolean) => configureSipSms(device.id, { number: number || sms?.number || sms?.available_numbers[0] || '', reset_pairing: reset }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['voice-sip-devices'] }); toast({ title: 'Groundwire SMS settings saved' }); },
    onError: (error) => toast({ title: 'SMS setup needs attention', description: error instanceof Error ? error.message : 'Refresh and retry.', variant: 'destructive' }),
  });
  if (!sms) return null;
  return <div className="space-y-3 rounded-xl border p-3" aria-label="Groundwire SMS setup">
    <div><h4 className="flex items-center gap-2 text-sm font-medium"><MessageSquare className="h-4 w-4" />Business text messages</h4>
      <p className="mt-1 text-xs text-muted-foreground">Text messages sync with Dashboard. SMS works outside call hours and uses the fixed sender below.</p></div>
    {sms.available_numbers.length ? <>
      <label className="block space-y-1 text-sm">SMS business number
        <select className="h-10 w-full rounded-md border bg-background px-3" value={number || sms.number || sms.available_numbers[0]} disabled={sms.phone_connected || action.isPending} onChange={e => setNumber(e.target.value)}>
          {sms.available_numbers.map(phone => <option key={phone} value={phone}>{phone}</option>)}
        </select>
      </label>
      {(!sms.number || (number && number !== sms.number)) && <Button variant="outline" disabled={action.isPending || !device.enabled} onClick={() => action.mutate(false)}>Enable SMS for this number</Button>}
      {sms.number && <>
        <p className="text-xs text-muted-foreground">{!sms.ready ? 'Line or device access needs attention.' : !sms.phone_connected ? 'Ready for phone setup.' : !sms.push_registered ? 'Phone linked · allow notifications and restart Groundwire to register message alerts.' : 'Phone linked · message notification address registered.'}</p>
        <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted p-2"><code className="min-w-0 flex-1 select-all break-all text-xs">{sms.setup_url}</code><Button size="icon" variant="ghost" aria-label="Copy Groundwire SMS setup URL" onClick={() => { void navigator.clipboard.writeText(sms.setup_url).then(() => toast({ title: 'SMS setup URL copied' }), () => toast({ title: 'Select and copy the URL above' })); }}><Copy className="h-4 w-4" /></Button></div>
        <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>In Groundwire, edit your existing REPro SIP account → Advanced Settings → Messaging. Enable SIMPLE.</li>
          <li>Open Web Services → External Provisioning. Paste the setup URL into URL. Leave username, password and POST data empty. Save every settings screen.</li>
          <li>Close and reopen Groundwire. Allow notifications. Open Messages and send a short text using + and the recipient’s country code.</li>
          <li>Send a reply back to {sms.number}. Check that it appears in Groundwire and Dashboard; then repeat with the phone locked.</li>
        </ol>
        <p className="text-xs text-muted-foreground">Text only. Use Dashboard for attachments. Ajay and Cherisea share main-line history; coordinate replies. Existing call encryption and routing stay in place.</p>
        {sms.last_fetch_at && <p className="text-xs text-muted-foreground">Last message sync: {new Date(sms.last_fetch_at).toLocaleString()}</p>}
        {sms.phone_connected && <details><summary className="cursor-pointer text-xs text-muted-foreground">Replacing this phone or changing its SMS number</summary><p className="my-2 text-xs text-muted-foreground">Remove the old REPro account from Groundwire first. Reset pairing here, choose the new SMS number if needed, then add the account using your private SIP login and apply the setup URL. Do not reuse old conversations after changing lines.</p><Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate(true)}>Reset SMS phone pairing</Button></details>}
      </>}
    </> : <p className="text-xs text-muted-foreground">An assigned staff line with an active messaging profile is required. Robbie’s support lines are managed separately.</p>}
  </div>;
}
