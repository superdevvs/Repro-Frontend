import { Link } from 'react-router-dom';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';

const termsSections = [
  {
    title: 'R/E Pro Photos – Client Terms & Conditions (With SMS Consent)',
    effectiveDate: '[Insert Date]',
    intro:
      'By booking, scheduling, or using the R/E Pro Photos platform (“Platform”), you agree to the following Terms & Conditions.',
    sections: [
      {
        heading: '1. Definitions',
        bullets: [
          '“Company” refers to R/E Pro Photos, LLC',
          '“Client” or “You” refers to the individual, agent, brokerage, or entity booking services',
          '“Property” refers to the real estate listed in your booking',
          '“Work” refers to all media produced, including photos, videos, 3D tours, floor plans, and derivative content',
          'You confirm you are authorized to book services and bind the property owner where applicable.',
        ],
      },
      {
        heading: '2. Payment Terms',
        bullets: [
          'Payment is due at the time of booking, unless otherwise agreed.',
          'Services and deliverables may be withheld until full payment is received.',
          'Usage rights are granted only after full payment.',
          'Unpaid shoots may display watermarked media.',
        ],
      },
      {
        heading: '3. Scheduling, Changes & Cancellations',
        bullets: [
          'Changes or cancellations made 24 or more hours prior incur no fee.',
          'Less than 24 hours may result in a cancellation or rescheduling fee.',
          'Property must be camera-ready at the scheduled time.',
          'R/E Pro Photos may reschedule if the property is not ready or accessible.',
          'R/E Pro Photos may cancel and charge a service fee if conditions prevent completion.',
        ],
      },
      {
        heading: '4. Ownership & Copyright',
        bullets: [
          'All Work remains the exclusive intellectual property of R/E Pro Photos.',
          'The Company retains full copyright ownership.',
          'The Company retains rights to reproduce, distribute, and license content.',
          'The Company retains rights to use Work for marketing, portfolio, and promotional purposes.',
          'No ownership rights transfer to the Client.',
        ],
      },
      {
        heading: '5. Usage License (Client)',
        paragraphs: [
          'Upon full payment, you receive a non-exclusive, non-transferable, limited license to use the Work for marketing the Property, promoting your real estate business, and MLS and listing platforms.',
        ],
        bullets: [
          'No resale, sublicensing, or redistribution.',
          'No AI training or derivative commercial usage.',
          'License ends when the listing is no longer active.',
        ],
      },
      {
        heading: '6. SMS Consent & Communications (Twilio-Compliant)',
        paragraphs: [
          'By providing your phone number through the Platform, including booking forms, account registration, or direct input, you expressly consent to receive SMS or text messages from R/E Pro Photos.',
        ],
        subSections: [
          {
            title: 'Types of Messages You May Receive',
            bullets: [
              'Booking confirmations',
              'Appointment reminders',
              'Shoot status updates',
              'Delivery notifications',
              'Payment alerts',
              'Account and security notifications',
              'Customer support responses',
            ],
          },
          {
            title: 'Message Frequency',
            paragraphs: ['Varies depending on your activity, typically 1 to 10 messages per booking lifecycle.'],
          },
          {
            title: 'Message & Data Rates',
            paragraphs: ['Standard carrier message and data rates may apply.'],
          },
          {
            title: 'Opt-Out Instructions',
            bullets: ['Reply STOP to unsubscribe from SMS.', 'Reply HELP to receive assistance.'],
          },
          {
            title: 'Important Disclosures',
            bullets: [
              'SMS consent is not a condition of purchase.',
              'Your phone number will not be sold or shared with third parties for marketing.',
              'Messages are strictly service-related unless separately opted into marketing.',
            ],
          },
        ],
      },
      {
        heading: '7. How SMS Consent is Collected',
        paragraphs: [
          'Consent is obtained through explicit user action, including booking forms, account registration, and dashboard inputs.',
          'Users must agree via checkbox or similar action confirming the following statement:',
        ],
        quote:
          'I agree to receive SMS notifications from R/E Pro Photos regarding my bookings, appointments, and account updates. Message and data rates may apply. Reply STOP to unsubscribe.',
        bullets: ['Consent is logged with timestamp and user details.'],
      },
      {
        heading: '8. Releases & Permissions',
        bullets: [
          'You have authority to photograph the Property.',
          'All necessary permissions from owners, tenants, and occupants are obtained.',
          'No unauthorized copyrighted or restricted materials are included.',
          'You agree to indemnify R/E Pro Photos from related claims.',
        ],
      },
      {
        heading: '9. Limitation of Liability',
        bullets: [
          'R/E Pro Photos is not liable for weather conditions.',
          'R/E Pro Photos is not liable for property readiness issues.',
          'R/E Pro Photos is not liable for access limitations.',
          'R/E Pro Photos is not liable for minor editing variations.',
          'R/E Pro Photos is not liable for third-party platform compression.',
          'Maximum liability is limited to the amount paid for the service.',
        ],
      },
      {
        heading: '10. Indemnification',
        bullets: [
          'You agree to indemnify and hold harmless R/E Pro Photos and its team from claims arising from breach of these Terms.',
          'You agree to indemnify and hold harmless R/E Pro Photos and its team from misuse of content.',
          'You agree to indemnify and hold harmless R/E Pro Photos and its team from failure to obtain proper permissions.',
          'You agree to indemnify and hold harmless R/E Pro Photos and its team from negligent or intentional actions.',
        ],
      },
      {
        heading: '11. Platform Usage',
        bullets: [
          'You agree to provide accurate information.',
          'You are responsible for account security.',
          'Misuse may result in suspension or termination.',
        ],
      },
      {
        heading: '12. Modifications',
        paragraphs: [
          'R/E Pro Photos may update these Terms at any time. Continued use of the Platform constitutes acceptance of updated Terms.',
        ],
      },
      {
        heading: '13. Governing Law',
        paragraphs: ['These Terms are governed by the laws of the State of Maryland.'],
      },
      {
        heading: '14. Email Communications',
        bullets: [
          'Transactional emails',
          'Service updates',
          'Optional marketing communications with opt-out available',
        ],
      },
    ],
  },
  {
    title: 'R/E Pro Photos – Photographer Agreement (With SMS Consent)',
    sections: [
      {
        heading: '1. Independent Contractor Status',
        paragraphs: [
          'Photographer is an independent contractor and responsible for taxes, equipment, insurance, and compliance with applicable laws.',
        ],
      },
      {
        heading: '2. Assignment Acceptance',
        bullets: [
          'Assignments are accepted via the Platform.',
          'Accepted shoots must be completed as scheduled.',
          'Unjustified cancellations may impact platform access.',
        ],
      },
      {
        heading: '3. Professional Standards',
        bullets: [
          'Be punctual and professional.',
          'Follow company quality standards.',
          'Deliver work within required timelines.',
        ],
      },
      {
        heading: '4. Ownership of Work',
        bullets: [
          'All Work is a work made for hire.',
          'All Work is fully owned by R/E Pro Photos.',
          'Photographers may not sell or reuse content.',
          'Photographers may not share RAW files.',
          'Photographers may not deliver directly to clients.',
        ],
      },
      {
        heading: '5. SMS Consent (Photographers)',
        paragraphs: [
          'By using the Platform, you consent to receive SMS messages related to job assignments, scheduling updates, urgent notifications, and reminders.',
        ],
        bullets: [
          'Reply STOP to unsubscribe.',
          'Reply HELP for assistance.',
          'Opting out may limit your ability to receive real-time assignments.',
        ],
      },
      {
        heading: '6. Payment',
        paragraphs: ['Payment is issued per agreed terms. Company may withhold payment for incomplete or substandard work.'],
      },
      {
        heading: '7. Confidentiality',
        paragraphs: ['You agree to keep all company and client information confidential.'],
      },
      {
        heading: '8. Liability',
        paragraphs: ['Photographer is responsible for damages, injuries, and maintaining appropriate insurance.'],
      },
      {
        heading: '9. Platform Access',
        paragraphs: ['Access may be suspended or terminated for performance or policy violations.'],
      },
      {
        heading: '10. Governing Law',
        paragraphs: ['Governed by the laws of Maryland.'],
      },
    ],
  },
] as const;

