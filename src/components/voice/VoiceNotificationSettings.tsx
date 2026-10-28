import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, ChevronRight, Monitor, Phone, Smartphone, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePermissions } from '@/context/PermissionsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DashboardInstallButton } from '@/components/dashboard/DashboardInstallButton';
import { useDashboardInstall } from '@/hooks/useDashboardInstall';
import { getVoicePhoneSettings, updateVoicePhoneSettings, requestVoicePhoneVerification, verifyVoicePhone, removeVoicePhone } from '@/services/voice';
import { clearLocalVoicePush, deleteVoicePushDevice, enableVoicePush, getVoicePushDelivery, getVoicePushSettings, localVoicePushIdentity, pushSupport, testVoicePushDevice, updateVoicePushPreferences, type VoicePushIdentity } from '@/services/voicePush';

function phoneLabel(value: string | null | undefined) {
  if (!value) return '';
  const us = value.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return us ? '+1 (' + us[1] + ') ' + us[2] + '-' + us[3] : value;
}

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
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const support = pushSupport();
  const install = useDashboardInstall();
  const delivery = useQuery({
    queryKey: ['voice-push-delivery', user?.id, deliveryId],
    queryFn: () => getVoicePushDelivery(deliveryId!),
    enabled: allowed && Boolean(deliveryId),
    refetchInterval: (query) => ['queued', 'retrying'].includes(query.state.data?.status ?? 'queued') ? 2000 : false,
  });
  const thisDevice = local?.user_id === String(user?.id) && push.data?.devices.some((device) => device.id === local.id) ? local : null;
  const currentDevice = push.data?.devices.find((device) => device.id === thisDevice?.id);
  const hasPhone = Boolean(phone.data?.phone_verified_at && phone.data.phone_number);
  const alertsOn = Boolean(thisDevice && push.data?.preferences.incoming_calls);
  const ringingOn = Boolean(hasPhone && phone.data?.phone_enabled);
  const otherDevices = push.data?.devices.filter((device) => device.id !== thisDevice?.id) ?? [];
  const DeviceIcon = install.mobile ? Smartphone : Monitor;

  useEffect(() => {
    let current = true;
    const refreshIdentity = () => {
      void localVoicePushIdentity().then((value) => { if (current) setLocal(value); }).catch(() => undefined);
    };
    refreshIdentity();
    const refreshEnrollment = () => {
      refreshIdentity();
      void client.invalidateQueries({ queryKey: ['voice-push-settings', user?.id] });
    };
    navigator.serviceWorker?.addEventListener('message', refreshIdentity);
    window.addEventListener('voice-push-changed', refreshEnrollment);
    return () => {
      current = false;
      navigator.serviceWorker?.removeEventListener('message', refreshIdentity);
      window.removeEventListener('voice-push-changed', refreshEnrollment);
    };
  }, [client, user?.id]);
  useEffect(() => { setPhoneOpen(false); setDetailsOpen(false); setNumber(''); setCode(''); setError(null); setMessage(null); }, [user?.id]);

  const run = async (operation: () => Promise<void>) => {
    if (!allowed || busy) return;
    setBusy(true); setError(null); setMessage(null);
    try { await operation(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update call alerts. Try again.'); }
    finally { setBusy(false); }
  };
  const refresh = () => client.invalidateQueries({ queryKey });
  const editPhone = () => { setError(null); setMessage(null); setNumber(''); setCode(''); setPhoneOpen(true); };
  if (!allowed) return null;

  return <section className="space-y-3" aria-label="Call alerts and receiving devices">
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
      <div className="min-w-0"><Label htmlFor="staff-available" className="font-medium">Available for incoming calls</Label><p className="mt-0.5 text-xs text-muted-foreground">Receive team calls on your enabled devices.</p></div>
      <Switch id="staff-available" checked={phone.data?.available ?? false} disabled={busy || !phone.data || phone.isError} onCheckedChange={(available) => void run(async () => { client.setQueryData(phoneKey, await updateVoicePhoneSettings({ available })); })} />
    </div>
    {phone.data?.available === false && <p role="status" className="px-1 text-xs text-muted-foreground">You are unavailable. Incoming call alerts and phone ringing are paused.</p>}

    <div className="grid items-start gap-3 xl:grid-cols-2">
      <section className="overflow-hidden rounded-xl border bg-card" aria-label="App notifications">
        <div className="flex items-start gap-3 px-4 pt-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bell className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1"><h3 className="text-base font-semibold leading-6">App notifications</h3><p className="mt-0.5 text-xs leading-5 text-muted-foreground">Tap an alert to open REPro and answer.</p></div>
          <span className={alertsOn ? 'rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300' : 'rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground'}>{alertsOn ? 'Enabled' : thisDevice ? 'Paused' : 'Off'}</span>
        </div>
        <div className="space-y-3 p-4">
          {push.isLoading ? <p className="text-sm text-muted-foreground">Checking notification setup…</p> : push.isError ? <p role="alert" className="text-sm text-destructive">Could not load alert settings. <button className="underline" onClick={() => void push.refetch()}>Retry</button></p> : <>
            {push.data?.blockers.map((blocker) => <p key={blocker} className="text-xs text-amber-700 dark:text-amber-300">{blocker}</p>)}
            {!support.supported && <div className="space-y-2"><p className="text-xs leading-5 text-muted-foreground">{install.ios && !install.installed ? 'Add REPro to your Home Screen, then open it there to enable alerts.' : support.reason}</p>{!install.installed && <DashboardInstallButton forCalls />}</div>}
            {typeof Notification !== 'undefined' && Notification.permission === 'denied' && <p className="text-xs text-destructive">Notifications are blocked. Allow them in this device’s notification settings.</p>}
            {support.supported && !install.installed && <DashboardInstallButton forCalls />}
            {thisDevice ? <>
              <div className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5"><DeviceIcon className="h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{currentDevice?.label || 'This device'}</p><p className="text-xs text-muted-foreground">This device is enabled</p></div><Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /></div>
              <div className="flex items-center justify-between gap-3"><Label htmlFor="incoming-device-alerts" className="text-sm">Incoming call notifications</Label><Switch id="incoming-device-alerts" checked={push.data?.preferences.incoming_calls ?? false} disabled={busy || !push.data} onCheckedChange={(value) => void run(async () => { client.setQueryData(queryKey, await updateVoicePushPreferences(value)); })} /></div>
              <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" className="h-9" disabled={busy || !push.data?.configured} onClick={() => void run(async () => { const result = await testVoicePushDevice(thisDevice.id); setDeliveryId(result.delivery_id); })}>Send test alert</Button><Button variant="ghost" size="sm" className="h-9" disabled={busy} onClick={() => void run(async () => { await clearLocalVoicePush(); setLocal(null); await refresh(); setDeliveryId(null); })}>Turn off here</Button></div>
            </> : support.supported && <>
              {install.installed && <p className="text-xs text-muted-foreground">Choose Enable this device and allow notifications.</p>}
              <div className="space-y-1.5"><Label htmlFor="push-device-name" className="text-xs">Device name</Label><Input id="push-device-name" className="h-10" value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} placeholder="My iPhone" /></div>
              <Button className="h-10 w-full sm:w-auto" disabled={busy || !push.data?.configured || !label.trim()} onClick={() => void run(async () => {
                if (!user || !push.data?.public_key) return;
                const identity = await enableVoicePush(String(user.id), push.data.public_key, label.trim());
                setLocal(identity); await refresh(); setMessage('This device is enabled. Send a test alert to confirm delivery.');
              })}>Enable this device</Button>
            </>}
            {delivery.data && <p role="status" className="text-xs leading-5 text-muted-foreground">{delivery.data.status === 'accepted' ? 'Test sent. Seeing the notification on your device confirms delivery.' : ['queued', 'retrying'].includes(delivery.data.status) ? 'Sending test alert…' : 'Test failed. Try enabling this device again.'}</p>}
            {delivery.isError && <p role="alert" className="text-xs text-destructive">Could not check the test result. Try again.</p>}
            {!thisDevice && push.data && <div className="flex items-center justify-between gap-3"><Label htmlFor="incoming-device-alerts" className="text-sm">Incoming call notifications</Label><Switch id="incoming-device-alerts" checked={push.data.preferences.incoming_calls} disabled={busy} onCheckedChange={(value) => void run(async () => { client.setQueryData(queryKey, await updateVoicePushPreferences(value)); })} /></div>}
          </>}
          <div className="flex items-center justify-between gap-2 border-t pt-3"><span className="text-xs text-muted-foreground">Notification sound, not a phone ringtone.</span><Button variant="ghost" size="sm" className="h-8 shrink-0 px-2 text-xs" onClick={() => setDetailsOpen(true)}>Details<ChevronRight className="ml-1 h-3 w-3" /></Button></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card" aria-label="Phone ringing">
        <div className="flex items-start gap-3 px-4 pt-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Phone className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1"><h3 className="text-base font-semibold leading-6">Phone ringing</h3><p className="mt-0.5 text-xs leading-5 text-muted-foreground">A regular call to the number below.</p></div>
          <span className={ringingOn ? 'rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300' : 'rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground'}>{ringingOn ? 'On' : 'Off'}</span>
        </div>
        <div className="space-y-3 p-4">
          {phone.isLoading ? <p className="text-sm text-muted-foreground">Loading phone settings…</p> : phone.isError ? <p role="alert" className="text-sm text-destructive">Could not load phone settings. <button className="underline" onClick={() => void phone.refetch()}>Retry</button></p> : hasPhone ? <>
            <div className="rounded-lg bg-muted/40 p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Ringing destination</p><span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300"><Check className="h-3 w-3" />Verified</span></div><p className="mt-1 break-words text-lg font-semibold tracking-tight">{phoneLabel(phone.data?.phone_number)}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Saved for this account. If this is not your number, change it.</p></div>
            <div className="flex items-center justify-between gap-3"><div className="min-w-0"><Label htmlFor="phone-ring-enabled" className="text-sm">Ring this number</Label><p id="phone-ring-destination" className="mt-0.5 text-xs text-muted-foreground">Calls {phoneLabel(phone.data?.phone_number)} only.</p></div><Switch id="phone-ring-enabled" aria-describedby="phone-ring-destination" checked={phone.data?.phone_enabled ?? false} disabled={busy} onCheckedChange={(phone_enabled) => void run(async () => { client.setQueryData(phoneKey, await updateVoicePhoneSettings({ phone_enabled })); })} /></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" className="h-9" disabled={busy} onClick={editPhone}>Change number</Button><Button variant="ghost" size="sm" className="h-9" disabled={busy} onClick={() => void run(async () => { client.setQueryData(phoneKey, await removeVoicePhone()); })}>Remove number</Button></div>
          </> : <>
            <p className="text-sm text-muted-foreground">Add your own mobile number to receive ringing calls.</p>
            <Button variant="outline" className="h-10" disabled={busy || !phone.data} onClick={editPhone}>Add phone number</Button>
          </>}
          {phone.data?.pending_phone && <Button variant="ghost" size="sm" className="h-8 px-0 text-xs" onClick={() => setPhoneOpen(true)}>Finish verifying {phoneLabel(phone.data.pending_phone)}<ChevronRight className="ml-1 h-3 w-3" /></Button>}
          <p className="border-t pt-3 text-xs leading-5 text-muted-foreground">Answer and press 1 to join. Telnyx call charges apply.</p>
        </div>
      </section>
    </div>
    {!phoneOpen && message && <p role="status" className="px-1 text-sm">{message}</p>}
    {!phoneOpen && error && <p role="alert" className="px-1 text-sm text-destructive">{error}</p>}

    <Dialog open={phoneOpen} onOpenChange={(open) => { if (!busy) setPhoneOpen(open); }}>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle>{hasPhone ? 'Change ringing number' : 'Add ringing number'}</DialogTitle><DialogDescription>Use the mobile number you want REPro to call. It does not have to be the device running the dashboard.</DialogDescription></DialogHeader>
        {hasPhone && <p className="rounded-lg bg-muted p-3 text-xs">Current destination: <strong>{phoneLabel(phone.data?.phone_number)}</strong>. It stays saved until a new number is verified.</p>}
        <form className="space-y-3" onSubmit={(event) => {
          event.preventDefault();
          const destination = number.replace(/[\s().-]/g, '');
          if (!/^\+[1-9]\d{7,14}$/.test(destination)) return;
          void run(async () => { client.setQueryData(phoneKey, await requestVoicePhoneVerification(destination)); setCode(''); setMessage('Verification code sent. Enter it below.'); });
        }}>
          <div className="space-y-1.5"><Label htmlFor="staff-phone-number">Your mobile number</Label><Input id="staff-phone-number" className="h-11" type="tel" autoComplete="tel" placeholder="+1 202 555 0123" value={number} onChange={(event) => setNumber(event.target.value)} /></div>
          <Button variant="outline" className="h-10 w-full" type="submit" disabled={busy || !/^\+[1-9]\d{7,14}$/.test(number.replace(/[\s().-]/g, ''))}>Send verification code</Button>
        </form>
        {phone.data?.pending_phone && <form className="space-y-3 border-t pt-3" onSubmit={(event) => {
          event.preventDefault();
          if (code.length < 4) return;
          void run(async () => { client.setQueryData(phoneKey, await verifyVoicePhone(code)); setCode(''); setNumber(''); setPhoneOpen(false); setMessage('Your number is verified. Phone ringing is on for this number.'); });
        }}>
          <div className="space-y-1.5"><Label htmlFor="staff-phone-code">Code sent to {phoneLabel(phone.data.pending_phone)}</Label><Input id="staff-phone-code" className="h-11" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} /></div>
          <p className="text-xs text-muted-foreground">Verifying this number turns on phone ringing for it.</p>
          <Button className="h-10 w-full" type="submit" disabled={busy || code.length < 4}>Verify and enable ringing</Button>
        </form>}
        {message && <p role="status" className="text-sm">{message}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>

    <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle>About call notifications</DialogTitle><DialogDescription>App notifications and phone ringing are separate ways to receive a call.</DialogDescription></DialogHeader>
        <p className="text-sm leading-6">App alerts notify this device. Tap the notification, then choose Answer in REPro. On iPhone, use the Home Screen app and allow notifications. A notification does not reserve the call.</p>
        <p className="text-sm leading-6">Phone ringing dials your saved verified number. It will only ring a phone using that number. Test from another phone, then answer and press 1 to join.</p>
        <p className="text-xs leading-5 text-muted-foreground">Delivery depends on connectivity, notification permissions and Focus / Do Not Disturb. Push-service acceptance is not proof that a device displayed the notification.</p>
        {currentDevice && <p className="text-xs text-muted-foreground">{currentDevice.last_error ? 'The last push was unsuccessful.' : currentDevice.last_success_at ? 'Last push accepted: ' + new Date(currentDevice.last_success_at).toLocaleString() : 'No push-service acceptance recorded yet.'}</p>}
        {Boolean(otherDevices.length) && <div className="border-t pt-3"><h4 className="text-sm font-medium">Other enabled devices</h4><ul className="divide-y" aria-label="Enabled call alert devices">{otherDevices.map((device) => <li key={device.id} className="flex items-center justify-between gap-2 py-2"><div className="min-w-0"><p className="truncate text-sm">{device.label}</p><p className="text-xs text-muted-foreground">{device.last_error ? 'Last push unsuccessful' : device.last_success_at ? 'Last accepted ' + new Date(device.last_success_at).toLocaleString() : 'Not tested yet'}</p></div><Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={'Remove ' + device.label} disabled={busy} onClick={() => void run(async () => { await deleteVoicePushDevice(device.id); await refresh(); })}><Trash2 className="h-4 w-4" /></Button></li>)}</ul></div>}
      </DialogContent>
    </Dialog>
  </section>;
}
