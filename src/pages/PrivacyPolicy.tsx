import { Link } from 'react-router-dom';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { PRIVACY_EFFECTIVE_DATE, privacySections } from '@/content/privacyPolicy';

export default function PrivacyPolicy() {
  return (
    <div className="h-screen overflow-y-auto bg-[#060a0e] text-white">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_24px_60px_rgba(1,3,9,0.45)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-4">
              <Logo className="h-[34px] w-auto" variant="light" />
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.18em] text-cyan-300/80">Legal</p>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Privacy Policy</h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  This policy explains how LaDexon Photographie & Motion Films LLC dba R/E Pro Photos collects, uses, shares, and protects information across the booking flow, dashboard, client portal, media delivery, messaging, and support experience.
                </p>
                <p className="text-sm text-slate-400">Effective Date: {PRIVACY_EFFECTIVE_DATE}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:w-auto sm:items-end">
              <Button asChild className="rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 text-white hover:opacity-90">
                <Link to="/">Back to Home</Link>
              </Button>
              <Link
                to="/terms-and-conditions"
                className="text-sm font-medium text-cyan-300 transition-colors hover:text-cyan-200"
              >
                View Terms and Conditions
              </Link>
            </div>
          </div>
        </header>

        <main className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_24px_60px_rgba(1,3,9,0.35)] backdrop-blur-xl sm:p-8">
          <div className="space-y-8 text-sm leading-7 text-slate-200 sm:text-[15px]">
            <section className="space-y-3 border-b border-white/10 pb-5">
              <h2 className="text-2xl font-semibold text-white">R/E Pro Photos Privacy Policy</h2>
              <p>
                R/E Pro Photos (&ldquo;R/E Pro Photos,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) respects your privacy and is committed to protecting your personal information. This Privacy Policy applies to our website, booking experience, dashboard, client portal, messaging tools, and related services (collectively, the &ldquo;Platform&rdquo;).
              </p>
              <p>
                By using the Platform, you agree to the terms of this Privacy Policy.
              </p>
            </section>

            {privacySections.map((section) => (
              <section key={section.heading} className="space-y-4">
                <h3 className="text-lg font-semibold text-white">{section.heading}</h3>

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
                  <div className="space-y-5 rounded-2xl border border-white/10 bg-black/10 p-4 sm:p-5">
                    {section.subSections.map((subSection) => (
                      <div key={subSection.title} className="space-y-2">
                        <h4 className="text-base font-medium text-white">{subSection.title}</h4>

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
              </section>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
