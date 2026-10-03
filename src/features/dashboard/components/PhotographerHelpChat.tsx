import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUp, RotateCcw } from 'lucide-react';
import { ChatText } from '@/components/ai/ChatText';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';
import { Button } from '@/components/ui/button';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/usePermission';
import { sendAiMessage } from '@/services/aiService';
import type { AiMessage } from '@/types/ai';
import { cn } from '@/lib/utils';

const MAX_QUESTION_LENGTH = 2000;

interface ChatState {
  owner: string;
  draft: string;
  messages: AiMessage[];
  sessionId: string | null;
  pendingQuestion: string | null;
  error: string | null;
}

const initialState = (owner: string): ChatState => ({
  owner, draft: '', messages: [], sessionId: null, pendingQuestion: null, error: null,
});

function failureMessage(error: unknown): string {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 401 || status === 419) return 'Your session has expired. Sign in again to ask Robbie.';
  if (status === 403) return 'Robbie chat is unavailable for this account. You can still use the guides above.';
  if (status === 429) return 'Robbie is receiving too many messages. Please wait a moment and try again.';
  return 'Robbie couldn’t reply. Your question is saved here. Please try again.';
}

/** Keep this hook in the persistent help hub so closing a dialog preserves the conversation. */
// The hook and its sole presentation component share this deliberately small feature module.
// eslint-disable-next-line react-refresh/only-export-components
export function usePhotographerHelpChat(userId: string | number) {
  const owner = String(userId);
  const location = useLocation();
  const { can, isLoading: permissionLoading } = usePermission();
  const canChat = !permissionLoading && can('robbie', 'view');
  const [storedState, setState] = useState(() => initialState(owner));
  const state = storedState.owner === owner ? storedState : initialState(owner);
  const currentRef = useRef({ owner, state, canChat, route: location.pathname });
  currentRef.current = { owner, state, canChat, route: location.pathname };
  const requestRef = useRef<object | null>(null);

  useEffect(() => {
    setState(previous => previous.owner === owner ? previous : initialState(owner));
    requestRef.current = null;
    return () => { requestRef.current = null; };
  }, [owner]);

  const setDraft = useCallback((draft: string) => {
    if (currentRef.current.owner !== owner) return;
    setState(previous => ({
      ...(previous.owner === owner ? previous : initialState(owner)),
      draft: draft.slice(0, MAX_QUESTION_LENGTH),
    }));
  }, [owner]);

  const send = useCallback(async () => {
    const current = currentRef.current;
    const question = current.state.draft.trim();
    if (current.owner !== owner || !current.canChat || !question || requestRef.current) return;
    const request = {};
    requestRef.current = request;
    setState(previous => ({ ...previous, pendingQuestion: question, error: null }));
    const isCurrentRequest = () => currentRef.current.owner === owner && requestRef.current === request;

    try {
      const response = await sendAiMessage({
        sessionId: current.state.sessionId,
        message: question,
        context: {
          intent: 'support_faq', source: 'photographer_help_hub',
          page: current.route === '/dashboard' ? 'dashboard' : undefined,
          route: current.route, role: 'photographer',
        },
      });
      if (!isCurrentRequest()) return;
      if (!response.sessionId || !Array.isArray(response.messages)) throw new Error('Invalid chat response');
      setState(previous => ({
        ...previous, sessionId: response.sessionId, messages: response.messages,
        draft: previous.draft === current.state.draft ? '' : previous.draft,
        pendingQuestion: null, error: null,
      }));
    } catch (error: unknown) {
      if (isCurrentRequest()) {
        setState(previous => ({ ...previous, pendingQuestion: null, error: failureMessage(error) }));
      }
    } finally {
      if (isCurrentRequest()) requestRef.current = null;
    }
  }, [owner]);

  return { ...state, sending: state.pendingQuestion !== null, canChat, permissionLoading, setDraft, send };
}

type PhotographerHelpChatProps = {
  chat: ReturnType<typeof usePhotographerHelpChat>;
  active: boolean;
  children?: ReactNode;
};

