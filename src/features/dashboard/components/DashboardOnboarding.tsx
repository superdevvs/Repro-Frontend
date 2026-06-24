import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, PlayCircle, Send, X } from "lucide-react";

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

import type { OnboardingCopy, OnboardingStep, RoleKey } from "../config/dashboardOnboardingConfig";

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

interface DashboardOnboardingProps {
  roleKey: RoleKey;
  steps: OnboardingStep[];
  copy: OnboardingCopy;
  welcomeOpen: boolean;
  tourOpen: boolean;
  isMobile: boolean;
  currentMobileTab?: string;
  lastStep?: number;
  onStart: () => void;
  onDismiss: () => void;
  onComplete: (lastStep: number) => void;
  onProgress: (lastStep: number) => void;
  onReplay: () => void;
  onSetMobileTab?: (tab: string) => void;
  /** Telemetry: a new step was viewed (forward navigation). */
  onStepView?: (stepIndex: number, stepTarget?: string) => void;
  /** Telemetry: the user navigated back to a step. */
  onStepBack?: (stepIndex: number, stepTarget?: string) => void;
  /** Telemetry: the Robbie help panel was opened. */
  onHelpOpened?: () => void;
  /** Telemetry: the user sent a Robbie help message. */
  onHelpMessage?: () => void;
}

/**
 * Resolves the visible element for an onboarding target.
 *
 * A target id is frequently rendered in BOTH the desktop and mobile layout
 * trees, with the inactive layout hidden via `display:none`. A naive
 * `querySelector` would return the first match (often the hidden one), whose
 * `getBoundingClientRect()` is all zeros, breaking the spotlight. We therefore
 * scan every match and return the first one that is actually laid out.
 */
export const getVisibleTargetElement = (target: string): Element | null => {
  if (typeof window === "undefined") return null;

  const elements = Array.from(
    document.querySelectorAll(`[data-onboarding-target=\"${target}\"]`),
  );
  if (elements.length === 0) return null;

  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return element;
    }
  }

  return null;
};

