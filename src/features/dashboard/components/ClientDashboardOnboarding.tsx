import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, HelpCircle, Loader2, PlayCircle, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ReproAiIcon } from "@/components/icons/ReproAiIcon";
import { cn } from "@/lib/utils";
import { sendAiMessage } from "@/services/aiService";

import type { MobileClientDashboardTab } from "../types";

type OnboardingStep = {
  title: string;
  description: string;
  target: string;
  mobileTab?: MobileClientDashboardTab;
};

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type MiniRobbieMessage = {
  id: string;
  sender: "user" | "assistant";
  content: string;
};

interface ClientDashboardOnboardingProps {
  welcomeOpen: boolean;
  tourOpen: boolean;
  isMobile: boolean;
  currentMobileTab: MobileClientDashboardTab;
  lastStep?: number;
  showReplay: boolean;
  onStart: () => void;
  onDismiss: () => void;
  onComplete: (lastStep: number) => void;
  onProgress: (lastStep: number) => void;
  onReplay: () => void;
  onSetMobileTab: (tab: MobileClientDashboardTab) => void;
}

const steps: OnboardingStep[] = [
  {
    title: "Start with your snapshot",
    description: "These cards summarize your active shoots, delivered media, items on hold, and payment status at a glance.",
    target: "client-dashboard-metrics",
  },
  {
    title: "Track every shoot",
    description: "Use Shoots to view scheduled jobs, open shoot details, download delivered media, rebook, or complete payment when needed.",
    target: "client-dashboard-shoots",
    mobileTab: "shoots",
  },
  {
    title: "Follow requests",
    description: "Use the Requests button in the top-right of My shoots to see the active request count and open Request Manager.",
    target: "client-dashboard-requests",
    mobileTab: "shoots",
  },
  {
    title: "Manage invoices",
    description: "Invoices keeps due-now, upcoming, and paid balances together with quick payment actions.",
    target: "client-dashboard-invoices",
    mobileTab: "invoices",
  },
  {
    title: "Open shoot details for more",
    description: "Select a shoot to find media, requests, tour links, settings like Private Exclusive and timezone, and activity history.",
    target: "client-dashboard-shoots",
    mobileTab: "shoots",
  },
];

const checklistItems = [
  "Find scheduled and delivered shoots",
  "Download media and open shoot details",
  "Check active requests and revision status",
  "Review invoices and pay balances",
];

const getTargetRect = (target: string): TargetRect | null => {
  if (typeof window === "undefined") return null;

  const element = document.querySelector(`[data-onboarding-target=\"${target}\"]`);
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
};

const getCardPositionClass = (rect: TargetRect | null, isMobile: boolean) => {
  if (isMobile || !rect) return "left-3 right-3 bottom-[calc(1rem+env(safe-area-inset-bottom))]";

  const hasRoomBelow = rect.top + rect.height + 260 < window.innerHeight;
  const hasRoomRight = rect.left + rect.width + 380 < window.innerWidth;

  if (hasRoomRight) return "top-1/2 -translate-y-1/2 right-8 w-[360px]";
  if (hasRoomBelow) return "left-1/2 -translate-x-1/2 bottom-8 w-[420px]";
  return "left-1/2 -translate-x-1/2 top-8 w-[420px]";
};

