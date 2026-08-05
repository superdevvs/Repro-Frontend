import type { RefObject, UIEventHandler } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  PRIVACY_EFFECTIVE_DATE as PRIVACY_POLICY_EFFECTIVE_DATE,
  privacySections,
} from '@/content/privacyPolicy';

import { termsSections } from './registerFormModel';

interface PrivacyPolicyDialogProps {
  isMobile: boolean;
}

export function PrivacyPolicyDialog({ isMobile }: PrivacyPolicyDialogProps) {
  return (
                        <Dialog>
                          <DialogTrigger asChild>
                            <button
                              type="button"
                              className={`font-medium underline underline-offset-4 transition-colors ${
                                isMobile
                                  ? 'text-cyan-300 hover:text-cyan-200'
                                  : 'text-primary dark:text-cyan-400 dark:hover:text-cyan-300'
                              }`}
                            >
                              Privacy Policy
                            </button>
                          </DialogTrigger>
                          <DialogContent
                            className={`border-white/10 bg-[#060a0e] text-white [&>button]:hidden ${isMobile ? 'w-[calc(100vw-1rem)] max-w-none rounded-2xl p-4' : 'max-w-3xl p-6'} max-h-[85vh] flex flex-col`}
                          >
                            <DialogHeader className="space-y-2 pr-8">
                              <DialogTitle className="text-left text-xl font-semibold text-white">
                                Privacy Policy
                              </DialogTitle>
                              <DialogDescription className="text-left text-sm text-slate-400">
                                Review how R/E Pro Photos collects, uses, and protects your information across the platform.
                              </DialogDescription>
                            </DialogHeader>

                            <div className="overflow-y-auto pr-2 flex-1 min-h-0 space-y-8 text-sm leading-6 text-slate-200">
                              <section className="space-y-4">
                                <div className="space-y-2 border-b border-white/10 pb-4">
                                  <h2 className="text-lg font-semibold text-white">R/E Pro Photos Privacy Policy</h2>
                                  <p className="text-sm text-slate-400">
                                    Effective Date: {PRIVACY_POLICY_EFFECTIVE_DATE}
                                  </p>
                                  <p>
                                    R/E Pro Photos (&ldquo;R/E Pro Photos,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) respects your privacy and is committed to protecting your personal information. This Privacy Policy applies to our website, booking experience, dashboard, client portal, messaging tools, and related services (collectively, the &ldquo;Platform&rdquo;).
                                  </p>
                                  <p>
                                    By using the Platform, you agree to the terms of this Privacy Policy.
                                  </p>
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

                            <div className="mt-4 border-t border-white/10 pt-4">
                              <DialogClose asChild>
                                <Button
                                  type="button"
                                  className="w-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 text-white hover:opacity-90"
                                >
                                  Close
                                </Button>
                              </DialogClose>
                            </div>
                          </DialogContent>
                        </Dialog>
  );
}

interface TermsAgreementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canDismiss: boolean;
  isMobile: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: UIEventHandler<HTMLDivElement>;
  scrollProgress: number;
  onAgree: () => void;
}

export function TermsAgreementDialog({
  open,
  onOpenChange,
  canDismiss: canDismissTermsDialog,
  isMobile,
  scrollRef,
  onScroll,
  scrollProgress,
  onAgree,
}: TermsAgreementDialogProps) {
  return (
        <Dialog
          open={open}
          onOpenChange={(open) => {
            if (!open && !canDismissTermsDialog) {
              return;
            }
            onOpenChange(open);
          }}
        >
          <DialogContent
            onEscapeKeyDown={(event) => {
              if (!canDismissTermsDialog) {
                event.preventDefault();
              }
            }}
            onPointerDownOutside={(event) => {
              if (!canDismissTermsDialog) {
                event.preventDefault();
              }
            }}
            className={`border-white/10 bg-[#060a0e] text-white [&>button]:hidden ${isMobile ? 'w-[calc(100vw-1rem)] max-w-none rounded-2xl p-4' : 'max-w-3xl p-6'} max-h-[85vh] flex flex-col`}
          >
            <DialogHeader className="space-y-2 pr-8">
              <DialogTitle className="text-left text-xl font-semibold text-white">
                Terms and Conditions
              </DialogTitle>
              <DialogDescription className="text-left text-sm text-slate-400">
                Please review the full terms below. You can scroll through the content before continuing with registration.
              </DialogDescription>
            </DialogHeader>

            <div
              ref={scrollRef}
              onScroll={onScroll}
              className="overflow-y-auto pr-2 flex-1 min-h-0 space-y-8 text-sm leading-6 text-slate-200"
            >
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
            </div>

            <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
              {!canDismissTermsDialog ? (
                <p className="text-center text-xs text-slate-400">
                  Scroll to the bottom to unlock agreement.
                </p>
              ) : null}
              <Button
                type="button"
                disabled={!canDismissTermsDialog}
                onClick={onAgree}
                className="w-full rounded-full text-white transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:text-slate-300 disabled:opacity-100"
                style={{
                  background: canDismissTermsDialog
                    ? 'linear-gradient(90deg, rgb(59 130 246), rgb(34 211 238))'
                    : `linear-gradient(90deg, rgba(59, 130, 246, 0.9) 0%, rgba(34, 211, 238, 0.9) ${Math.max(scrollProgress * 100, 4)}%, rgba(71, 85, 105, 0.55) ${Math.max(scrollProgress * 100, 4)}%, rgba(71, 85, 105, 0.55) 100%)`,
                  boxShadow: canDismissTermsDialog
                    ? '0 10px 30px rgba(37, 99, 235, 0.28)'
                    : 'none',
                }}
              >
                Agree and Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
  );
}

