import type { RefObject } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { BookOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';
import type { AiChatRequest } from '@/types/ai';
import RobbieKnowledgePanel from './RobbieKnowledgePanel';

interface RobbieGuideDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAsk: (question: string, context: AiChatRequest['context']) => void;
  messageInputRef: RefObject<HTMLTextAreaElement | null>;
}

export function RobbieGuideDrawer({ open, onOpenChange, onAsk, messageInputRef }: RobbieGuideDrawerProps) {
  const inline = useMediaQuery('(min-width: 1280px)');
  const focusComposer = () => (messageInputRef.current || document.querySelector<HTMLButtonElement>('button[aria-controls="robbie-guides"]'))?.focus();
  if (inline) {
    if (!open) return null;
    return <aside id="robbie-guides" aria-label="Help & guides" className="sticky top-0 flex h-[calc(100dvh-8rem)] w-[380px] shrink-0 flex-col overflow-hidden rounded-xl border bg-background">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><BookOpen aria-hidden className="h-4 w-4 text-primary" />Help & guides</h2>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Close help guides" onClick={() => { onOpenChange(false); focusComposer(); }}><X aria-hidden className="h-4 w-4" /></Button>
      </header>
      <RobbieKnowledgePanel onAsk={onAsk} />
    </aside>;
  }
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[110] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <Dialog.Content id="robbie-guides" className="fixed inset-x-0 bottom-0 z-[120] flex h-[85dvh] max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-t-2xl border bg-background shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:right-0 sm:top-0 sm:h-dvh sm:max-h-dvh sm:w-[400px] sm:rounded-none" onCloseAutoFocus={(event) => { event.preventDefault(); focusComposer(); }}>
        <header className="shrink-0 border-b px-4 py-3 pr-14">
          <Dialog.Title className="flex items-center gap-2 text-sm font-semibold"><BookOpen aria-hidden className="h-4 w-4 text-primary" />Help & guides</Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">Your conversation and draft stay in Robbie.</Dialog.Description>
          <Dialog.Close asChild><Button variant="ghost" size="icon" className="absolute right-3 top-2 h-10 w-10" aria-label="Close help guides"><X aria-hidden className="h-4 w-4" /></Button></Dialog.Close>
        </header>
        <RobbieKnowledgePanel onAsk={onAsk} />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
