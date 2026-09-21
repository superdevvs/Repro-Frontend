import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { useBrowserPhone } from '@/context/BrowserPhoneContext';

export default function BrowserPhoneExtras() {
  const phone = useBrowserPhone();
  const [transferOpen, setTransferOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [to, setTo] = useState('');
  const active = phone.active;
  if (!active || active.offer.role !== 'agent' || active.state !== 'active') return null;
  const capabilities = active.server?.capabilities;
  const recording = active.server?.recording;
  const valid = /^\+[1-9]\d{7,14}$/.test(to.replace(/[\s().-]/g, ''));
  const act = (action: () => Promise<void>) => { void action().catch(() => undefined); };
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      {capabilities?.can_transfer && <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogTrigger asChild><Button variant="outline" className="calls-secondary h-11" disabled={phone.busy}>Transfer</Button></DialogTrigger>
        <DialogContent className="calls-workspace"><DialogHeader><DialogTitle>Transfer the caller</DialogTitle><DialogDescription>Enter the destination number. Your call stays connected while the new person answers.</DialogDescription></DialogHeader>
          <Label htmlFor="phone-transfer-to">Transfer to</Label><Input id="phone-transfer-to" type="tel" value={to} onChange={(event) => setTo(event.target.value)} placeholder="+1 (202) 555-0124" disabled={phone.busy} />
          {phone.error && <p role="alert" className="text-sm text-[var(--calls-danger)]">{phone.error}</p>}
          <DialogFooter><Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button><Button disabled={!valid || phone.busy} onClick={() => act(async () => { await phone.control('transfer', to); setTransferOpen(false); })}>Start transfer</Button></DialogFooter>
        </DialogContent>
      </Dialog>}
      {(capabilities?.can_record || recording?.active || recording?.stop_pending) && <>
        {recording?.active || recording?.stop_pending ? <Button variant="outline" className="calls-secondary h-11" disabled={phone.busy} onClick={() => act(() => phone.control('recording_stop'))}>{recording.stop_pending ? 'Retry stop recording' : 'Stop recording'}</Button>
          : recording?.consent_given ? <Button variant="outline" className="calls-secondary h-11" disabled={phone.busy} onClick={() => act(() => phone.control('recording_start'))}>Start recording</Button>
          : <Dialog open={consentOpen} onOpenChange={setConsentOpen}><DialogTrigger asChild><Button variant="outline" className="calls-secondary h-11" disabled={phone.busy}>Record caller consent</Button></DialogTrigger>
            <DialogContent className="calls-workspace"><DialogHeader><DialogTitle>Has the caller agreed?</DialogTitle><DialogDescription>Explain that this call will be recorded and transcribed, then ask for permission. Confirm only after the caller explicitly agrees. Recording starts in a separate step.</DialogDescription></DialogHeader>
              {phone.error && <p role="alert" className="text-sm text-[var(--calls-danger)]">{phone.error}</p>}
              <DialogFooter><Button variant="outline" onClick={() => setConsentOpen(false)}>Not yet</Button><Button disabled={phone.busy} onClick={() => act(async () => { await phone.setConsent(true); setConsentOpen(false); })}>Caller gave consent</Button></DialogFooter>
            </DialogContent></Dialog>}
        {recording?.consent_given && <Button variant="ghost" disabled={phone.busy} onClick={() => act(() => phone.setConsent(false))}>Withdraw consent</Button>}
        {recording?.active && recording.consent_given && !recording.transcription_active && !recording.stop_pending && capabilities?.can_record && <Button variant="outline" className="calls-secondary h-11" disabled={phone.busy} onClick={() => act(() => phone.control('recording_start'))}>Retry transcription</Button>}
      </>}
    </div>
    {recording && <p role={recording.stop_pending ? 'alert' : undefined} className="text-xs text-[var(--calls-muted)]">{recording.stop_pending ? 'Stopping capture is not yet confirmed. Retry stop recording.' : recording.active ? `Recording active · ${recording.transcription_active ? 'Transcription active' : recording.transcription_pending ? 'Transcription not confirmed' : 'Transcription unavailable'}. Private coaching is excluded.` : recording.consent_given ? 'Consent recorded · Recording is stopped.' : 'Recording is off · Caller consent required.'}</p>}
  </div>;
}
