import { useState } from 'react';
import { Headphones, Mic, MicOff, Phone, PhoneOff, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBrowserPhone } from '@/context/BrowserPhoneContext';
import BrowserPhoneExtras from './BrowserPhoneExtras';

const invoke = (action: () => Promise<unknown>) => { void action().catch(() => undefined); };

export function BrowserPhoneConnectButton() {
  const phone = useBrowserPhone();
  if (!phone.eligible) return null;
  const connected = phone.status === 'ready';
  return <Button type="button" variant="outline" className="calls-secondary h-11 rounded-lg" disabled={phone.busy || phone.status === 'connecting' || phone.configLoading || (!connected && !phone.config?.ready) || Boolean(phone.active)} onClick={() => invoke(connected ? phone.disconnect : phone.connect)}>
    <Headphones className="h-4 w-4" />{connected ? 'Phone connected' : phone.status === 'connecting' ? 'Connecting phone…' : 'Connect phone'}
  </Button>;
}

export default function BrowserPhoneControls({ compact = false }: { compact?: boolean }) {
  const phone = useBrowserPhone();
  const [keypad, setKeypad] = useState(false);
  const [devices, setDevices] = useState(false);
  const active = phone.active;
  const ringing = active && ['ringing', 'new', 'trying'].includes(active.state);
  const supervisor = active?.offer.role === 'supervisor';
  const canControl = Boolean(active?.server?.capabilities.can_control || (supervisor && active?.offer.mode && active.server?.capabilities[`can_${active.offer.mode}`])) && phone.status === 'ready' && !phone.busy;
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      {ringing ? <>
        <Button className="calls-primary h-11" disabled={phone.busy || phone.status !== 'ready'} onClick={() => invoke(phone.answer)}><Phone className="h-4 w-4" />{supervisor ? 'Join supervision' : 'Answer'}</Button>
        <Button variant="outline" className="calls-secondary h-11" disabled={phone.busy} onClick={() => invoke(phone.decline)}>Decline</Button>
      </> : active ? <>
        <Button variant="outline" className="calls-secondary h-11" disabled={!canControl || active.offer.mode === 'monitor'} onClick={() => invoke(() => phone.control(active.muted ? 'unmute' : 'mute'))}>
          {active.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{active.offer.mode === 'monitor' ? 'Listening · mic off' : active.muted ? 'Unmute' : 'Mute'}
        </Button>
        {!supervisor && <Button variant="outline" className="calls-secondary h-11" disabled={!canControl} onClick={() => invoke(() => phone.control(active.held ? 'resume' : 'hold'))}>{active.held ? 'Resume caller' : 'Hold caller'}</Button>}
        {!supervisor && <Button variant="outline" className="calls-secondary h-11" disabled={!canControl} aria-expanded={keypad} onClick={() => setKeypad((value) => !value)}>Keypad</Button>}
        <Button variant="destructive" className="h-11" disabled={phone.busy || (!supervisor && !active.server?.capabilities.can_end)} onClick={() => invoke(() => phone.control('end'))}><PhoneOff className="h-4 w-4" />{supervisor ? 'Leave supervision' : 'End call'}</Button>
      </> : null}
      <Button variant="outline" className="calls-secondary h-11" disabled={phone.status !== 'ready'} aria-expanded={devices} onClick={() => setDevices((value) => !value)}><Settings2 className="h-4 w-4" />Audio</Button>
      {phone.playbackBlocked && <Button className="calls-primary h-11" onClick={() => invoke(phone.playAudio)}>Enable call audio</Button>}
    </div>
    {supervisor && !ringing && <div className="flex flex-wrap gap-2" aria-label="Supervision mode">
      {(['monitor', 'whisper', 'barge'] as const).map((mode) => <Button key={mode} variant="outline" className={active.offer.mode === mode ? 'calls-primary h-11' : 'calls-secondary h-11'} aria-pressed={active.offer.mode === mode} disabled={phone.busy || !active.server?.capabilities[`can_${mode}`]} onClick={() => invoke(() => phone.changeMode(mode))}>{mode === 'monitor' ? 'Listen' : mode === 'whisper' ? 'Coach staff only' : 'Join conversation'}</Button>)}
    </div>}
    {keypad && !supervisor && <div className="grid max-w-56 grid-cols-3 gap-2" aria-label="Call keypad">
      {'123456789*0#'.split('').map((digit) => <Button key={digit} variant="outline" className="calls-secondary h-11" disabled={!canControl} onClick={() => invoke(() => phone.control('dtmf', digit))}>{digit}</Button>)}
    </div>}
    {devices && <div className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
      <label className="space-y-1 text-xs">Microphone<select aria-label="Call microphone" value={phone.inputId} disabled={phone.busy} onChange={(event) => invoke(() => phone.setInput(event.target.value))} className="block h-11 w-full rounded-lg border border-[var(--calls-border)] bg-[var(--calls-surface)] px-2 text-sm"><option value="">System default</option>{phone.inputs.map((device, i) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${i + 1}`}</option>)}</select></label>
      <label className="space-y-1 text-xs">Speaker<select aria-label="Call speaker" value={phone.outputId} disabled={phone.busy || phone.outputs.length === 0} onChange={(event) => invoke(() => phone.setOutput(event.target.value))} className="block h-11 w-full rounded-lg border border-[var(--calls-border)] bg-[var(--calls-surface)] px-2 text-sm"><option value="">System default</option>{phone.outputs.map((device, i) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Speaker ${i + 1}`}</option>)}</select></label>
      {phone.outputs.length === 0 && <p className="text-xs text-[var(--calls-muted)]">Use your device’s sound settings to choose the speaker.</p>}
    </div>}
    {!ringing && <BrowserPhoneExtras />}
  </div>;
}
