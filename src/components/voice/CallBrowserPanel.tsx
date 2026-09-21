import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useBrowserPhone } from '@/context/BrowserPhoneContext';
import { getVoiceBrowserCallState } from '@/services/voiceBrowser';
import BrowserPhoneControls, { BrowserPhoneConnectButton } from './BrowserPhoneControls';

export default function CallBrowserPanel({ callId, ended = false, compact = false }: { callId: number; ended?: boolean; compact?: boolean }) {
  const phone = useBrowserPhone();
  const own = phone.active?.offer.voice_call_id === callId;
  const state = useQuery({ queryKey: ['voice-browser-call', callId], queryFn: () => getVoiceBrowserCallState(callId), enabled: phone.eligible && !ended && Number.isFinite(callId), refetchInterval: 5000, retry: false });
  if (!phone.eligible || ended) return null;
  const capabilities = state.isError ? undefined : state.data?.capabilities;
  const ready = phone.status === 'ready' && phone.session?.registered && !phone.busy && !phone.active;
  const act = (action: () => Promise<void>) => { void action().catch(() => undefined); };
  if (compact) return <div className="flex flex-wrap gap-2">
    {capabilities?.can_monitor && <Button variant="outline" className="calls-secondary h-11" disabled={!ready} onClick={() => act(() => phone.supervise(callId, 'monitor'))}>Listen</Button>}
    {capabilities?.can_whisper && <Button variant="outline" className="calls-secondary h-11" disabled={!ready} onClick={() => act(() => phone.supervise(callId, 'whisper'))}>Coach staff</Button>}
  </div>;
  return <section className="calls-panel space-y-3 p-4" aria-label="Call audio">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{own ? phone.active?.offer.role === 'supervisor' ? 'Supervising this call' : 'Your call audio' : 'Join the conversation'}</h3>{!own && <BrowserPhoneConnectButton />}</div>
    {own ? <>
      <p role="status" className="text-xs text-[var(--calls-muted)]">{phone.active?.offer.role === 'supervisor' ? phone.active.offer.mode === 'whisper' ? 'Only the staff member hears your coaching.' : phone.active.offer.mode === 'barge' ? 'Everyone in the conversation can hear you.' : 'Listening only. Your microphone is muted.' : (phone.active?.server?.state || phone.active?.state || '').replace(/_/g, ' ')}</p>
      <BrowserPhoneControls />
    </> : <>
      <p className="text-sm text-[var(--calls-muted)]">{phone.active ? 'Finish or leave your current browser call first.' : phone.config?.ready ? 'Connect your browser phone, then answer the invitation. Available actions depend on this call and your permissions.' : phone.config?.blockers?.[0] || 'Browser calling is not configured.'}</p>
      <div className="flex flex-wrap gap-2">
        {capabilities?.can_takeover && <Button className="calls-primary h-11" disabled={!ready} onClick={() => act(() => phone.takeOver(callId))}>Take over from Robbie</Button>}
        {capabilities?.can_monitor && <Button variant="outline" className="calls-secondary h-11" disabled={!ready} onClick={() => act(() => phone.supervise(callId, 'monitor'))}>Listen</Button>}
        {capabilities?.can_whisper && <Button variant="outline" className="calls-secondary h-11" disabled={!ready} onClick={() => act(() => phone.supervise(callId, 'whisper'))}>Coach staff only</Button>}
        {capabilities?.can_barge && <Button variant="outline" className="calls-secondary h-11" disabled={!ready} onClick={() => act(() => phone.supervise(callId, 'barge'))}>Join conversation</Button>}
      </div>
      {state.isError && <p role="alert" className="text-xs text-[var(--calls-warning)]">Could not check this call’s audio controls. <button className="underline" onClick={() => void state.refetch()}>Try again</button></p>}
      {state.data?.supervision_unavailable_reason && <p className="text-xs text-[var(--calls-muted)]">{state.data.supervision_unavailable_reason}</p>}
    </>}
    {state.data?.error && <p role="alert" className="text-sm text-[var(--calls-warning)]">{state.data.error}</p>}
    {phone.error && <p role="alert" className="text-sm text-[var(--calls-warning)]">{phone.error}</p>}
  </section>;
}