export default function TermsAndConditions() {
  return (
    <div className="h-screen overflow-y-auto bg-[#060a0e] text-white">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_24px_60px_rgba(1,3,9,0.45)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-4">
              <Logo className="h-[34px] w-auto" variant="light" />
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.18em] text-cyan-300/80">Legal</p>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Terms and Conditions</h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  Please review the terms governing use of the R/E Pro Photos platform, services, and communications.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:w-auto sm:items-end">
              <Button asChild className="rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 text-white hover:opacity-90">
                <Link to="/">Back to Home</Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_24px_60px_rgba(1,3,9,0.35)] backdrop-blur-xl sm:p-8">
          <div className="space-y-10 text-sm leading-7 text-slate-200 sm:text-[15px]">
            {termsSections.map((document) => (
              <section key={document.title} className="space-y-6">
                <div className="space-y-3 border-b border-white/10 pb-5">
                  <h2 className="text-2xl font-semibold text-white">{document.title}</h2>
                  {'effectiveDate' in document ? (
                    <p className="text-sm text-slate-400">Effective Date: {document.effectiveDate}</p>
                  ) : null}
                  {'intro' in document ? <p>{document.intro}</p> : null}
                </div>

                <div className="space-y-8">
                  {document.sections.map((section) => (
                    <div key={section.heading} className="space-y-3">
                      <h3 className="text-lg font-semibold text-white">{section.heading}</h3>

                      {section.paragraphs?.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}

                      {section.quote ? (
                        <blockquote className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 italic text-slate-200">
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
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
