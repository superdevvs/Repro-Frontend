import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CallGlassButton } from '@/components/voice/CallGlass';
import { useBrowserPhone } from '@/context/BrowserPhoneContext';
import { usePermissions } from '@/context/PermissionsContext';
import { getVoiceNumbers } from '@/services/voice';
import { useToast } from '@/hooks/use-toast';
import { normalizeCallPhone, validCallPhone } from './directoryDisplay';

export default function CallNowButton({ to, from, name, reason, label = 'Call now', className = '', disabled = false }: { to?: string | null; from?: string | null; name?: string; reason?: string; label?: string; className?: string; disabled?: boolean }) {
  const phone = useBrowserPhone();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const { toast } = useToast();
  const numbers = useQuery({ queryKey: ['voice-numbers'], queryFn: getVoiceNumbers });
  const voiceLines = numbers.data?.filter(number => number.line_policy?.mode !== 'sms_only' && number.can_call_from !== false) ?? [];
  const line = from ? voiceLines.find(number => normalizeCallPhone(number.phone_number) === normalizeCallPhone(from)) : voiceLines.find(number => number.is_default) ?? voiceLines[0];
  const call = useMutation({
    mutationFn: async () => {
      if (!to || !line?.phone_number) throw new Error('An available business line and contact number are required. Check Calls settings.');
      return phone.startHuman({ to: normalizeCallPhone(to), from: normalizeCallPhone(line.phone_number), reason });
    },
    onSuccess: (created) => { void cache.invalidateQueries({ queryKey: ['voice-calls'] }); navigate(`/calls/live/${created.id}`); },
    onError: (error) => toast({ title: 'Could not connect the call', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' }),
  });
  return <CallGlassButton type="button" busy={call.isPending} className={`${className}`} aria-label={name ? `${label} ${name}` : label} disabled={disabled || !can('voice-calls', 'operate') || !validCallPhone(to || '') || !validCallPhone(line?.phone_number || '') || phone.busy || Boolean(phone.active) || call.isPending} onClick={() => call.mutate()}>
    {call.isPending ? 'Connecting…' : label}
  </CallGlassButton>;
}
