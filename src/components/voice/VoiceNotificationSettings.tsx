import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Smartphone, Monitor, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePermissions } from '@/context/PermissionsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getVoicePhoneSettings, updateVoicePhoneSettings, requestVoicePhoneVerification, verifyVoicePhone, removeVoicePhone } from '@/services/voice';
import { clearLocalVoicePush, deleteVoicePushDevice, enableVoicePush, getVoicePushDelivery, getVoicePushSettings, localVoicePushIdentity, pushSupport, testVoicePushDevice, updateVoicePushPreferences, type VoicePushIdentity } from '@/services/voicePush';

export function VoiceNotificationSettings() {
  const { user, isImpersonating } = useAuth();
  const { can } = usePermissions();
  const allowed = Boolean(user && !isImpersonating && can('voice-calls', 'view') && can('voice-calls', 'operate'));
  const client = useQueryClient();
  const queryKey = ['voice-push-settings', user?.id];
  const phoneKey = ['voice-phone-settings', user?.id];
  const push = useQuery({ queryKey, queryFn: getVoicePushSettings, enabled: allowed, retry: false });
  const phone = useQuery({ queryKey: phoneKey, queryFn: getVoicePhoneSettings, enabled: allowed, retry: false });
  const [local, setLocal] = useState<VoicePushIdentity | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('My device');
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const support = pushSupport();
  const delivery = useQuery({ queryKey: ['voice-push-delivery', user?.id, deliveryId], queryFn: () => getVoicePushDelivery(deliveryId!), enabled: allowed && Boolean(deliveryId), refetchInterval: (query) => ['queued', 'retrying'].includes(query.state.data?.status ?? 'queued') ? 2000 : false });
  const thisDevice = local?.user_id === String(user?.id) && push.data?.devices.some((device) => device.id === local.id) ? local : null;
  useEffect(() => {
    let current = true;
    const refresh = () => { void localVoicePushIdentity().then((value) => { if (current) setLocal(value); }).catch(() => undefined); };
    refresh();
    navigator.serviceWorker?.addEventListener('message', refresh);
    return () => { current = false; navigator.serviceWorker?.removeEventListener('message', refresh); };
  }, [user?.id]);
  const run = async (operation: () => Promise<void>) => {
    if (!allowed || busy) return;
    setBusy(true); setError(null); setMessage(null);
    try { await operation(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update call alerts. Try again.'); }
    finally { setBusy(false); }
  };
  const refresh = () => client.invalidateQueries({ queryKey });
  if (!allowed) return null;

  return <section className="space-y-6" aria-label="Call alerts and receiving devices">
    <div className="rounded-2xl border bg-card p-5 space-y-4">
      <div className="flex items-start gap-3"><Bell className="h-5 w-5 mt-0.5" /><div><h3 className="font-semibold">Call alerts on this device</h3><p className="text-sm text-muted-foreground">See incoming calls while working in another tab or using the installed phone app. Open the alert, then choose Answer.</p></div></div>
      {push.isLoading ? <p className="text-sm">Checking notification setup…</p> : push.isError ? <p role="alert" className="text-sm text-destructive">Could not check call alert settings. <button className="underline" onClick={() => void push.refetch()}>Try again</button></p> : <>
        {push.data?.blockers.map((blocker) => <p key={blocker} className="text-sm text-amber-700 dark:text-amber-300">{blocker}</p>)}
        {!support.supported && <p className="text-sm text-muted-foreground">{support.reason}</p>}
        {typeof Notification !== 'undefined' && Notification.permission === 'denied' && <p className="text-sm text-destructive">Notifications are blocked. Allow them in this browser’s site settings.</p>}
        <div className="flex items-center justify-between gap-4"><Label htmlFor="incoming-device-alerts">Incoming call alerts on my devices</Label><Switch id="incoming-device-alerts" checked={push.data?.preferences.incoming_calls ?? false} disabled={busy || !push.data} onCheckedChange={(value) => void run(async () => { client.setQueryData(queryKey, await updateVoicePushPreferences(value)); })} /></div>
        {thisDevice ? <div className="flex flex-wrap items-center gap-2"><span className="text-sm">This device is enabled</span><Button variant="outline" disabled={busy || !push.data?.configured} onClick={() => void run(async () => { const result = await testVoicePushDevice(thisDevice.id); setDeliveryId(result.delivery_id); setMessage('Test queued. Keep this device connected and look for an OS notification.'); })}>Send test alert</Button><Button variant="ghost" disabled={busy} onClick={() => void run(async () => { await clearLocalVoicePush(); setLocal(null); await refresh(); setDeliveryId(null); })}>Turn off here</Button></div> : <div className="flex flex-col sm:flex-row sm:items-end gap-3"><div className="space-y-1.5 flex-1"><Label htmlFor="push-device-name">Device name</Label><Input id="push-device-name" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="My iPhone or office browser" /></div><Button disabled={busy || !support.supported || !push.data?.configured || !label.trim()} onClick={() => void run(async () => { if (!user || !push.data?.public_key) return; const identity = await enableVoicePush(String(user.id), push.data.public_key, label.trim()); setLocal(identity); await refresh(); setMessage('This device is registered. Send a test alert to check delivery.'); })}>Enable this device</Button></div>}
        {delivery.data && <p role="status" className="text-sm text-muted-foreground">{delivery.data.status === 'accepted' ? 'The push service accepted the test. Only seeing the notification on your device confirms delivery.' : ['queued', 'retrying'].includes(delivery.data.status) ? 'Waiting for the notification worker. Delivery is not confirmed yet.' : `Test ${delivery.data.status}. ${delivery.data.error_code === 'configuration_unavailable' ? 'Ask an administrator to check notification setup.' : 'Try enabling this device again or ask support to check the notification worker.'}`}</p>}
        {delivery.isError && <p role="alert" className="text-sm text-destructive">Could not check the test result. Refresh settings and try again.</p>}
        <p className="text-xs text-muted-foreground">Alerts depend on device permissions, connectivity, battery settings and Focus / Do Not Disturb. A notification does not reserve the call. On iPhone or iPad, install from Safari’s Share menu → Add to Home Screen and enable alerts from that app.</p>
        {Boolean(push.data?.devices.length) && <ul className="divide-y max-h-56 overflow-y-auto" aria-label="Enabled call alert devices">{push.data!.devices.map((device) => <li key={device.id} className="flex items-center justify-between py-3 gap-3"><div className="min-w-0"><p className="text-sm font-medium truncate"><Monitor className="inline h-4 w-4 mr-2" />{device.label}{device.id === thisDevice?.id ? ' (this device)' : ''}</p><p className="text-xs text-muted-foreground">{device.last_error ? 'Last push was unsuccessful' : device.last_success_at ? 'Last push accepted ' + new Date(device.last_success_at).toLocaleString() : 'No push service acceptance recorded'}</p></div><Button variant="ghost" size="icon" aria-label={`Remove ${device.label}`} disabled={busy} onClick={() => void run(async () => { if (device.id === thisDevice?.id) { await clearLocalVoicePush(); setLocal(null); } else await deleteVoicePushDevice(device.id); await refresh(); })}><Trash2 className="h-4 w-4" /></Button></li>)}</ul>}
      </>}
    </div>
    <div className="rounded-2xl border bg-card p-5 space-y-4">
      <div className="flex items-start gap-3"><Smartphone className="h-5 w-5 mt-0.5" /><div><h3 className="font-semibold">Receive calls on your phone</h3><p className="text-sm text-muted-foreground">Verify your own number to receive carrier calls. Press 1 when prompted to claim an incoming call.</p></div></div>
      {phone.isLoading ? <p className="text-sm">Loading phone settings…</p> : phone.isError ? <p role="alert" className="text-sm text-destructive">Could not load phone settings. <button className="underline" onClick={() => void phone.refetch()}>Try again</button></p> : <>
        <div className="flex items-center justify-between gap-4"><Label htmlFor="staff-available">Available for incoming calls</Label><Switch id="staff-available" checked={phone.data?.available ?? false} disabled={busy} onCheckedChange={(available) => void run(async () => { client.setQueryData(phoneKey, await updateVoicePhoneSettings({ available })); })} /></div>
        {phone.data?.phone_verified_at && <div className="space-y-3"><p className="text-sm">Verified: {phone.data.phone_number}</p><div className="flex items-center justify-between gap-4"><Label htmlFor="phone-ring-enabled">Ring my verified phone</Label><Switch id="phone-ring-enabled" checked={phone.data.phone_enabled} disabled={busy} onCheckedChange={(phone_enabled) => void run(async () => { client.setQueryData(phoneKey, await updateVoicePhoneSettings({ phone_enabled })); })} /></div><Button variant="ghost" disabled={busy} onClick={() => void run(async () => { client.setQueryData(phoneKey, await removeVoicePhone()); })}>Remove phone</Button></div>}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3"><div className="space-y-1.5 flex-1"><Label htmlFor="staff-phone-number">{phone.data?.phone_verified_at ? 'Replace phone number' : 'Phone number'}</Label><Input id="staff-phone-number" type="tel" autoComplete="tel" placeholder="+1 202 555 0123" value={number} onChange={(e) => setNumber(e.target.value)} /></div><Button variant="outline" disabled={busy || !/^\+[1-9]\d{7,14}$/.test(number.replace(/[\s().-]/g, ''))} onClick={() => void run(async () => { client.setQueryData(phoneKey, await requestVoicePhoneVerification(number.replace(/[\s().-]/g, ''))); setMessage('Verification requested. Enter the code you receive.'); })}>Send verification code</Button></div>
        {phone.data?.pending_phone && <div className="flex flex-col sm:flex-row sm:items-end gap-3"><div className="space-y-1.5 flex-1"><Label htmlFor="staff-phone-code">Code for {phone.data.pending_phone}</Label><Input id="staff-phone-code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></div><Button disabled={busy || code.length < 4} onClick={() => void run(async () => { client.setQueryData(phoneKey, await verifyVoicePhone(code)); setCode(''); setNumber(''); setMessage('Your phone is verified and enabled for incoming calls.'); })}>Verify phone</Button></div>}
      </>}
    </div>
    {message && <p role="status" className="text-sm">{message}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
