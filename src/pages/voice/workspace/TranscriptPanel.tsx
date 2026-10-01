import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/context/PermissionsContext';
import { useToast } from '@/hooks/use-toast';
import { getVoiceTranscript, reconcileVoiceTranscript, recoverVoiceTranscript } from '@/services/voice';
import type { VoiceCall } from '@/types/voice';

const labels = { off: 'Not captured', starting: 'Starting', live: 'Live', delayed: 'Delayed', finalizing: 'Finalizing', ready: 'Saved', partial: 'Partial', unavailable: 'Unavailable' };
export default function TranscriptPanel({ call, compact = false }: { call: VoiceCall; compact?: boolean }) {
  const { can } = usePermissions();
  const { toast } = useToast();
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const retryKey = useRef(crypto.randomUUID());
  const state = useQuery({ queryKey: ['voice-transcript', call.id], queryFn: () => getVoiceTranscript(call.id), refetchInterval: (query) => ['starting', 'live', 'delayed', 'finalizing'].includes(query.state.data?.state || '') || ['queued', 'processing'].includes(query.state.data?.recovery?.status || '') ? 5000 : false });
  const rebuild = useMutation({ mutationFn: () => reconcileVoiceTranscript(call.id), onSuccess: (data) => { cache.setQueryData(['voice-transcript', call.id], data); void cache.invalidateQueries({ queryKey: ['voice-call', call.id] }); toast({ title: 'Saved transcript refreshed' }); }, onError: (error) => toast({ title: 'Could not refresh transcript', description: error instanceof Error ? error.message : 'Try again.', variant: 'destructive' }) });
  const recover = useMutation({ mutationFn: () => recoverVoiceTranscript(call.id, retryKey.current), onSuccess: (data) => { cache.setQueryData(['voice-transcript', call.id], data); retryKey.current = crypto.randomUUID(); toast({ title: 'Recording recovery requested', description: 'The transcript will update when processing finishes.' }); }, onError: (error) => toast({ title: 'Could not request recovery', description: error instanceof Error ? error.message : 'Check the status before retrying.', variant: 'destructive' }) });
  const transcript = state.data?.display_transcript ?? (state.data?.transcript || call.transcript || call.live_transcript_preview || '');
  const paragraphs = transcript.split(/\n+/).filter((text) => !search || text.toLowerCase().includes(search.toLowerCase()));
  const status = state.data?.state;
  return <section className="space-y-3" aria-label="Saved transcript">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Transcript</h3><span className={`calls-chip ${['delayed', 'partial', 'unavailable'].includes(status || '') ? 'calls-chip-warning' : 'calls-chip-neutral'}`}>{state.isError ? 'Status unavailable' : status ? labels[status] : 'Checking…'}</span></div>
    {state.data?.message && <p className="text-xs leading-5 text-[var(--calls-muted)]" role="status">{state.data.message}</p>}
    {state.data?.source === 'recording_recovery' && <p className="rounded-xl bg-[var(--calls-brand-soft)] p-3 text-xs leading-5">Recovered from the customer recording. Speaker identities were not inferred. Review the recording for accuracy.</p>}
    {state.data?.recovery && <p role="status" className="text-xs leading-5 text-[var(--calls-muted)]">Recording recovery: {state.data.recovery.status} · Attempt {state.data.recovery.attempt} of 3{state.data.recovery.error ? ` · ${state.data.recovery.error}` : ''}</p>}
    {state.isError && <p role="alert" className="text-sm text-[var(--calls-warning)]">Could not check transcript status. <button type="button" className="underline" onClick={() => void state.refetch()}>Try again</button></p>}
    {transcript && <div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-[var(--calls-muted)]" /><Input aria-label="Search saved transcript" placeholder="Search transcript" value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 pl-9" /></div>}
    <div className={`${compact ? 'max-h-64' : 'max-h-[45dvh]'} overflow-y-auto whitespace-pre-wrap rounded-xl bg-[var(--calls-subtle)] p-4 text-sm leading-6`} tabIndex={0} aria-label="Transcript text">{paragraphs.length && transcript ? paragraphs.map((text, index) => <p className="mb-3 last:mb-0" key={index}>{text}</p>) : <p className="text-[var(--calls-muted)]">{search ? 'No matching transcript text.' : state.isLoading ? 'Checking saved segments…' : 'There are no saved transcript segments for this call yet.'}</p>}</div>
    {state.data?.summary_stale && <p className="text-xs text-[var(--calls-warning)]">The recap may not include the latest transcript segments.</p>}
    {state.data?.can_retry_recording && can('voice-calls', 'operate') && <Button className="calls-primary h-11" disabled={recover.isPending || ['queued', 'processing'].includes(state.data.recovery?.status || '')} onClick={() => recover.mutate()}>Recover from recording</Button>}
    <div className="flex flex-wrap gap-2"><Button variant="outline" className="calls-secondary h-11" onClick={() => void state.refetch()} disabled={state.isFetching}><RefreshCw className="h-4 w-4" />Check status</Button>{state.data?.can_rebuild && can('voice-calls', 'operate') && <Button variant="outline" className="calls-secondary h-11" disabled={rebuild.isPending} onClick={() => rebuild.mutate()}>Refresh saved transcript</Button>}{transcript && <Button variant="ghost" className="h-11" onClick={() => { void navigator.clipboard.writeText(transcript).then(() => toast({ title: 'Transcript copied' })).catch(() => toast({ title: 'Could not copy', description: 'Select the transcript text to copy it.', variant: 'destructive' })); }}><Copy className="h-4 w-4" />Copy</Button>}</div>
    {state.data?.last_chunk_at && <p className="text-xs text-[var(--calls-muted)]">Last segment {new Date(state.data.last_chunk_at).toLocaleString()} · {state.data.segment_count} saved segments</p>}
  </section>;
}
