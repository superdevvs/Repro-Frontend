import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBrowserPhone } from '@/context/BrowserPhoneContext';
import { usePermissions } from '@/context/PermissionsContext';
import { getVoiceNumbers } from '@/services/voice';
import { useToast } from '@/hooks/use-toast';
import { normalizeCallPhone, validCallPhone } from './directoryDisplay';

export default function CallNowButton({ to, name, reason, label = 'Call now', className = '', disabled = false }: { to?: string | null; name?: string; reason?: string; label?: string; className?: string; disabled?: boolean }) {
  const phone = useBrowserPhone();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const { toast } = useToast();
  const numbers = useQuery({ queryKey: ['voice-numbers'], queryFn: getVoiceNumbers });
  const line = numbers.data?.find((number) => number.is_default) ?? numbers.data?.[0];
  const call = useMutation({
    mutationFn: async () => {
      if (!to || !line?.phone_number) throw new Error('An available business line and contact number are required. Check Calls settings.');
      return phone.startHuman({ to: normalizeCallPhone(to), from: normalizeCallPhone(line.phone_number), reason });
    },
    onSuccess: (created) => { void cache.invalidateQueries({ queryKey: ['voice-calls'] }); navigate(`/calls/live/${created.id}`); },
    onError: (error) => toast({ title: 'Could not connect the call', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' }),
  });
  return <Button type="button" className={`calls-call h-11 rounded-xl ${className}`} aria-label={name ? `${label} ${name}` : label} disabled={disabled || !can('voice-calls', 'operate') || !validCallPhone(to || '') || !validCallPhone(line?.phone_number || '') || phone.busy || Boolean(phone.active) || call.isPending} onClick={() => call.mutate()}>
    {call.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />} {call.isPending ? 'Connecting…' : label}
  </Button>;
}
