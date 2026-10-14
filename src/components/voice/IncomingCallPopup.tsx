import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getIncomingVoiceOffers } from '@/services/voice';
import { useBrowserPhone } from '@/context/BrowserPhoneContext';
import { usePermissions } from '@/context/PermissionsContext';
import IncomingCallCard from './IncomingCallCard';
import { useDismissedIncomingCalls } from './useDismissedIncomingCalls';

export default function IncomingCallPopup() {
  const phone = useBrowserPhone();
  const { can } = usePermissions();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { dismissed, dismiss } = useDismissedIncomingCalls();
  const [answering, setAnswering] = useState<string | null>(null);
  const seen = useRef(new Set<string>());
  const { toast } = useToast();
  const offers = useQuery({ queryKey: ['voice-incoming-offers'], queryFn: getIncomingVoiceOffers, enabled: phone.eligible && can('voice-calls', 'operate'), refetchInterval: 3000, refetchIntervalInBackground: true });
  const offer = offers.data?.find(item => item.status === 'waiting' && item.can_claim && !dismissed.includes(item.id) && Date.parse(item.expires_at) > Date.now());
  useEffect(() => {
    if (offer) seen.current.add(offer.id);
    for (const handled of offers.data ?? []) {
      if (!seen.current.has(handled.id) || handled.status === 'waiting') continue;
      seen.current.delete(handled.id);
      if (handled.status === 'claimed' && !phone.active && !answering) toast({ title: handled.claimed_by?.name ? `Answered by ${handled.claimed_by.name}` : 'Answered on another device', description: 'Your ringing invitation has closed.' });
      else if (handled.status === 'robbie' || handled.status === 'robbie_pending') toast({ title: 'Caller sent to Robbie', description: 'Your ringing invitation has closed.' });
    }
  }, [offer, offers.data, phone.active, answering, toast]);
  if (!offer || pathname === '/calls/live' || phone.active) return null;
  return <aside className="incoming-call-popup" aria-label="Incoming business call"><IncomingCallCard offer={offer} answering={answering === offer.id} onDismiss={() => dismiss(offer.id)} onAnswer={() => { setAnswering(offer.id); void phone.answerIncoming(offer.id).then(() => navigate(`/calls/live/${offer.voice_call_id}`)).catch(() => { void offers.refetch(); }).finally(() => setAnswering(null)); }} /></aside>;
}
