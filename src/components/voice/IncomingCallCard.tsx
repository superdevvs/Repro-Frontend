import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Loader2, Phone, PhoneIncoming, PhoneOff, Sparkles, X } from 'lucide-react';
import { useBrowserPhone } from '@/context/BrowserPhoneContext';
import { sendIncomingCallToRobbie } from '@/services/voice';
import { useToast } from '@/hooks/use-toast';
import type { VoiceIncomingOffer } from '@/types/voice';
import '@/pages/voice/workspace/callsTheme.css';

export default function IncomingCallCard({ offer, onDismiss, onAnswer, answering = false, compact = false }: {
  offer: VoiceIncomingOffer; onDismiss?: () => void; onAnswer: () => void; answering?: boolean; compact?: boolean;
}) {
  const phone = useBrowserPhone();
  const cache = useQueryClient();
  const { toast } = useToast();
  const key = useRef<string>();
  const [now, setNow] = useState(Date.now());
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { key.current = undefined; setAvatarFailed(false); }, [offer.id]);
  const remaining = Math.max(0, Math.ceil((Date.parse(offer.expires_at) - now) / 1000));
  const expired = !Number.isFinite(remaining) || remaining === 0;
  const name = offer.caller_name || offer.remote_phone || 'Unknown caller';
  const initials = (offer.caller_name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const robbie = useMutation({
    mutationFn: () => { key.current ||= crypto.randomUUID(); return sendIncomingCallToRobbie(offer.id, key.current); },
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ['voice-incoming-offers'] }); void cache.invalidateQueries({ queryKey: ['voice-calls'] }); toast({ title: 'Connecting caller to Robbie', description: 'The team’s ringing invitations are closing.' }); },
    onError: (error) => { void cache.invalidateQueries({ queryKey: ['voice-incoming-offers'] }); toast({ title: 'Could not send to Robbie', description: error instanceof Error ? error.message : 'Check the call’s current status before retrying.', variant: 'destructive' }); },
  });
  const busy = answering || robbie.isPending || phone.busy || Boolean(phone.active);
  return <section className={`calls-workspace incoming-call-card ${compact ? 'incoming-call-card-inline' : ''}`} aria-label={`Incoming call from ${name}`}>
    <header className="incoming-call-card-top"><span className="incoming-call-line"><PhoneIncoming size={14} />{offer.line_label || 'Business line'}</span><span className="incoming-call-status"><i aria-hidden />Incoming call</span>{onDismiss && <button className="incoming-call-dismiss" aria-label="Dismiss incoming call for me" title="Hide this invitation; teammates can still answer" onClick={onDismiss}><X size={15} /></button>}</header>
    <div className="incoming-call-person"><div className="incoming-call-avatar">{offer.caller_avatar && !avatarFailed ? <img src={offer.caller_avatar} alt="" onError={() => setAvatarFailed(true)} /> : <span>{initials}</span>}<span className="incoming-call-avatar-badge"><Phone size={13} /></span></div><h3>{name}</h3><p>{answering ? 'Connecting your call…' : robbie.isPending ? 'Sending to Robbie…' : expired ? 'Checking call status…' : 'is calling you'}</p></div>
    <div className="incoming-call-actions">{onDismiss && <button className="incoming-call-decline" disabled={busy} onClick={onDismiss} title="Decline for me; keep ringing other teammates"><PhoneOff size={17} />Decline</button>}<button className="incoming-call-answer" aria-label="Answer in browser" title="Answer in Dashboard" disabled={!offer.can_claim || busy || expired} onClick={onAnswer}>{answering ? <Loader2 className="animate-spin" size={17} /> : <Phone size={17} />}{answering ? 'Connecting…' : 'Answer'}</button></div>
    <button className="incoming-call-robbie" disabled={!offer.can_send_robbie || busy || expired} title={!offer.can_send_robbie ? 'Robbie must be configured and available for your account and this call.' : 'Send this caller to Robbie. Automatic line routing stays unchanged.'} onClick={() => robbie.mutate()}><Sparkles size={16} />{robbie.isPending ? 'Connecting to Robbie…' : 'Send to Robbie'}<ArrowUpRight size={15} /></button>
    <dl className="incoming-call-details">{offer.caller_company && <><dt>Company</dt><dd>{offer.caller_company}</dd></>}{offer.caller_role && <><dt>Role</dt><dd>{offer.caller_role.replace(/_/g, ' ')}</dd></>}<dt>Caller</dt><dd>{offer.remote_phone || 'Private number'}</dd>{offer.business_phone && <><dt>Business line</dt><dd>{offer.business_phone}</dd></>}</dl>
    <footer className="incoming-call-footer"><span>{expired ? 'Invitation updating' : `${remaining}s to answer`}</span><Link to={`/calls/inbox/${offer.voice_call_id}`}>Caller details <ArrowUpRight size={12} /></Link></footer>
    <div className="incoming-call-progress" aria-hidden><span style={{ width: `${Math.min(100, remaining / 45 * 100)}%` }} /></div>
  </section>;
}