export const getTargetRect = (target: string): TargetRect | null => {
  const element = getVisibleTargetElement(target);
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

export const DashboardOnboarding: React.FC<DashboardOnboardingProps> = ({
  roleKey,
  steps,
  copy,
  welcomeOpen,
  tourOpen,
  isMobile,
  currentMobileTab,
  lastStep,
  onStart,
  onDismiss,
  onComplete,
  onProgress,
  onReplay,
  onSetMobileTab,
  onStepView,
  onStepBack,
  onHelpOpened,
  onHelpMessage,
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
  const cardRef = useRef<HTMLDivElement | null>(null);
  const currentStep = steps[activeStep];
  const progress = useMemo(() => ((activeStep + 1) / steps.length) * 100, [activeStep, steps.length]);
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

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
      onSetMobileTab?.(mobileTab);
    }
  }, [currentMobileTab, currentStep.mobileTab, isMobile, onSetMobileTab, tourOpen]);

  useEffect(() => {
    if (!tourOpen) return;

    let cancelled = false;
    let frame = 0;
    let attempt = 0;
    let settleTimer = 0;
    // Retry budget (~2.4s) before treating a target as unrenderable. This covers
    // lazy/Suspense cards and tab switches without stranding the user.
    const maxAttempts = 24;

    const settle = () => {
      if (cancelled) return;

      const rect = getTargetRect(currentStep.target);
      if (rect) {
        setTargetRect(rect);
        return;
      }

      attempt += 1;
      if (attempt <= maxAttempts) {
        settleTimer = window.setTimeout(settle, 100);
        return;
      }

      // Target never rendered (permission-hidden card, empty state, or a layout
      // that doesn't include this step). Don't leave a broken spotlight: skip
      // forward, or finish if this was the last step.
      setTargetRect(null);
      if (activeStep < steps.length - 1) {
        const nextStep = activeStep + 1;
        setActiveStep(nextStep);
        onProgress(nextStep);
        onStepView?.(nextStep, steps[nextStep]?.target);
      }
    };

    const updateRect = () => {
      window.clearTimeout(settleTimer);
      attempt = 0;
      frame = window.requestAnimationFrame(() => {
        if (cancelled) return;
        const element = getVisibleTargetElement(currentStep.target);
        element?.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: prefersReducedMotion ? "auto" : "smooth",
        });
        settleTimer = window.setTimeout(settle, prefersReducedMotion ? 0 : 180);
      });
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [currentStep.target, tourOpen, activeStep, steps.length, steps, onProgress, onStepView, prefersReducedMotion]);

  const handleNext = () => {
    if (activeStep >= steps.length - 1) {
      onComplete(activeStep);
      return;
    }

    const nextStep = activeStep + 1;
    setActiveStep(nextStep);
    onProgress(nextStep);
    onStepView?.(nextStep, steps[nextStep]?.target);
  };

  const handleBack = () => {
    const nextStep = Math.max(0, activeStep - 1);
    setActiveStep(nextStep);
    onProgress(nextStep);
    onStepBack?.(nextStep, steps[nextStep]?.target);
  };

  const handleReplay = () => {
    setActiveStep(0);
    onReplay();
  };

  const handleToggleHelp = () => {
    if (!helpOpen) onHelpOpened?.();
    setHelpOpen((open) => !open);
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
    onHelpMessage?.();

    try {
      const response = await sendAiMessage({
        sessionId: helpSessionId,
        message: trimmedMessage,
        context: {
          mode: "general",
          page: `${roleKey}_dashboard`,
          source: `${roleKey}_dashboard_onboarding`,
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

  // Keyboard navigation for the tour: Escape closes, arrows move between steps.
  useEffect(() => {
    if (!tourOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't hijack typing inside the Robbie help input.
      const tag = (event.target as HTMLElement | null)?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA";

      if (event.key === "Escape") {
        event.preventDefault();
        onComplete(activeStep);
        return;
      }

      if (isTyping) return;

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (activeStep >= steps.length - 1) {
          onComplete(activeStep);
        } else {
          const nextStep = activeStep + 1;
          setActiveStep(nextStep);
          onProgress(nextStep);
          onStepView?.(nextStep, steps[nextStep]?.target);
        }
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        const prevStep = Math.max(0, activeStep - 1);
        setActiveStep(prevStep);
        onProgress(prevStep);
        onStepBack?.(prevStep, steps[prevStep]?.target);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tourOpen, activeStep, steps.length, steps, onComplete, onProgress, onStepView, onStepBack]);

  // Move focus to the step card when the tour opens / advances so keyboard and
  // screen-reader users land on the active instruction.
  useEffect(() => {
    if (!tourOpen) return;
    const node = cardRef.current;
    if (!node) return;
    const frame = window.requestAnimationFrame(() => node.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [tourOpen, activeStep]);

  return (
    <>
      <Dialog open={welcomeOpen} onOpenChange={(open) => { if (!open) onDismiss(); }}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-xl rounded-2xl p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-primary/15 via-background to-background p-5 sm:p-6">
            <DialogHeader className="text-left space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shadow-lg">
                <img src="/REPRO-HQ-icon.png" alt="R/E Pro Photos" className="h-9 w-9 object-contain" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl">{copy.welcomeTitle}</DialogTitle>
                <DialogDescription className="mt-2 text-sm sm:text-base">
                  {copy.welcomeDescription}
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="mt-5 grid gap-2">
              {copy.checklistItems.map((item) => (
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
              className={cn(
                "absolute rounded-2xl border-2 border-primary bg-primary/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.58)]",
                !prefersReducedMotion && "transition-all duration-200",
              )}
              style={{
                top: Math.max(8, targetRect.top - 8),
                left: Math.max(8, targetRect.left - 8),
                width: targetRect.width + 16,
                height: targetRect.height + 16,
              }}
            />
          )}

          <div
            ref={cardRef}
            role="dialog"
            aria-modal="false"
            aria-labelledby="onboarding-step-title"
            aria-describedby="onboarding-step-description"
            tabIndex={-1}
            className={cn("pointer-events-auto fixed rounded-2xl border border-border bg-background p-4 shadow-2xl outline-none", getCardPositionClass(targetRect, isMobile))}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary" aria-live="polite">Step {activeStep + 1} of {steps.length}</p>
                <h3 id="onboarding-step-title" className="mt-1 text-lg font-bold text-foreground">{currentStep.title}</h3>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onComplete(activeStep)}>
                <X className="h-4 w-4" />
                <span className="sr-only">Close tour</span>
              </Button>
            </div>
            <p id="onboarding-step-description" className="mt-2 text-sm leading-relaxed text-muted-foreground">{currentStep.description}</p>
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
                <form
                  className="flex items-center gap-2 border-t border-border p-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleHelpSubmit();
                  }}
                >
                  <label htmlFor="onboarding-help-input" className="sr-only">
                    Ask Robbie about this tour
                  </label>
                  <input
                    id="onboarding-help-input"
                    value={helpMessage}
                    onChange={(event) => setHelpMessage(event.target.value)}
                    placeholder="Ask Robbie..."
                    className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <Button type="submit" size="icon" className="h-9 w-9" disabled={helpSending || !helpMessage.trim()}>
                    {helpSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span className="sr-only">Send message</span>
                  </Button>
                </form>
              </div>
            )}
            <Button className="gap-2 rounded-full shadow-2xl" onClick={handleToggleHelp}>
              <ReproAiIcon className="h-4 w-4" />
              Help
            </Button>
          </div>
        </div>
      )}
    </>
  );
};
