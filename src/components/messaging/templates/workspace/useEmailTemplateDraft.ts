import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import type { MessageTemplate } from '@/types/messaging';
import type { EmailWorkspaceDraft } from '@/types/emailTemplateWorkspace';
import { initialEmailDraft, normalizeEmailDocument } from './emailWorkspaceModel';

export function useEmailTemplateDraft(initialTemplate: MessageTemplate | null) {
  const { user } = useAuth();
  const [template, setTemplate] = useState(initialTemplate);
  const [draft, setDraft] = useState(() => initialEmailDraft(initialTemplate));
  const currentDraft = useRef(draft);
  function setWorkingDraft(next: EmailWorkspaceDraft) { currentDraft.current = next; setDraft(next); }
  const [saved, setSaved] = useState(() => JSON.stringify(draft));
  const [past, setPast] = useState<{ draft: EmailWorkspaceDraft; label: string }[]>([]);
  const [future, setFuture] = useState<EmailWorkspaceDraft[]>([]);
  const [recovery, setRecovery] = useState<EmailWorkspaceDraft | null>(null);
  const lastChange = useRef({ label: '', time: 0 });
  const storageKey = `repro-email-workspace:${user?.id ?? 'anonymous'}:${template?.id ?? 'new'}`;
  const dirty = JSON.stringify(draft) !== saved;

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      setRecovery(stored?.version === 1 && stored?.draft?.channel === 'EMAIL' ? stored.draft : null);
    } catch { setRecovery(null); }
  }, [storageKey]);

  useEffect(() => {
    if (!dirty || recovery) return;
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, draft })); } catch { /* The server save remains available. */ }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draft, dirty, recovery, storageKey]);

  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (dirty) {
        try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, draft })); } catch { /* Keep the native unsaved warning. */ }
        event.preventDefault(); event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [dirty, draft, storageKey]);

  function replace(value: EmailWorkspaceDraft | ((current: EmailWorkspaceDraft) => EmailWorkspaceDraft), label: string, groupTyping = false) {
    const current = currentDraft.current;
    const next = typeof value === 'function' ? value(current) : value;
    if (next === current) return;
    if (!groupTyping || lastChange.current.label !== label || Date.now() - lastChange.current.time > 800) {
      setPast(history => [...history.slice(-39), { draft: structuredClone(current), label }]);
    }
    lastChange.current = { label, time: Date.now() };
    setFuture([]); setWorkingDraft(next);
  }

  function load(next: MessageTemplate | null, workingDraft?: EmailWorkspaceDraft) {
    const data = initialEmailDraft(next);
    setTemplate(next); setWorkingDraft(workingDraft ?? data); setSaved(JSON.stringify(data)); setPast([]); setFuture([]);
  }

  function markSaved(next: MessageTemplate) {
    try { localStorage.removeItem(storageKey); } catch { /* No stored draft. */ }
    setRecovery(null);
    const data = initialEmailDraft(next);
    setTemplate(next); setWorkingDraft(data); setSaved(JSON.stringify(data));
    setPast([]); setFuture([]);
  }

  function undo() {
    const previous = past.at(-1); if (!previous) return;
    const snapshot = structuredClone(currentDraft.current);
    setFuture(current => [...current, snapshot]); setPast(current => current.slice(0, -1)); setWorkingDraft(previous.draft);
    lastChange.current = { label: '', time: 0 };
  }
  function redo() {
    const next = future.at(-1); if (!next) return;
    const snapshot = structuredClone(currentDraft.current);
    setPast(current => [...current, { draft: snapshot, label: 'Redo' }]); setFuture(current => current.slice(0, -1)); setWorkingDraft(next);
  }
  function recover(restore: boolean) {
    if (restore && recovery) replace({ ...recovery, editor_document_json: normalizeEmailDocument(recovery.editor_document_json) }, 'Restore local draft');
    setRecovery(null); try { localStorage.removeItem(storageKey); } catch { /* No stored draft. */ }
  }

  function stash() {
    if (!dirty) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, draft })); } catch { /* The close confirmation still offers staying in the editor. */ }
  }

  return { template, draft, dirty, past, future, recovery, replace, load, markSaved, undo, redo, recover, stash };
}
