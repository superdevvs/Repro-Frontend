import { Link } from 'react-router-dom';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';

const PRIVACY_EFFECTIVE_DATE = 'April 16, 2026';
const CONTACT_EMAIL = 'contact@reprophotos.com';
const WEBSITE_URL = 'https://reprophotos.com';

type PrivacySubSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

type PrivacyContactItem = {
  label: string;
  value: string;
  href: string;
};

type PrivacySection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  subSections?: PrivacySubSection[];
  calloutTitle?: string;
  calloutBody?: string;
  contactItems?: PrivacyContactItem[];
};

const privacySections: PrivacySection[] = [
  {
    heading: '1. Information We Collect',
    paragraphs: [
      'We collect information you provide directly to us, information generated through your use of the Platform, and limited technical data needed to operate, secure, and improve our services.',
    ],
    subSections: [
      {
        title: 'Personal and business information',
        bullets: [
          'Name, email address, phone number, company or brokerage details, and billing contacts',
          'Property addresses, booking details, service selections, notes, and scheduling preferences',
          'Payment and invoicing information processed through our payment providers',
        ],
      },
      {
        title: 'Account, communications, and content',
        bullets: [
          'Login credentials, password reset activity, account status, and profile preferences',
          'Booking history, invoices, approvals, support requests, and communication preferences',
          'Messages, uploaded files, media assets, and information submitted through the dashboard, client portal, booking forms, and public share flows',
        ],
      },
      {
        title: 'Device and technical data',
        bullets: [
          'IP address, browser type, device type, approximate location derived from IP, and operating system information',
          'Cookies, analytics data, session logs, and platform interaction events used for security, troubleshooting, and performance monitoring',
        ],
      },
    ],
  },
  {
    heading: '2. How We Use Your Information',
    bullets: [
      'Schedule, manage, and deliver photography, video, floor plan, editing, and related real estate media services',
      'Create and manage accounts, bookings, approvals, invoices, payments, and support requests',
      'Send service-related communications by email and SMS, including reminders, updates, delivery notices, account alerts, and support responses',
      'Generate client portals, tour links, share links, and related delivery workflows that you request through the Platform',
      'Operate integrations such as payments, storage, scheduling, messaging, and analytics tools used by the Platform',
      'Maintain security, detect fraud or misuse, enforce our policies, and comply with legal obligations',
      'Improve platform usability, reliability, and service quality',
    ],
  },
  {
    heading: '3. SMS Communications and Consent',
    paragraphs: [
      'By providing your phone number through account registration, booking forms, the client portal, dashboard inputs, or other direct submissions, you consent to receive SMS or text messages from R/E Pro Photos related to your account and services.',
    ],
    subSections: [
      {
        title: 'Message types',
        bullets: [
          'Booking confirmations',
          'Appointment reminders',
          'Shoot updates',
          'Delivery notifications',
          'Payment alerts',
          'Account and security notifications',
          'Customer support responses',
        ],
      },
      {
        title: 'Frequency and charges',
        bullets: [
          'Message frequency varies based on your activity and services',
          'Standard carrier message and data rates may apply',
        ],
      },
      {
        title: 'Opt-out and help',
        bullets: [
          'Reply STOP to unsubscribe',
          'Reply HELP for assistance',
          'SMS consent is not a condition of purchase',
        ],
      },
    ],
  },
  {
    heading: '4. How We Share Information',
    paragraphs: [
      'We do not sell or rent your personal information. We share information only as needed to operate the Platform, fulfill services you request, and satisfy legal or security requirements.',
    ],
    bullets: [
      'With service providers that help us process payments, deliver email or SMS, host infrastructure, store files, manage analytics, or support platform operations',
      'With photographers, editors, contractors, or internal team members when access is needed to schedule, perform, edit, deliver, or support a booked service',
      'With public-link recipients or portal viewers when you direct us to share deliverables, media, or booking-related information through the Platform',
      'With legal, regulatory, or law-enforcement authorities when required by law or to protect rights, safety, or prevent fraud',
    ],
    calloutTitle: 'SMS Data Protection Commitment',
    calloutBody:
      'No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. This includes phone numbers, SMS opt-in data, and messaging history. Your SMS consent and data are used strictly for service-related communication.',
  },
  {
    heading: '5. Data Security',
    bullets: [
      'We use reasonable technical and organizational safeguards designed to protect personal information, including secure infrastructure, access controls, authentication, monitoring, and role-based access where appropriate.',
      'No method of transmission or storage is completely secure, so we cannot guarantee absolute security.',
    ],
  },
  {
    heading: '6. Data Retention',
    paragraphs: [
      'We retain information for as long as reasonably necessary to provide services, maintain business records, support booking history and deliverables, comply with legal obligations, resolve disputes, and enforce agreements.',
    ],
  },
  {
    heading: '7. Your Rights and Choices',
    bullets: [
      'Access or update certain account information',
      'Request deletion of your personal information, subject to legal and operational retention requirements',
      'Opt out of marketing communications',
      'Withdraw SMS consent at any time by replying STOP',
      'Control cookies through your browser settings',
    ],
    paragraphs: [
      `To make a privacy request, contact us at ${CONTACT_EMAIL}.`,
    ],
  },
  {
    heading: '8. Cookies and Tracking Technologies',
    bullets: [
      'We use cookies and similar technologies to keep the Platform working, remember preferences, analyze usage trends, and improve performance.',
      'You can manage cookie settings through your browser, though some Platform functionality may be affected if cookies are disabled.',
    ],
  },
  {
    heading: '9. Third-Party Services and Integrations',
    paragraphs: [
      'The Platform relies on third-party providers for services such as payments, file storage, messaging, scheduling, analytics, and related infrastructure. Those providers process information under their own terms and privacy policies.',
    ],
  },
  {
    heading: '10. Children’s Privacy',
    paragraphs: [
      'Our services are not directed to individuals under 18, and we do not knowingly collect personal information from children.',
    ],
  },
  {
    heading: '11. International Users',
    paragraphs: [
      'If you access the Platform from outside the United States, your information may be transferred to and processed in the United States, where data protection laws may differ from those in your jurisdiction.',
    ],
  },
  {
    heading: '12. Changes to This Privacy Policy',
    paragraphs: [
      'We may update this Privacy Policy from time to time. When we do, we will post the updated version on this page and revise the effective date. Continued use of the Platform after an update means you accept the revised policy.',
    ],
  },
  {
    heading: '13. Contact Us',
    paragraphs: [
      'If you have questions about this Privacy Policy or want to submit a privacy-related request, please contact us:',
    ],
    contactItems: [
      { label: 'Email', value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
      { label: 'Website', value: WEBSITE_URL, href: WEBSITE_URL },
    ],
  },
];

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
                  This policy explains how R/E Pro Photos collects, uses, shares, and protects information across the booking flow, dashboard, client portal, media delivery, messaging, and support experience.
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
                R/E Pro Photos, LLC (&ldquo;R/E Pro Photos,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) respects your privacy and is committed to protecting your personal information. This Privacy Policy applies to our website, booking experience, dashboard, client portal, messaging tools, and related services (collectively, the &ldquo;Platform&rdquo;).
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
