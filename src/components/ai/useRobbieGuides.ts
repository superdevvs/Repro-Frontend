import { useCallback, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AiChatRequest } from '@/types/ai';

interface GuideDraft {
  sessionId: string | null;
  question: string;
  context: AiChatRequest['context'];
}

export function useRobbieGuides({ sessionId, setMessage, messageInputRef }: {
  sessionId: string | null;
  setMessage: Dispatch<SetStateAction<string>>;
  messageInputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const [params, setParams] = useSearchParams();
  const draftGuide = useRef<GuideDraft | null>(null);
  const guidesOpen = params.get('tab') === 'help' || Boolean(params.get('article'));
  const setGuidesOpen = useCallback((open: boolean) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (open) next.set('tab', 'help');
      else { next.delete('tab'); next.delete('article'); }
      return next;
    });
  }, [setParams]);
  const prepareGuideQuestion = useCallback((question: string, context: AiChatRequest['context']) => {
    draftGuide.current = { sessionId, question, context };
    // Keep authored text verbatim and avoid duplicating a repeatedly selected guide.
    setMessage((draft) => draft.includes(question) ? draft : draft.trim() ? `${draft}\n\n${question}` : question);
    setGuidesOpen(false);
    requestAnimationFrame(() => {
      const input = messageInputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      input.scrollTop = input.scrollHeight;
    });
  }, [sessionId, setMessage, setGuidesOpen, messageInputRef]);
  const getGuideContext = useCallback((draft: string) => {
    const guide = draftGuide.current;
    // A changed session or a removed question must not inherit an unrelated guide.
    return guide?.sessionId === sessionId && draft.includes(guide.question) ? guide.context : undefined;
  }, [sessionId]);
  const clearGuideContext = useCallback(() => { draftGuide.current = null; }, []);
  return { guidesOpen, setGuidesOpen, prepareGuideQuestion, getGuideContext, clearGuideContext };
}
