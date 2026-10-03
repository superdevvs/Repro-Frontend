import { useRef } from 'react';
import { createPortal } from 'react-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, Compass, Play, X } from 'lucide-react';
import { ReproAiIcon } from '@/components/icons/ReproAiIcon';
import { cn } from '@/lib/utils';
import { photographerUploadGuide } from '../config/photographerUploadGuide';
import { PhotographerHelpChat, type usePhotographerHelpChat } from './PhotographerHelpChat';
import type { PhotographerGuideId, PhotographerHelpState } from './photographerHelpContext';

interface PhotographerHelpHubProps {
  active: PhotographerHelpState;
  tourActive: boolean;
  bottomInset: number;
  onOpen: () => void;
  onClose: () => void;
  onGuide: (guide: PhotographerGuideId) => void;
  onTour: () => void;
  chat: ReturnType<typeof usePhotographerHelpChat>;
}

const guides = [
  { id: 'uploads' as const, title: 'Upload shoot media', description: 'Photos, RAW files and video', poster: photographerUploadGuide.poster },
  { id: 'cubicasa' as const, title: 'CubiCasa floor plans', description: 'Scan and upload from your Draft', poster: '/tutorials/cubicasa-guide.jpg?v=20261003-plus-1' },
];

export function PhotographerHelpHub({ active, tourActive, bottomInset, onOpen, onClose, onGuide, onTour, chat }: PhotographerHelpHubProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panelTitle = useRef<HTMLHeadingElement>(null);
  const bottom = bottomInset > 0 ? `${bottomInset + 16}px` : 'calc(1rem + env(safe-area-inset-bottom))';
  const panelBottom = bottomInset > 0 ? `${bottomInset + 16}px` : 'calc(1rem + env(safe-area-inset-bottom))';

  return <>
    {createPortal(<button ref={trigger} type="button" onClick={onOpen}
      data-onboarding-target="photographer-help-hub" aria-haspopup="dialog" aria-expanded={active === 'library'}
      aria-controls={active === 'library' ? 'photographer-help-panel' : undefined}
      aria-hidden={active !== null || undefined} tabIndex={active ? -1 : 0}
      style={{ bottom }}
      className={cn('fixed right-4 flex h-14 items-center gap-2.5 rounded-full border border-blue-500/50 bg-gradient-to-r from-background via-background to-blue-50 pl-3 pr-5 text-base font-medium text-foreground shadow-lg shadow-blue-950/10 transition hover:border-blue-400 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none dark:to-blue-950/80 sm:right-6', tourActive ? 'z-[80]' : 'z-40', active && 'pointer-events-none invisible')}>
      <ReproAiIcon className="block h-8 w-8 shrink-0 -translate-y-px" />
      <span className="leading-none">Need help?</span>
    </button>, document.body)}
    <Dialog.Root open={active === 'library'} onOpenChange={open => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-slate-950/25 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content id="photographer-help-panel" aria-describedby="photographer-help-description"
          style={{ bottom: panelBottom, maxHeight: `calc(100dvh - ${Math.max(bottomInset, 0) + 32}px - env(safe-area-inset-top))` }}
          className="fixed right-3 z-[70] flex h-[min(720px,calc(100dvh-2rem))] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-[1.75rem] border border-primary/25 bg-background text-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-4 motion-reduce:animate-none sm:right-6 sm:w-[410px]"
          onOpenAutoFocus={event => { event.preventDefault(); panelTitle.current?.focus(); }}
          onCloseAutoFocus={event => { event.preventDefault(); if (active === null) trigger.current?.focus(); }}
          onEscapeKeyDown={event => event.stopPropagation()}>
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-5 py-5 [@media(max-height:600px)]:px-4 [@media(max-height:600px)]:py-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-1.5 [@media(max-height:600px)]:p-1"><ReproAiIcon className="h-9 w-9 [@media(max-height:600px)]:h-7 [@media(max-height:600px)]:w-7" /></div>
              <div>
                <Dialog.Title ref={panelTitle} tabIndex={-1} className="text-lg font-semibold tracking-tight outline-none [@media(max-height:600px)]:pt-1 [@media(max-height:600px)]:text-base">How can we help?</Dialog.Title>
                <Dialog.Description id="photographer-help-description" className="mt-0.5 text-xs text-muted-foreground [@media(max-height:600px)]:sr-only">Your guides and Robbie, in one place.</Dialog.Description>
              </div>
            </div>
            <Dialog.Close className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Close help panel"><X className="h-4 w-4" /></Dialog.Close>
          </header>
          <PhotographerHelpChat chat={chat} active={active === 'library'}>
          <div className="space-y-2 border-b border-border/60 p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Quick guides</p>
            {guides.map(guide => <button key={guide.id} type="button" onClick={() => onGuide(guide.id)} className="group flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 p-2.5 text-left transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <span className="relative h-14 w-[88px] shrink-0 overflow-hidden rounded-xl bg-slate-900">
                <img src={guide.poster} alt="" className="h-full w-full object-cover opacity-75" />
                <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-black/25 text-white"><Play className="ml-0.5 h-3 w-3 fill-current" /></span></span>
              </span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{guide.title}</span><span className="mt-1 block text-xs leading-4 text-muted-foreground">{guide.description}</span></span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
            </button>)}
            <button type="button" onClick={onTour} className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-3 text-left text-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Compass className="h-5 w-5 text-primary" /><span className="flex-1 font-medium">Dashboard tour</span><ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" /></button>
          </div>
          </PhotographerHelpChat>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
