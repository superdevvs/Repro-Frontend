import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth/AuthProvider';
import { useSelfProfileSave } from '@/hooks/useSelfProfileSave';
import { useIsMobile } from '@/hooks/use-mobile';
import { privacySections, PRIVACY_EFFECTIVE_DATE as PRIVACY_POLICY_EFFECTIVE_DATE } from '@/content/privacyPolicy';
import { TERMS_EFFECTIVE_DATE, termsSections } from '@/components/auth/RegisterForm';
import { toast } from '@/lib/sonner-toast';

const requiresFirstUseAgreement = (metadata: Record<string, unknown> | undefined | null) => {
  if (!metadata) return false;
  if (metadata.terms_accepted_at || metadata.termsAcceptedAt) return false;
  return metadata.first_use_legal_agreement_required === true;
};

export function FirstLoginLegalAgreementPrompt() {
  const { user, isAuthenticated, isImpersonating } = useAuth();
  const { saveProfile } = useSelfProfileSave();
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const shouldRequireAgreement =
    isAuthenticated &&
    !isImpersonating &&
    (user?.role === 'client' || user?.role === 'photographer') &&
    requiresFirstUseAgreement(user?.metadata);

  useEffect(() => {
    if (shouldRequireAgreement) {
      setOpen(true);
      return;
    }

    setOpen(false);
  }, [shouldRequireAgreement]);

  useEffect(() => {
    if (!open) return;

    requestAnimationFrame(() => {
      const element = scrollRef.current;
      if (!element) return;
      const maxScroll = element.scrollHeight - element.clientHeight;
      const isComplete = maxScroll <= 8 || element.scrollTop >= maxScroll - 8;
      setScrollProgress(maxScroll <= 0 ? 1 : Math.min(1, element.scrollTop / maxScroll));
      setScrolledToEnd(isComplete);
    });
  }, [open]);

  const updateScrollState = () => {
    const element = scrollRef.current;
    if (!element) return;
    const maxScroll = element.scrollHeight - element.clientHeight;
    const isComplete = maxScroll <= 8 || element.scrollTop >= maxScroll - 8;
    setScrollProgress(maxScroll <= 0 ? 1 : Math.min(1, element.scrollTop / maxScroll));
    setScrolledToEnd(isComplete);
  };

  const handleAccept = async () => {
    if (!scrolledToEnd || isSaving) return;

    setIsSaving(true);
    try {
      await saveProfile({ terms_accepted: true });
      setOpen(false);
      toast.success('Terms and privacy policy accepted.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save agreement. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!shouldRequireAgreement) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) return;
        setOpen(nextOpen);
      }}
    >
      <DialogContent
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        className={`border-white/10 bg-[#060a0e] text-white [&>button]:hidden ${
          isMobile ? 'w-[calc(100vw-1rem)] max-w-none rounded-2xl p-4' : 'max-w-3xl p-6'
        } max-h-[85vh] flex flex-col`}
      >
        <DialogHeader className="space-y-2 pr-8">
          <DialogTitle className="text-left text-xl font-semibold text-white">
            Terms and Privacy Policy
          </DialogTitle>
          <DialogDescription className="text-left text-sm text-slate-400">
            Please review and accept the R/E Pro Photos Terms and Conditions and Privacy Policy before continuing.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="min-h-0 flex-1 space-y-10 overflow-y-auto pr-2 text-sm leading-6 text-slate-200"
        >
          <section className="space-y-8">
            {termsSections.map((document) => (
              <section key={document.title} className="space-y-4">
                <div className="space-y-2 border-b border-white/10 pb-4">
                  <h2 className="text-lg font-semibold text-white">{document.title}</h2>
                  {'effectiveDate' in document ? (
                    <p className="text-sm text-slate-400">Effective Date: {document.effectiveDate}</p>
                  ) : null}
                  {'intro' in document ? <p>{document.intro}</p> : null}
                </div>

                <div className="space-y-6">
                  {document.sections.map((section) => (
                    <div key={section.heading} className="space-y-3">
                      <h3 className="text-base font-semibold text-white">{section.heading}</h3>

                      {section.paragraphs?.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}

                      {section.quote ? (
                        <blockquote className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 italic text-slate-200">
                          {section.quote}
                        </blockquote>
                      ) : null}

                      {section.bullets?.length ? (
                        <ul className="space-y-2 pl-5">
                          {section.bullets.map((bullet) => (
                            <li key={bullet} className="list-disc">
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {section.subSections?.length ? (
                        <div className="space-y-4">
                          {section.subSections.map((subSection) => (
                            <div key={subSection.title} className="space-y-2">
                              <h4 className="font-medium text-white">{subSection.title}</h4>

                              {subSection.paragraphs?.map((paragraph) => (
                                <p key={paragraph}>{paragraph}</p>
                              ))}

                              {subSection.bullets?.length ? (
                                <ul className="space-y-2 pl-5">
                                  {subSection.bullets.map((bullet) => (
                                    <li key={bullet} className="list-disc">
                                      {bullet}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </section>

          <section className="space-y-4 border-t border-white/10 pt-8">
            <div className="space-y-2 border-b border-white/10 pb-4">
              <h2 className="text-lg font-semibold text-white">R/E Pro Photos Privacy Policy</h2>
              <p className="text-sm text-slate-400">Effective Date: {PRIVACY_POLICY_EFFECTIVE_DATE}</p>
              <p>
                R/E Pro Photos (&ldquo;R/E Pro Photos,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) respects your privacy and is committed to protecting your personal information. This Privacy Policy applies to our website, booking experience, dashboard, client portal, messaging tools, and related services (collectively, the &ldquo;Platform&rdquo;).
              </p>
              <p>By using the Platform, you agree to the terms of this Privacy Policy.</p>
            </div>

            <div className="space-y-6">
              {privacySections.map((section) => (
                <div key={section.heading} className="space-y-3">
                  <h3 className="text-base font-semibold text-white">{section.heading}</h3>

                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}

                  {section.bullets?.length ? (
                    <ul className="space-y-2 pl-5">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="list-disc">
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {section.subSections?.length ? (
                    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/10 p-4">
                      {section.subSections.map((subSection) => (
                        <div key={subSection.title} className="space-y-2">
                          <h4 className="font-medium text-white">{subSection.title}</h4>

                          {subSection.paragraphs?.map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                          ))}

                          {subSection.bullets?.length ? (
                            <ul className="space-y-2 pl-5">
                              {subSection.bullets.map((bullet) => (
                                <li key={bullet} className="list-disc">
                                  {bullet}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {section.calloutTitle && section.calloutBody ? (
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-4 text-slate-100">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
                        {section.calloutTitle}
                      </p>
                      <p className="mt-2">{section.calloutBody}</p>
                    </div>
                  ) : null}

                  {section.contactItems?.length ? (
                    <div className="space-y-2">
                      {section.contactItems.map((item) => (
                        <p key={item.label}>
                          <span className="font-medium text-white">{item.label}: </span>
                          <a
                            href={item.href}
                            className="text-cyan-300 underline underline-offset-4 transition-colors hover:text-cyan-200"
                          >
                            {item.value}
                          </a>
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
          {!scrolledToEnd ? (
            <p className="text-center text-xs text-slate-400">
              Scroll to the bottom to unlock agreement.
            </p>
          ) : null}
          <Button
            type="button"
            disabled={!scrolledToEnd || isSaving}
            onClick={handleAccept}
            className="w-full rounded-full text-white transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:text-slate-300 disabled:opacity-100"
            style={{
              background: scrolledToEnd
                ? 'linear-gradient(90deg, rgb(59 130 246), rgb(34 211 238))'
                : `linear-gradient(90deg, rgba(59, 130, 246, 0.9) 0%, rgba(34, 211, 238, 0.9) ${Math.max(scrollProgress * 100, 4)}%, rgba(71, 85, 105, 0.55) ${Math.max(scrollProgress * 100, 4)}%, rgba(71, 85, 105, 0.55) 100%)`,
              boxShadow: scrolledToEnd ? '0 10px 30px rgba(37, 99, 235, 0.28)' : 'none',
            }}
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving Agreement...
              </span>
            ) : (
              'Agree and Continue'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
