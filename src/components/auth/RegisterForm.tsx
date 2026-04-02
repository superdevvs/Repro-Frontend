import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { toast } from '@/components/ui/use-toast';
import type { UserData } from '@/types/auth';
import { API_BASE_URL } from '@/config/env';
import { useIsMobile } from '@/hooks/use-mobile';

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
        paragraphs: ['Upon full payment, you receive a non-exclusive, non-transferable, limited license to use the Work for marketing the Property, promoting your real estate business, and MLS and listing platforms.'],
        bullets: [
          'No resale, sublicensing, or redistribution.',
          'No AI training or derivative commercial usage.',
          'License ends when the listing is no longer active.',
        ],
      },
      {
        heading: '6. SMS Consent & Communications (Twilio-Compliant)',
        paragraphs: ['By providing your phone number through the Platform, including booking forms, account registration, or direct input, you expressly consent to receive SMS or text messages from R/E Pro Photos.'],
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
        paragraphs: ['Consent is obtained through explicit user action, including booking forms, account registration, and dashboard inputs.', 'Users must agree via checkbox or similar action confirming the following statement:'],
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
        paragraphs: ['R/E Pro Photos may update these Terms at any time. Continued use of the Platform constitutes acceptance of updated Terms.'],
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
        paragraphs: ['Photographer is an independent contractor and responsible for taxes, equipment, insurance, and compliance with applicable laws.'],
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
        paragraphs: ['By using the Platform, you consent to receive SMS messages related to job assignments, scheduling updates, urgent notifications, and reminders.'],
        bullets: ['Reply STOP to unsubscribe.', 'Reply HELP for assistance.', 'Opting out may limit your ability to receive real-time assignments.'],
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

const registerSchema = z
  .object({
    name: z.string().min(1, 'Full name is required'),
    company: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email('Invalid email address'),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your password'),
    terms: z.boolean().refine((value) => value === true, {
      message: 'You must agree to the Terms & Conditions',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export type RegisterSuccessPayload = {
  user: UserData;
  token: string;
};

type RegisterFormProps = {
  onSuccess: (payload: RegisterSuccessPayload) => void;
};

const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsScrollProgress, setTermsScrollProgress] = useState(0);
  const [termsScrolledToEnd, setTermsScrolledToEnd] = useState(false);
  const isMobile = useIsMobile();
  const termsScrollRef = useRef<HTMLDivElement | null>(null);

  const mobileInputClass =
    'bg-slate-900/70 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0 focus:border-transparent';
  const desktopInputClass =
    'border-0 border-b border-border rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-primary text-base placeholder:text-muted-foreground dark:bg-white/5 dark:border dark:border-white/10 dark:rounded-xl dark:px-4 dark:py-3 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-cyan-400/40 dark:focus:ring-1 dark:focus:ring-cyan-400/20';
  const inputClass = isMobile ? mobileInputClass : desktopInputClass;

  const toggleButtonClass = isMobile
    ? 'absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-300 hover:text-white hover:bg-white/5'
    : 'absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/5';

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      company: '',
      phone: '',
      email: '',
      city: '',
      state: '',
      zip: '',
      country: '',
      password: '',
      confirmPassword: '',
      terms: false,
    },
  });
  const hasAcceptedTerms = form.watch('terms');
  const canDismissTermsDialog = hasAcceptedTerms || termsScrolledToEnd;

  useEffect(() => {
    if (!termsOpen) {
      return;
    }

    if (hasAcceptedTerms) {
      setTermsScrollProgress(1);
      setTermsScrolledToEnd(true);
      return;
    }

    const scrollElement = termsScrollRef.current;
    if (!scrollElement) {
      setTermsScrollProgress(0);
      setTermsScrolledToEnd(false);
      return;
    }

    scrollElement.scrollTop = 0;
    setTermsScrollProgress(0);
    setTermsScrolledToEnd(false);
  }, [hasAcceptedTerms, termsOpen]);

  const updateTermsScrollState = () => {
    const scrollElement = termsScrollRef.current;
    if (!scrollElement) return;

    const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight;
    if (maxScrollTop <= 0) {
      setTermsScrollProgress(1);
      setTermsScrolledToEnd(true);
      return;
    }

    const progress = Math.min(scrollElement.scrollTop / maxScrollTop, 1);
    const hasReachedBottom = scrollElement.scrollTop + scrollElement.clientHeight >= scrollElement.scrollHeight - 8;

    setTermsScrollProgress(progress);
    setTermsScrolledToEnd(hasReachedBottom);
  };

  const handleRegister = async (values: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/register`, {
        name: values.name,
        email: values.email,
        password: values.password,
        password_confirmation: values.confirmPassword,
        phonenumber: values.phone,
        company_name: values.company,
        city: values.city,
        state: values.state,
        zip: values.zip,
        country: values.country,
        role: 'client',
        avatar: 'https://example.com/avatar.jpg',
        bio: 'No bio provided',
      });

      const apiUser = response.data.user;
      const token = response.data.token;
      const normalizedRole =
        apiUser.role === 'sales_rep'
          ? 'salesRep'
          : apiUser.role || 'client';

      const newUser: UserData = {
        id: String(apiUser.id),
        name: apiUser.name,
        email: apiUser.email,
        role: normalizedRole,
        company: apiUser.company_name,
        phone: apiUser.phonenumber,
        avatar: apiUser.avatar,
        bio: apiUser.bio,
        isActive: apiUser.account_status === 'active',
        metadata: {
          city: apiUser.city,
          state: apiUser.state,
          zip: apiUser.zip,
          country: apiUser.country,
        },
      };

      onSuccess({ user: newUser, token });
      form.reset();
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: 'Registration Failed',
        description: error.response?.data?.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleRegister)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="relative">
                <FormControl>
                  <Input
                    placeholder="Full Name"
                    {...field}
                    className={inputClass}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="company"
            render={({ field }) => (
              <FormItem className="relative">
                <FormControl>
                  <Input
                    placeholder="Company (Optional)"
                    {...field}
                    className={inputClass}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem className="relative">
                <FormControl>
                  <PhoneInput
                    value={field.value}
                    onChange={field.onChange}
                    className={inputClass}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="relative">
                <FormControl>
                  <Input
                    placeholder="you@company.com"
                    {...field}
                    className={inputClass}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem className="relative">
                <FormControl>
                  <Input
                    placeholder="San Francisco"
                    {...field}
                    className={inputClass}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem className="relative">
                <FormControl>
                  <Input
                    placeholder="CA"
                    {...field}
                    className={inputClass}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="zip"
            render={({ field }) => (
              <FormItem className="relative">
                <FormControl>
                  <Input
                    placeholder="94107"
                    {...field}
                    className={inputClass}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem className="relative">
              <FormControl>
                <Input
                  placeholder="United States"
                  {...field}
                  className={inputClass}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-6">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="relative">
                  <FormControl>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      {...field}
                      className={`${inputClass} pr-10`}
                    />
                  </FormControl>
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className={toggleButtonClass}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <div className="relative">
                  <FormControl>
                    <Input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Confirm Password"
                      {...field}
                      className={`${inputClass} pr-10`}
                    />
                  </FormControl>
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    className={toggleButtonClass}
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="terms"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-start gap-2 pt-2">
                <input
                  id="terms"
                  type="checkbox"
                  checked={field.value ?? false}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    if (checked) {
                      setTermsOpen(true);
                      return;
                    }
                    field.onChange(false);
                  }}
                  className={`mt-0.5 h-4 w-4 rounded border ${isMobile ? 'border-white/30 bg-slate-900/60' : 'border-border dark:border-white/30 dark:bg-transparent'}`}
                />
                <div className={`text-sm leading-6 ${isMobile ? 'text-slate-300' : 'text-muted-foreground dark:text-slate-300'}`}>
                  <label htmlFor="terms" className="select-none">
                    I agree to the{' '}
                  </label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setTermsOpen(true);
                    }}
                    className={`font-medium underline underline-offset-4 transition-colors ${isMobile ? 'text-cyan-300 hover:text-cyan-200' : 'text-primary dark:text-cyan-400 dark:hover:text-cyan-300'}`}
                  >
                    Terms and Conditions
                  </button>
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Dialog
          open={termsOpen}
          onOpenChange={(open) => {
            if (!open && !canDismissTermsDialog) {
              return;
            }
            setTermsOpen(open);
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
              ref={termsScrollRef}
              onScroll={updateTermsScrollState}
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
                onClick={() => {
                  form.setValue('terms', true, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                  setTermsOpen(false);
                }}
                className="w-full rounded-full text-white transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:text-slate-300 disabled:opacity-100"
                style={{
                  background: canDismissTermsDialog
                    ? 'linear-gradient(90deg, rgb(59 130 246), rgb(34 211 238))'
                    : `linear-gradient(90deg, rgba(59, 130, 246, 0.9) 0%, rgba(34, 211, 238, 0.9) ${Math.max(termsScrollProgress * 100, 4)}%, rgba(71, 85, 105, 0.55) ${Math.max(termsScrollProgress * 100, 4)}%, rgba(71, 85, 105, 0.55) 100%)`,
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

        <Button
          type="submit"
          className={`w-full h-12 rounded-full text-base font-semibold mb-4 ${
            hasAcceptedTerms
              ? isMobile
                ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/30 hover:opacity-90'
                : 'dark:bg-gradient-to-r dark:from-blue-600 dark:to-cyan-500 dark:text-white dark:shadow-lg dark:shadow-blue-600/25 dark:hover:opacity-90'
              : 'bg-slate-500/40 text-slate-300 shadow-none cursor-not-allowed hover:opacity-100 dark:bg-slate-700/60 dark:text-slate-400'
          }`}
          disabled={isSubmitting || !hasAcceptedTerms}
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-t-transparent rounded-full" />
              <span>Creating Account...</span>
            </div>
          ) : (
            'Register'
          )}
        </Button>
      </form>
    </Form>
  );
};

export default RegisterForm;
