import { Link, useLocation } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { useBrowserPhone } from '@/context/BrowserPhoneContext';
import { Button } from '@/components/ui/button';
import BrowserPhoneControls, { BrowserPhoneConnectButton } from './BrowserPhoneControls';
import '@/pages/voice/workspace/callsTheme.css';

export default function BrowserPhoneBar() {
  const phone = useBrowserPhone();
  const { pathname } = useLocation();
  const active = phone.active;
  if (!phone.eligible || (!phone.session && !phone.error && phone.status !== 'connecting')) return null;
  const onOwnCockpit = active && pathname === `/calls/live/${active.offer.voice_call_id}`;
  if (onOwnCockpit && !phone.error && !phone.playbackBlocked && !['ringing', 'new', 'trying'].includes(active.state)) return null;
  const idle = !active && phone.status === 'ready' && !phone.error && !phone.playbackBlocked;
  const position = { '--browser-phone-bottom': 'calc(88px + env(safe-area-inset-bottom, 0px) + 12px)' } as CSSProperties;
  return <aside aria-label="Browser phone" style={position} className={`calls-workspace fixed inset-x-3 bottom-[var(--browser-phone-bottom)] z-50 mx-auto max-h-[70dvh] max-w-2xl overflow-y-auto rounded-2xl border border-[var(--calls-border)] bg-[var(--calls-surface)] text-[var(--calls-text)] shadow-xl md:inset-x-auto md:bottom-5 md:right-5 md:w-[480px] ${idle ? 'p-2.5' : 'p-4'}`}>
    {!idle && <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div><p className="font-semibold">{active ? active.offer.caller_name || active.offer.remote_phone || 'Call connection' : 'Your browser phone'}</p><p role="status" className="mt-1 text-xs text-[var(--calls-muted)]">{active ? active.offer.role === 'supervisor' ? active.offer.mode === 'whisper' ? 'Coaching · only staff can hear you' : active.offer.mode === 'barge' ? 'Joined conversation · everyone can hear you' : 'Listening · your microphone is off' : (active.server?.state || active.state).replace(/_/g, ' ') : phone.status === 'ready' ? 'Connected · ready for staff calls' : phone.status.replace(/_/g, ' ')}</p></div>
      {active ? <Button asChild variant="outline" className="calls-secondary h-9"><Link to={`/calls/live/${active.offer.voice_call_id}`}>Open call</Link></Button> : <BrowserPhoneConnectButton />}
    </div>}
    {phone.error && <p role="alert" className="mb-3 rounded-lg bg-[var(--calls-warning-soft)] p-3 text-sm text-[var(--calls-warning)]">{phone.error}</p>}
    <BrowserPhoneControls compact idleCompact={idle} />
  </aside>;
}
