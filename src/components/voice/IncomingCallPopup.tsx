import { useState } from 'react';
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
  const offers = useQuery({ queryKey: ['voice-incoming-offers'], queryFn: getIncomingVoiceOffers, enabled: phone.eligible && can('voice-calls', 'operate'), refetchInterval: 3000, refetchIntervalInBackground: true });
  const offer = offers.data?.find(item => item.status === 'waiting' && item.can_claim && !dismissed.includes(item.id) && Date.parse(item.expires_at) > Date.now());
  if (!offer || pathname === '/calls/live' || phone.active) return null;
  return <aside className="incoming-call-popup" aria-label="Incoming business call"><IncomingCallCard offer={offer} answering={answering === offer.id} onDismiss={() => dismiss(offer.id)} onAnswer={() => { setAnswering(offer.id); void phone.answerIncoming(offer.id).then(() => navigate(`/calls/live/${offer.voice_call_id}`)).catch(() => { void offers.refetch(); }).finally(() => setAnswering(null)); }} /></aside>;
}
