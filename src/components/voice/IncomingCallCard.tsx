import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Check, Clock3, Phone, PhoneIncoming, PhoneOff, Users, X } from 'lucide-react';
import { useBrowserPhone } from '@/context/BrowserPhoneContext';
import { sendIncomingCallToRobbie } from '@/services/voice';
import { useToast } from '@/hooks/use-toast';
import type { VoiceIncomingOffer } from '@/types/voice';
import { CallGlassButton, RobbieHandoffButton, RobbieMark } from './CallGlass';
import '@/pages/voice/workspace/callsTheme.css';
import './incomingCall.css';

interface IncomingCallCardProps {
  offer: VoiceIncomingOffer;
  onDismiss?: () => void;
  onAnswer: () => void;
  answering?: boolean;
  compact?: boolean;
}

export default function IncomingCallCard(props: IncomingCallCardProps) {
  // New invitations must never inherit a previous caller's pending handoff.
  return <IncomingCallContent key={props.offer.id} {...props} />;
}

function IncomingCallContent({ offer, onDismiss, onAnswer, answering = false, compact = false }: IncomingCallCardProps) {
  const phone = useBrowserPhone();
  const cache = useQueryClient();
  const { toast } = useToast();
  const titleId = useId();
  const key = useRef<string>();
  const [now, setNow] = useState(Date.now());
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const remaining = Math.max(0, Math.ceil((Date.parse(offer.expires_at) - now) / 1000));
  const expired = !Number.isFinite(remaining) || remaining === 0;
  const name = offer.caller_name || offer.remote_phone || 'Unknown caller';
  const initials = (offer.caller_name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const robbie = useMutation({
    mutationFn: () => { key.current ||= crypto.randomUUID(); return sendIncomingCallToRobbie(offer.id, key.current); },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['voice-incoming-offers'] });
      void cache.invalidateQueries({ queryKey: ['voice-calls'] });
      toast({ title: 'Connecting caller to Robbie', description: 'The team’s ringing invitations are closing.' });
    },
    onError: (error) => {
      void cache.invalidateQueries({ queryKey: ['voice-incoming-offers'] });
      toast({ title: 'Could not send to Robbie', description: error instanceof Error ? error.message : 'Check the call’s current status before retrying.', variant: 'destructive' });
    },
  });
  const withRobbie = offer.status === 'robbie';
  const handing = !withRobbie && (offer.status === 'robbie_pending' || (offer.status === 'waiting' && (robbie.isPending || robbie.isSuccess)));
  const closed = offer.status !== 'waiting' || expired;
  const busy = answering || handing || phone.busy || Boolean(phone.active);
  const settled = closed && !handing && !withRobbie;
  const status = handing ? 'Connecting Robbie…' : withRobbie ? 'Handled by Robbie' : answering ? 'Connecting your call…' : settled ? offer.status === 'claimed' ? 'Answered elsewhere' : expired || offer.status === 'expired' ? 'Invitation expired' : 'Call invitation closed' : 'Incoming call';
  return <section className={'calls-workspace incoming-call-card ' + (compact ? 'incoming-call-card-inline ' : '') + (handing || withRobbie ? 'is-robbie ' : '') + (settled ? 'is-settled' : '')}
    role={compact ? 'region' : 'dialog'} aria-modal={compact ? undefined : false} aria-labelledby={titleId} aria-label={'Incoming call from ' + name}>
    <header className="incoming-call-card-top">
      <span className="incoming-call-line-icon">{handing || withRobbie ? <RobbieMark /> : <PhoneIncoming size={16} />}</span>
      <span className="incoming-call-line"><strong>{status}</strong><small>{offer.line_label || 'Business line'}{offer.business_phone ? ' · ' + offer.business_phone : ''}</small></span>
      {!closed && !handing && <span className="incoming-call-window"><Clock3 size={11} />{remaining}s</span>}
      {onDismiss && <button type="button" className="incoming-call-dismiss" disabled={busy} aria-label="Dismiss incoming call for me" title="Hide this invitation; teammates can still answer" onClick={onDismiss}><X size={16} /></button>}
    </header>
    <div className="incoming-call-person">
      <div className="incoming-call-avatar-anchor" data-ringing={!closed && !handing && !answering || undefined}>
        <div className="incoming-call-avatar">{handing || withRobbie ? <RobbieMark /> : offer.caller_avatar && !avatarFailed ? <img src={offer.caller_avatar} alt="" onError={() => setAvatarFailed(true)} /> : <span>{initials}</span>}</div>
        <span className="incoming-call-avatar-badge">{settled ? <Check size={12} /> : <Phone size={12} />}</span>
      </div>
      <h3 id={titleId}>{name}</h3>
      <div className="incoming-call-contact">{offer.caller_role && <span className="incoming-call-role">{offer.caller_role.replace(/_/g, ' ')}</span>}<span>{offer.remote_phone || 'Private number'}</span></div>
      {offer.caller_company && <p className="incoming-call-company">{offer.caller_company}</p>}
    </div>
    {settled ? <div role="status" className="incoming-call-settled"><Check size={17} /><span><strong>{offer.status === 'claimed' && offer.claimed_by?.name ? 'Answered by ' + offer.claimed_by.name : status}</strong>Your ringing invitation is closed.</span></div> : handing || withRobbie ? <div role="status" className="incoming-call-handoff-status"><strong>{withRobbie ? 'Robbie is on the call' : 'Connecting Robbie…'}</strong><span>{withRobbie ? 'Handoff confirmed' : 'Waiting for handoff confirmation'}</span></div> : <>
      <div className="incoming-call-actions">
        {onDismiss && <button type="button" className="incoming-call-decline" disabled={busy} onClick={onDismiss} title="Decline for me; keep ringing other teammates"><PhoneOff size={17} />Decline</button>}
        <CallGlassButton tone="live" className="incoming-call-answer" aria-label="Answer in browser" title="Answer in Dashboard" busy={answering} disabled={!offer.can_claim || busy || closed} onClick={onAnswer}>{answering ? 'Connecting…' : 'Answer'}</CallGlassButton>
      </div>
      <RobbieHandoffButton className="incoming-call-robbie" aria-label="Send to Robbie" disabled={!offer.can_send_robbie || busy || closed}
        title={!offer.can_send_robbie ? 'Robbie must be configured and available for your account and this call.' : 'Send this caller to Robbie. Automatic line routing stays unchanged.'}
        onClick={() => robbie.mutate()} />
      {robbie.isError && <p role="alert" className="incoming-call-error">Handoff was not confirmed. Check the call status before retrying.</p>}
    </>}
    <footer className="incoming-call-footer"><span><Users size={12} />Shared team call</span><Link to={'/calls/inbox/' + offer.voice_call_id}>Caller details <ArrowUpRight size={12} /></Link></footer>
    <p className="incoming-call-helper">{handing ? 'Other invitations close while the handoff is processed.' : withRobbie || settled ? 'No action is needed on this device.' : 'Answering here stops ringing on the other devices.'}</p>
    <div className="incoming-call-progress" aria-hidden="true"><span style={{ width: (closed || handing ? 0 : Math.min(100, remaining / 45 * 100)) + '%' }} /></div>
  </section>;
}
