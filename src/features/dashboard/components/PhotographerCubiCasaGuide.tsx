import { useCallback, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { photographerCubiCasaGuide as guide } from "../config/photographerCubiCasaGuide";

interface PhotographerCubiCasaGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PhotographerCubiCasaGuide({ open, onOpenChange }: PhotographerCubiCasaGuideProps) {
  const [chapter, setChapter] = useState("scan");
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    // Radix can mount tab contents after parent effects run. Track the actual
    // node so removing a chapter or closing the guide always stops playback.
    if (videoRef.current && videoRef.current !== node) videoRef.current.pause();
    videoRef.current = node;
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto rounded-2xl p-4 sm:p-6"
        onEscapeKeyDown={(event) => event.stopPropagation()}
        onOpenAutoFocus={() => {
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setChapter("scan");
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
            Start with CubiCasa’s scanning lesson, then follow your REPro draft order through submission.
          </DialogDescription>
        </DialogHeader>

        {open && (
          <Tabs value={chapter} onValueChange={setChapter} className="min-w-0 space-y-4">
            <TabsList aria-label="CubiCasa guide chapters" className="grid h-auto w-full grid-cols-2">
              <TabsTrigger value="scan" className="whitespace-normal text-center">1. How to scan</TabsTrigger>
              <TabsTrigger value="draft" className="whitespace-normal text-center">2. Your REPro order</TabsTrigger>
            </TabsList>
            <TabsContent value="scan" className="space-y-4">
              {chapter === "scan" && (
                <iframe
                  title={guide.officialTitle}
                  src={guide.officialEmbed}
                  className="aspect-video w-full rounded-xl border-0 bg-black"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              )}
              <p className="text-sm leading-relaxed text-muted-foreground">
                Official scanning video by CubiCasa. Use the player’s captions when available.{' '}
                <a href={guide.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline underline-offset-4">
                  Watch on YouTube <ExternalLink aria-hidden="true" className="h-3 w-3" />
                </a>
              </p>
              <Button className="w-full sm:w-auto" onClick={() => setChapter("draft")}>
                Continue to your REPro order <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
              </Button>
            </TabsContent>
            <TabsContent value="draft" className="space-y-4">
              {chapter === "draft" && (
                <video
                  ref={setVideoRef}
                  aria-label="Your REPro draft order walkthrough"
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
              )}
              <p className="text-sm text-muted-foreground">Play the walkthrough when you’re ready. English captions are included.</p>
              {videoFailed && (
                <p role="status" className="rounded-lg bg-muted p-3 text-sm">
                  The walkthrough couldn’t load. Read the transcript below or try again later.
                </p>
              )}
              <details open={videoFailed} className="rounded-xl border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Read the REPro walkthrough transcript
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
            </TabsContent>
          </Tabs>
        )}

        <Button variant="ghost" className="w-fit" onClick={() => onOpenChange(false)}>
          <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" /> Back to help
        </Button>
      </DialogContent>
    </Dialog>
  );
}