export const ClientDashboardOnboarding: React.FC<ClientDashboardOnboardingProps> = ({
  welcomeOpen,
  tourOpen,
  isMobile,
  currentMobileTab,
  lastStep,
  showReplay,
  onStart,
  onDismiss,
  onComplete,
  onProgress,
  onReplay,
  onSetMobileTab,
}) => {
  const getSafeStep = (step?: number) => (typeof step === "number" && step >= 0 && step < steps.length ? step : 0);
  const [activeStep, setActiveStep] = useState(() => getSafeStep(lastStep));
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpMessage, setHelpMessage] = useState("");
  const [helpMessages, setHelpMessages] = useState<MiniRobbieMessage[]>([
    {
      id: "welcome",
      sender: "assistant",
      content: "Hi, I’m Robbie. Ask me anything about this dashboard tour.",
    },
  ]);
  const [helpSessionId, setHelpSessionId] = useState<string | null>(null);
  const [helpSending, setHelpSending] = useState(false);
  const wasTourOpenRef = useRef(false);
  const currentStep = steps[activeStep];
  const progress = useMemo(() => ((activeStep + 1) / steps.length) * 100, [activeStep]);

  useEffect(() => {
    if (tourOpen && !wasTourOpenRef.current) {
      setActiveStep(getSafeStep(lastStep));
    }

    wasTourOpenRef.current = tourOpen;
  }, [lastStep, tourOpen]);

  useEffect(() => {
    if (!tourOpen) return;

    const mobileTab = currentStep.mobileTab;
    if (isMobile && mobileTab && mobileTab !== currentMobileTab) {
      onSetMobileTab(mobileTab);
    }
  }, [currentMobileTab, currentStep.mobileTab, isMobile, onSetMobileTab, tourOpen]);

  useEffect(() => {
    if (!tourOpen) return;

    let frame = 0;

    const updateRect = () => {
      frame = window.requestAnimationFrame(() => {
        const element = document.querySelector(`[data-onboarding-target=\"${currentStep.target}\"]`);
        element?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        setTimeout(() => setTargetRect(getTargetRect(currentStep.target)), 180);
      });
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [currentStep.target, tourOpen]);

  const handleNext = () => {
    if (activeStep >= steps.length - 1) {
      onComplete(activeStep);
      return;
    }

    const nextStep = activeStep + 1;
    setActiveStep(nextStep);
    onProgress(nextStep);
  };

  const handleBack = () => {
    const nextStep = Math.max(0, activeStep - 1);
    setActiveStep(nextStep);
    onProgress(nextStep);
  };

  const handleReplay = () => {
    setActiveStep(0);
    onReplay();
  };

  const handleStart = () => {
    setActiveStep(0);
    onStart();
  };

  const handleHelpSubmit = async () => {
    const trimmedMessage = helpMessage.trim();
    if (!trimmedMessage || helpSending) return;

    const userMessage: MiniRobbieMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      content: trimmedMessage,
    };

    setHelpMessages((current) => [...current, userMessage]);
    setHelpMessage("");
    setHelpSending(true);

    try {
      const response = await sendAiMessage({
        sessionId: helpSessionId,
        message: trimmedMessage,
        context: {
          mode: "general",
          page: "client_dashboard",
          source: "client_dashboard_onboarding",
          tab: currentStep.mobileTab ?? "overview",
          intent: "dashboard_onboarding_help",
        },
      });

      setHelpSessionId(response.sessionId);

      const assistantMessage = [...response.messages].reverse().find((message) => message.sender === "assistant");
      setHelpMessages((current) => [
        ...current,
        {
          id: assistantMessage?.id ?? `assistant-${Date.now()}`,
          sender: "assistant",
          content: assistantMessage?.content || "I can help explain where to find shoots, requests, invoices, and media.",
        },
      ]);
    } catch {
      setHelpMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          sender: "assistant",
          content: "I couldn’t reach Robbie right now. Try again in a moment.",
        },
      ]);
    } finally {
      setHelpSending(false);
    }
  };

  return (
    <>
      {showReplay && !welcomeOpen && !tourOpen && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 rounded-full text-xs sm:text-sm"
          onClick={handleReplay}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Take tour
        </Button>
      )}

      <Dialog open={welcomeOpen} onOpenChange={(open) => { if (!open) onDismiss(); }}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-xl rounded-2xl p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-primary/15 via-background to-background p-5 sm:p-6">
            <DialogHeader className="text-left space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shadow-lg">
                <img src="/REPRO-HQ-icon.png" alt="R/E Pro Photos" className="h-9 w-9 object-contain" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl">Welcome to your client dashboard</DialogTitle>
                <DialogDescription className="mt-2 text-sm sm:text-base">
                  Learn where to find shoots, requests, invoices, delivered media, and shoot details in under a minute.
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="mt-5 grid gap-2">
              {checklistItems.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Button className="gap-2" onClick={handleStart}>
                <PlayCircle className="h-4 w-4" />
                Start tour
              </Button>
              <Button variant="outline" onClick={onDismiss}>Skip for now</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {tourOpen && (
        <div className="fixed inset-0 z-[75] pointer-events-none">
          <div className="absolute inset-0 bg-black/65" />
          {targetRect && (
            <div
              className="absolute rounded-2xl border-2 border-primary bg-primary/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.58)] transition-all duration-200"
              style={{
                top: Math.max(8, targetRect.top - 8),
                left: Math.max(8, targetRect.left - 8),
                width: targetRect.width + 16,
                height: targetRect.height + 16,
              }}
            />
          )}

          <div className={cn("pointer-events-auto fixed rounded-2xl border border-border bg-background p-4 shadow-2xl", getCardPositionClass(targetRect, isMobile))}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Step {activeStep + 1} of {steps.length}</p>
                <h3 className="mt-1 text-lg font-bold text-foreground">{currentStep.title}</h3>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onComplete(activeStep)}>
                <X className="h-4 w-4" />
                <span className="sr-only">Close tour</span>
              </Button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{currentStep.description}</p>
            <Progress value={progress} className="mt-4 h-2" />
            <div className="mt-4 flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleBack} disabled={activeStep === 0}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button size="sm" className="gap-2" onClick={handleNext}>
                {activeStep >= steps.length - 1 ? "Finish" : "Next"}
                {activeStep < steps.length - 1 && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="pointer-events-auto fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-2">
            {helpOpen && (
              <div className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <ReproAiIcon className="h-5 w-5" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Robbie help</p>
                      <p className="text-[11px] text-muted-foreground">Ask about this tour</p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setHelpOpen(false)}>
                    <X className="h-3.5 w-3.5" />
                    <span className="sr-only">Close Robbie help</span>
                  </Button>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto p-3">
                  {helpMessages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "rounded-2xl px-3 py-2 text-xs leading-relaxed",
                        message.sender === "user"
                          ? "ml-8 bg-primary text-primary-foreground"
                          : "mr-8 bg-muted text-foreground"
                      )}
                    >
                      {message.content}
                    </div>
                  ))}
                  {helpSending && (
                    <div className="mr-8 flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Robbie is typing
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 border-t border-border p-2">
                  <input
                    value={helpMessage}
                    onChange={(event) => setHelpMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleHelpSubmit();
                      }
                    }}
                    placeholder="Ask Robbie..."
                    className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <Button size="icon" className="h-9 w-9" onClick={() => void handleHelpSubmit()} disabled={helpSending || !helpMessage.trim()}>
                    {helpSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span className="sr-only">Send message</span>
                  </Button>
                </div>
              </div>
            )}
            <Button className="gap-2 rounded-full shadow-2xl" onClick={() => setHelpOpen((open) => !open)}>
              <ReproAiIcon className="h-4 w-4" />
              Help
            </Button>
          </div>
        </div>
      )}
    </>
  );
};
