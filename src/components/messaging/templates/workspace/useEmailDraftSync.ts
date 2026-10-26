import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { deleteEmailServerDraft, loadEmailServerDraft, saveEmailServerDraft } from '@/services/emailWorkspaceV2';
import type { EmailServerDraft, EmailWorkspaceDraft } from '@/types/emailTemplateWorkspace';

interface DraftSession {
  key: string; id: string; revision: number; loaded: boolean; stopped: boolean; saved: string;
  loading: Promise<void> | null;
}
const conflictMessage = 'Draft changed in another tab. Open the latest draft or save a copy.';

export function useEmailDraftSync(templateId: number | undefined, draft: EmailWorkspaceDraft, dirty: boolean, enabled: boolean, paused: boolean) {
  const { user } = useAuth();
  const key = `${user?.id}:${templateId ?? 'new'}`;
  const session = useRef<DraftSession>({ key, id: String(crypto.randomUUID()), revision: 0, loaded: false, stopped: false, saved: '', loading: null });
  const inFlight = useRef<Promise<unknown> | null>(null);
  const [recovery, setRecovery] = useState<EmailServerDraft | null>(null);
  const [status, setStatus] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const current: DraftSession = { key, id: String(crypto.randomUUID()), revision: 0, loaded: false, stopped: false, saved: '', loading: null }; session.current = current;
    setRecovery(null); setStatus('Loading draft…');
    current.loading = loadEmailServerDraft(templateId).then(saved => {
      if (session.current !== current) return;
      if (saved?.id) { current.id = saved.id; current.revision = saved.revision; current.saved = JSON.stringify(saved.draft); if (!current.stopped) setRecovery(saved); }
      current.loaded = true; if (!current.stopped) setStatus(''); setTick(value => value + 1);
    }).catch(() => { if (session.current === current) { current.loaded = true; if (!current.stopped) setStatus('Offline · local recovery is available'); setTick(value => value + 1); } });
    return () => { current.stopped = true; };
  }, [key, templateId, enabled]);
  const value = JSON.stringify(draft);
  useEffect(() => {
    const current = session.current;
    if (!enabled || !dirty || paused || recovery || !current.loaded || current.stopped || current.saved === value) return;
    const timer = window.setTimeout(() => {
      setStatus('Saving draft…');
      const request = (inFlight.current ?? Promise.resolve()).catch(() => undefined).then(async () => {
        if (session.current !== current || current.stopped) return;
        const saved = await saveEmailServerDraft(current.id, current.revision, JSON.parse(value), templateId);
        current.revision = saved.revision; current.saved = value;
        if (session.current === current) setStatus('Draft saved');
      }).catch(error => {
        if (session.current !== current) return;
        if (error?.response?.status === 409) { current.stopped = true; setStatus(conflictMessage); }
        else setStatus('Offline · your changes remain on this device');
      }).finally(() => { if (inFlight.current === request) inFlight.current = null; });
      inFlight.current = request;
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [enabled, dirty, paused, recovery, value, templateId, tick]);
  async function clear() {
    const current = session.current; current.stopped = true;
    try {
      // A quick explicit save can finish while recovery is still loading. Wait
      // for its revision, and for our own last write, before issuing a CAS delete.
      await current.loading; await inFlight.current;
      if (session.current !== current) return;
      if (current.revision) await deleteEmailServerDraft(current.id, current.revision);
      if (session.current !== current) return;
      current.id = String(crypto.randomUUID()); current.revision = 0; current.saved = ''; current.stopped = false;
      setRecovery(null); setStatus('');
    } catch (error) {
      if (session.current === current) setStatus((error as { response?: { status?: number } })?.response?.status === 409 ? conflictMessage : 'Could not clear the server draft. Your recovery copy is kept.');
      throw error;
    }
  }
  async function reload() {
    const current = session.current;
    const saved = await loadEmailServerDraft(templateId);
    if (session.current !== current) return;
    current.id = saved?.id ?? String(crypto.randomUUID()); current.revision = saved?.revision ?? 0;
    current.saved = saved?.id ? JSON.stringify(saved.draft) : ''; current.loaded = true; current.stopped = false;
    setRecovery(saved?.id ? saved : null); setStatus(''); setTick(value => value + 1);
  }
  return { recovery, status, reload, accept: () => { setRecovery(null); setTick(value => value + 1); }, clear };
}