export function PhotographerHelpChat({ chat, active, children }: PhotographerHelpChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const messages = chat.messages.filter(message => message.sender !== 'system' && message.content.trim());
  const canSend = active && chat.canChat && !chat.sending && Boolean(chat.draft.trim());

  useEffect(() => {
    if (active && scrollRef.current) {
      scrollRef.current.scrollTop = chat.messages.length || chat.sending ? scrollRef.current.scrollHeight : 0;
    }
  }, [active, chat.messages, chat.sending]);

  return (
    <section aria-label="Ask Robbie" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {children}
        <div role="log" aria-label="Conversation with Robbie" aria-live="polite" aria-relevant="additions text" className="space-y-4 px-5 py-4 [@media(max-height:600px)]:px-4 [@media(max-height:600px)]:py-3">
        {messages.length === 0 && !chat.sending && (
          <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <ReproAiIcon className="h-7 w-7 shrink-0" />
            <p className="pt-1">Hi, I’m Robbie. What can I help you with?</p>
          </div>
        )}
        {messages.map(message => (
          <div key={message.id} className={cn('flex', message.sender === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[95%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-3 text-sm leading-relaxed [overflow-wrap:anywhere]', message.sender === 'user' ? 'bg-primary/10' : 'bg-muted/60')}>
              <span className="sr-only">{message.sender === 'user' ? 'You' : 'Robbie'}: </span>
              <ChatText content={message.content} />
            </div>
          </div>
        ))}
        {chat.sending && (
          <>
            <div className="flex justify-end"><p className="max-w-[95%] whitespace-pre-wrap break-words rounded-2xl bg-primary/10 px-3.5 py-3 text-sm [overflow-wrap:anywhere]">{chat.pendingQuestion}</p></div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><InlineSpinner className="h-3.5 w-3.5" aria-hidden="true" />Robbie is replying…</p>
          </>
        )}
        </div>
      </div>
      <div className="shrink-0 border-t border-border/60 bg-background px-5 pb-4 pt-3 [@media(max-height:600px)]:px-3 [@media(max-height:600px)]:py-2">
        {chat.permissionLoading ? (
          <p role="status" className="py-2 text-sm text-muted-foreground">Checking Robbie access…</p>
        ) : !chat.canChat ? (
          <p role="status" className="py-2 text-sm text-muted-foreground">Robbie chat isn’t available for this account. You can still watch the guides and take the dashboard tour.</p>
        ) : (
          <form onSubmit={event => { event.preventDefault(); if (canSend) void chat.send(); }}>
            {chat.error && (
              <div role="alert" className="mb-3 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm [@media(max-height:600px)]:mb-2 [@media(max-height:600px)]:flex [@media(max-height:600px)]:items-center [@media(max-height:600px)]:gap-2 [@media(max-height:600px)]:p-2 [@media(max-height:600px)]:text-xs">
                <p>{chat.error}</p>
                <Button type="button" variant="ghost" size="sm" className="mt-1 h-8 shrink-0 px-0 [@media(max-height:600px)]:mt-0" disabled={!canSend} onClick={() => void chat.send()}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Try again</Button>
              </div>
            )}
            <div className="relative">
              <Textarea
                aria-label="Ask Robbie" placeholder="Ask Robbie..." value={chat.draft}
                rows={2} maxLength={MAX_QUESTION_LENGTH} disabled={chat.sending}
                className="min-h-[72px] resize-none rounded-2xl border-border/80 bg-muted/30 pr-14 text-base sm:text-sm [@media(max-height:600px)]:h-14 [@media(max-height:600px)]:min-h-14"
                onChange={event => chat.setDraft(event.target.value)}
                onCompositionStart={() => { composingRef.current = true; }}
                onCompositionEnd={() => { composingRef.current = false; }}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey && !composingRef.current && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                    event.preventDefault();
                    if (canSend) void chat.send();
                  }
                }}
              />
              <Button type="submit" size="icon" aria-label="Send message" disabled={!canSend} className="absolute bottom-2 right-2 h-9 w-9 rounded-xl">
                {chat.sending ? <InlineSpinner className="h-4 w-4" aria-hidden="true" /> : <ArrowUp className="h-4 w-4" aria-hidden="true" />}
              </Button>
            </div>
            <p className="mt-2 hidden text-[11px] text-muted-foreground sm:block [@media(max-height:600px)]:!hidden">Enter to send · Shift + Enter for a new line</p>
          </form>
        )}
      </div>
    </section>
  );
}
