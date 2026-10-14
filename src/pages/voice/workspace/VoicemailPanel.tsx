import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { updateVoicemail } from '@/services/voice';
import type { VoiceCall } from '@/types/voice';
import PrivateVoiceAudio from './PrivateVoiceAudio';

export default function VoicemailPanel({ call, canOperate }: { call: VoiceCall; canOperate: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const update = useMutation({
    mutationFn: (data: { read?: boolean; resolved?: boolean; callback_task?: boolean }) => updateVoicemail(call.id, data),
    onSuccess: (_updated, data) => {
      void queryClient.invalidateQueries({ queryKey: ['voice-call', call.id] });
      void queryClient.invalidateQueries({ queryKey: ['voice-calls'] });
      if (data.callback_task) toast({ title: 'Manual callback task ready' });
    },
    onError: () => toast({ title: 'Could not update voicemail', variant: 'destructive' }),
  });
  const vm = call.voicemail;
  if (!vm) return null;
  const ready = vm.state === 'saved' && (!vm.expires_at || new Date(vm.expires_at).getTime() > Date.now());
  return <section aria-label="Voicemail" className="space-y-3 rounded-xl border p-4">
    <p className="font-medium">Voicemail · {vm.phone_number} · {vm.read_at ? 'Read' : 'Unread'}{vm.resolved_at ? ' · Resolved' : ''}</p>
    <p className="text-sm text-muted-foreground">{vm.saved_at ? new Date(vm.saved_at).toLocaleString() : 'Recording pending'} · {vm.duration_seconds ?? 0}s · {ready ? 'Ready to play' : vm.state}</p>
    {vm.failure && <p role="alert" className="text-sm text-destructive">{vm.failure}</p>}
    {ready && <PrivateVoiceAudio path={`/voice/calls/${call.id}/voicemail/audio`} onLoaded={() => { if (canOperate && !vm.read_at) update.mutate({ read: true }); }} />}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={!canOperate || update.isPending} onClick={() => update.mutate({ read: !vm.read_at })}>Mark {vm.read_at ? 'unread' : 'read'}</Button>
      <Button variant="outline" disabled={!canOperate || update.isPending || Boolean(vm.resolved_at)} onClick={() => update.mutate({ callback_task: true })}>Create callback task</Button>
      <Button variant="outline" disabled={!canOperate || update.isPending} onClick={() => update.mutate({ resolved: !vm.resolved_at })}>{vm.resolved_at ? 'Reopen' : 'Resolve'}</Button>
    </div>
    <p className="text-xs text-muted-foreground">Audio retained for 90 days. Callback tasks require a staff member to place the call.</p>
  </section>;
}
