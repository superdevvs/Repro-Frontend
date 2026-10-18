import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { generateEmailArtwork, getEmailArtwork } from '@/services/emailTemplateWorkspace';
import { getTemplateErrorMessage } from '../templatePreviewSupport';
import { toast } from '@/lib/sonner-toast';
import type { EmailTemplateArtwork, EmailArtworkKind, EmailTemplateSection } from '@/types/emailTemplateWorkspace';
import { useAuth } from '@/components/auth/AuthProvider';

export function EmailWorkspaceArtwork({ onUse, target }: { onUse: (url: string, alt: string, kind: EmailArtworkKind) => void; target?: EmailTemplateSection }) {
  const { user } = useAuth();
  const legacyStorageKey = `repro-email-artwork:${user?.id ?? 'anonymous'}`;
  const storageKey = `repro-email-artwork:${user?.id ?? 'anonymous'}:${target?.id ?? 'library'}`;
  const defaultKind = target?.type === 'feature' ? 'icon' : 'header';
  const defaultPrompt = target?.image_prompt || target?.alt || target?.heading || '';
  const [kind, setKind] = useState<EmailArtworkKind>(defaultKind);
  const [prompt, setPrompt] = useState('');
  const [request, setRequest] = useState<{ id: string; kind: EmailArtworkKind; prompt: string } | null>(null);
  const [initial, setInitial] = useState<EmailTemplateArtwork | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    setRequest(null); setInitial(null); setPrompt(defaultPrompt); setKind(defaultKind);
    try {
      const scoped = localStorage.getItem(storageKey);
      const saved = JSON.parse(scoped ?? localStorage.getItem(legacyStorageKey) ?? 'null');
      if (saved?.request?.id && (scoped || !['completed', 'failed'].includes(saved.initial?.status))) { setRequest(saved.request); setInitial(saved.initial ?? null); setPrompt(saved.request.prompt); setKind(saved.request.kind); }
    } catch { /* No saved request. */ }
  }, [storageKey, legacyStorageKey, defaultPrompt, defaultKind]);
  useEffect(() => {
    if (!request) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ request, initial }));
      if (JSON.parse(localStorage.getItem(legacyStorageKey) ?? 'null')?.request?.id === request.id) localStorage.removeItem(legacyStorageKey);
    } catch { /* Keep the request in this session. */ }
  }, [request, initial, storageKey, legacyStorageKey]);
  const result = useQuery({
    queryKey: ['email-template-artwork', request?.id], queryFn: () => getEmailArtwork(request!.id),
    enabled: Boolean(initial && request), retry: false,
    refetchInterval: query => ['queued', 'processing'].includes(query.state.data?.status ?? initial?.status ?? '') ? 3000 : false,
  });
  const artwork = result.data ?? initial;
  const running = busy || (artwork && ['queued', 'processing'].includes(artwork.status));
  function reset() {
    setRequest(null); setInitial(null);
    try { localStorage.removeItem(storageKey); } catch { /* No saved request. */ }
  }
  async function generate() {
    if (!prompt.trim() || running) return;
    const next = request ?? { id: crypto.randomUUID(), kind, prompt: prompt.trim() };
    setRequest(next); setBusy(true);
    try {
      const data = await generateEmailArtwork(next);
      if (mounted.current) setInitial(data);
    } catch (error) { toast.error(getTemplateErrorMessage(error, 'Could not start artwork generation. Retry checks the same request.')); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <div className="ews-artwork-panel">
    <p className="ews-help">Create transparent PNG artwork in the Atelier style, with no white box. Wide headers are composed across the full email width. Your current image stays until you choose a replacement.</p>
    <label>Artwork type<select value={kind} disabled={Boolean(request)} onChange={event => setKind(event.target.value as typeof kind)}><option value="header">Wide email header · 12:5</option><option value="illustration">Transparent illustration · landscape</option><option value="icon">Transparent icon · square</option></select></label>
    <label>Describe the image<Textarea rows={4} maxLength={2000} value={prompt} disabled={Boolean(request)} placeholder="A camera bag with carefully arranged lenses, ready for a property shoot" onChange={event => setPrompt(event.target.value)}/></label>
    {artwork?.url && <img className="ews-generated-image" src={artwork.url} alt={prompt}/>}
    {running && <p role="status">Creating your artwork… You can keep editing while it runs.</p>}
    {(artwork?.error || result.isError) && <p role="alert">{artwork?.error || 'Could not check generation. Try checking again.'}</p>}
    {!initial && <Button onClick={() => void generate()} disabled={busy || !prompt.trim()}>{busy ? 'Starting…' : request ? 'Retry this request' : 'Generate artwork'}</Button>}
    {artwork?.status === 'completed' && artwork.url && <Button onClick={() => onUse(artwork.url!, prompt, artwork.kind)}>{artwork.kind === 'header' ? 'Use as header image' : 'Use this image'}</Button>}
    {initial && <Button variant="outline" onClick={() => void result.refetch()} disabled={result.isFetching}>Check status</Button>}
    {artwork && ['completed', 'failed'].includes(artwork.status) && <Button variant="ghost" onClick={reset}>Create another</Button>}
    {request && !running && (!initial || artwork?.status === 'unknown') && <Button variant="ghost" onClick={() => { if (window.confirm('The previous generation may have been processed. Start a separate request?')) reset(); }}>Start a separate request</Button>}
  </div>;
}
