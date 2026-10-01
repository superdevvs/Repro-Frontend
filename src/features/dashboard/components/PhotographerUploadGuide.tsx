import { useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { photographerUploadGuide as guide } from "../config/photographerUploadGuide";

interface PhotographerUploadGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PhotographerUploadGuide({ open, onOpenChange }: PhotographerUploadGuideProps) {
  const [videoFailed, setVideoFailed] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto rounded-2xl p-4 sm:p-6"
        onEscapeKeyDown={(event) => {
          // Radix closes during capture. Keep the same Escape from reaching the
          // tour's window shortcut if closing synchronously restores it.
          event.stopPropagation();
        }}
        onOpenAutoFocus={() => {
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setVideoFailed(false);
        }}
        onCloseAutoFocus={(event) => {
          if (returnFocusRef.current?.isConnected) {
            event.preventDefault();
            returnFocusRef.current.focus();
          }
        }}
      >
        <DialogHeader className="pr-6 text-left">
          <DialogTitle>{guide.title}</DialogTitle>
          <DialogDescription>
            A quick walkthrough with voiceover and English captions. Play the video when you’re ready.
          </DialogDescription>
        </DialogHeader>
        <video
          aria-label={guide.title}
          src={guide.video}
          className="aspect-video w-full rounded-xl bg-black"
          controls
          playsInline
          preload="metadata"
          poster={guide.poster}
          onError={() => setVideoFailed(true)}
        >
          <track kind="captions" src={guide.captions} srcLang="en" label="English" default />
          Your browser cannot play this video. Read the transcript below.
        </video>
        {videoFailed && (
          <p role="status" className="rounded-lg bg-muted p-3 text-sm">
            The video couldn’t load. You can read the transcript below or try again later.
          </p>
        )}
        <details open={videoFailed} className="rounded-xl border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Read the transcript
          </summary>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
            {guide.transcript.map((section) => (
              <section key={section.title}>
                <h3 className="font-medium text-foreground">{section.title}</h3>
                <p className="mt-1">{section.text}</p>
              </section>
            ))}
          </div>
        </details>
      </DialogContent>
    </Dialog>
  );
}
