import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
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
import { EmailHealthInlineHint } from '@/components/email/EmailHealthInlineHint';
import { PRIVACY_EFFECTIVE_DATE as PRIVACY_POLICY_EFFECTIVE_DATE, privacySections } from '@/content/privacyPolicy';
import { analyzeEmailInput, normalizeEmailHealth } from '@/utils/emailHealth';

const TERMS_EFFECTIVE_DATE = 'April 16, 2026';

const termsSections = [
  {
    title: 'R/E Pro Photos – Client Terms & Conditions (With SMS Consent)',
    effectiveDate: TERMS_EFFECTIVE_DATE,
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

const smsConsentOptions = [
  {
    name: 'marketingSmsOptIn',
    title: 'Marketing SMS',
    description:
      'By checking this box you agree to receive Marketing SMS from R/E Pro Photos. Message frequency varies. Message and data rates may apply. Reply HELP for help. Reply STOP to opt out.',
  },
  {
    name: 'transactionalSmsOptIn',
    title: 'Transactional SMS',
    description:
      'By checking this box you agree to receive Transactional SMS communication about bookings, account notifications, and 2FA from R/E Pro Photos. Message frequency varies. Message and data rates may apply. Reply HELP for help. Reply STOP to opt out.',
  },
] as const;

const registerSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    company: z.string().optional(),
    phone: z.string().optional(),
    marketingSmsOptIn: z.boolean().optional(),
    transactionalSmsOptIn: z.boolean().optional(),
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
  onStepChange?: (step: 1 | 2) => void;
  isActive?: boolean;
};

const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, onStepChange, isActive = false }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverEmailHealth, setServerEmailHealth] = useState<any>(undefined);
  const [emailWarningOverride, setEmailWarningOverride] = useState(false);
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
  const metaLabelClass = isMobile
    ? 'text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400'
    : 'text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground dark:text-slate-400';
  const optionalLabelClass = isMobile
    ? 'text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-300/90'
    : 'text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-500 dark:text-cyan-300/90';
  const smsSectionClass = isMobile
    ? 'rounded-[28px] border border-white/10 bg-white/[0.04] p-4'
    : 'rounded-[28px] border border-border/60 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.03]';
  const smsCardClass = isMobile
    ? 'rounded-2xl border border-white/10 bg-slate-950/40 p-4'
    : 'rounded-2xl border border-border/60 bg-background/60 p-4 dark:border-white/10 dark:bg-slate-950/35';
  const smsBodyClass = isMobile
    ? 'text-sm leading-6 text-slate-300'
    : 'text-sm leading-6 text-muted-foreground dark:text-slate-300';
  const smsHeadingClass = isMobile
    ? 'text-sm font-semibold text-white'
    : 'text-sm font-semibold text-foreground dark:text-white';

  const toggleButtonClass = isMobile
    ? 'absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-300 hover:text-white hover:bg-white/5'
    : 'absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/5';

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      company: '',
      phone: '',
      marketingSmsOptIn: false,
      transactionalSmsOptIn: false,
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
  const stepOneFields: Array<keyof RegisterFormValues> = [
    'firstName',
    'lastName',
    'email',
    'company',
    'phone',
    'city',
    'state',
    'zip',
    'country',
    'password',
    'confirmPassword',
  ];
  const emailValue = form.watch('email');
  const [
    firstNameValue,
    lastNameValue,
    cityValue,
    stateValue,
    zipValue,
    countryValue,
    passwordValue,
    confirmPasswordValue,
  ] = form.watch([
    'firstName',
    'lastName',
    'city',
    'state',
    'zip',
    'country',
    'password',
    'confirmPassword',
  ]);
  const hasAcceptedTerms = form.watch('terms');
  const localEmailHint = useMemo(() => analyzeEmailInput(emailValue ?? ''), [emailValue]);
  const stepOneProgressPercent = useMemo(() => {
    const emailIsComplete =
      z.string().email().safeParse((emailValue ?? '').trim()).success &&
      (!localEmailHint.requiresConfirmation || emailWarningOverride);
    const checks = [
      (firstNameValue ?? '').trim().length > 0,
      (lastNameValue ?? '').trim().length > 0,
      emailIsComplete,
      (cityValue ?? '').trim().length > 0,
      (stateValue ?? '').trim().length > 0,
      (zipValue ?? '').trim().length > 0,
      (countryValue ?? '').trim().length > 0,
      (passwordValue ?? '').length >= 6,
      (confirmPasswordValue ?? '').length >= 6 && confirmPasswordValue === passwordValue,
    ];

    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [
    cityValue,
    confirmPasswordValue,
    countryValue,
    emailValue,
    emailWarningOverride,
    firstNameValue,
    lastNameValue,
    localEmailHint.requiresConfirmation,
    passwordValue,
    stateValue,
    zipValue,
  ]);
  const stepOneProgressFill = stepOneProgressPercent === 0 ? 0 : Math.max(stepOneProgressPercent, 8);
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

  useEffect(() => {
    setEmailWarningOverride(false);
    setServerEmailHealth(undefined);
  }, [emailValue]);

  useEffect(() => {
    onStepChange?.(currentStep);
  }, [currentStep, onStepChange]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    form.setValue('terms', false, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    setTermsOpen(false);
    setTermsScrollProgress(0);
    setTermsScrolledToEnd(false);
  }, [form, isActive]);

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

  const focusEmailField = () => {
    window.setTimeout(() => {
      form.setFocus('email');
    }, 0);
  };

  const goToPreferencesStep = async () => {
    const isStepOneValid = await form.trigger(stepOneFields, { shouldFocus: true });
    if (!isStepOneValid) {
      return;
    }

    if (localEmailHint.requiresConfirmation && !emailWarningOverride) {
      toast({
        title: 'Check your email',
        description: localEmailHint.message || 'Please confirm this email address before continuing.',
        variant: 'destructive',
      });
      focusEmailField();
      return;
    }

    setCurrentStep(2);
  };

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (currentStep === 1) {
      await goToPreferencesStep();
      return;
    }

    await form.handleSubmit(handleRegister)(event);
  };

  const handleRegister = async (values: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
      if (localEmailHint.requiresConfirmation && !emailWarningOverride) {
        setCurrentStep(1);
        toast({
          title: 'Check your email',
          description: localEmailHint.message || 'Please confirm this email address before continuing.',
          variant: 'destructive',
        });
        focusEmailField();
        setIsSubmitting(false);
        return;
      }

      const normalizedPhone = values.phone?.trim() ? values.phone.trim() : null;
      const normalizedCompany = values.company?.trim() ? values.company.trim() : null;
      const normalizedCity = values.city?.trim() ? values.city.trim() : null;
      const normalizedState = values.state?.trim() ? values.state.trim() : null;
      const normalizedZip = values.zip?.trim() ? values.zip.trim() : null;
      const normalizedCountry = values.country?.trim() ? values.country.trim() : null;
      const fullName = [values.firstName.trim(), values.lastName.trim()].filter(Boolean).join(' ');

      const response = await axios.post(`${API_BASE_URL}/api/register`, {
        name: fullName,
        email: values.email.trim(),
        password: values.password,
        password_confirmation: values.confirmPassword,
        phonenumber: normalizedPhone,
        company_name: normalizedCompany,
        city: normalizedCity,
        state: normalizedState,
        zip: normalizedZip,
        country: normalizedCountry,
        marketing_sms_opt_in: values.marketingSmsOptIn ?? false,
        transactional_sms_opt_in: values.transactionalSmsOptIn ?? false,
        email_warning_override: emailWarningOverride,
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
        email_health: normalizeEmailHealth(apiUser.email_health),
      };

      onSuccess({ user: newUser, token });
      form.reset();
      setCurrentStep(1);
      setEmailWarningOverride(false);
      setServerEmailHealth(undefined);
    } catch (error: any) {
      console.error('Registration error:', error);
      const errorPayload = error?.response?.data;
      const nextEmailHealth = normalizeEmailHealth(errorPayload?.email_health);
      if (nextEmailHealth) {
        setServerEmailHealth(nextEmailHealth);
        setCurrentStep(1);
        focusEmailField();
      }

      const emailFieldMessage = Array.isArray(errorPayload?.errors?.email)
        ? errorPayload.errors.email[0]
        : undefined;

      if (emailFieldMessage && !nextEmailHealth) {
        setCurrentStep(1);
        form.setError('email', {
          type: 'server',
          message: emailFieldMessage,
        });
        focusEmailField();
      }

      toast({
        title: 'Registration Failed',
        description:
          emailFieldMessage ||
          error.response?.data?.message ||
          'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={handleFormSubmit} className="space-y-6">
        {currentStep === 1 ? (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormControl>
                      <Input
                        placeholder="First Name"
                        autoComplete="given-name"
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
                name="lastName"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormControl>
                      <Input
                        placeholder="Last Name"
                        autoComplete="family-name"
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
                name="email"
                render={({ field }) => (
                  <FormItem className="relative overflow-visible">
                    <FormControl>
                      <Input
                        placeholder="Your email"
                        type="email"
                        autoComplete="email"
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          form.clearErrors('email');
                        }}
                        className={inputClass}
                      />
                    </FormControl>
                    <EmailHealthInlineHint
                      email={field.value}
                      localHint={localEmailHint}
                      serverEmailHealth={serverEmailHealth}
                      warningOverride={emailWarningOverride}
                      variant="floating"
                      onUseSuggestion={(nextEmail) => {
                        form.setValue('email', nextEmail, { shouldDirty: true, shouldValidate: true });
                        setEmailWarningOverride(false);
                        setServerEmailHealth(undefined);
                        form.clearErrors('email');
                      }}
                      onKeepAnyway={() => {
                        setEmailWarningOverride(true);
                        form.clearErrors('email');
                      }}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormControl>
                      <div className="relative">
                        <Input
                          id="register-company"
                          placeholder="Company"
                          autoComplete="organization"
                          {...field}
                          className={`${inputClass} pr-28`}
                        />
                        <span className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 ${optionalLabelClass}`}>
                          Optional
                        </span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormControl>
                      <div className="relative">
                        <PhoneInput
                          id="register-phone"
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Phone number"
                          autoComplete="tel"
                          className={`${inputClass} pr-28`}
                        />
                        <span className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 ${optionalLabelClass}`}>
                          Optional
                        </span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormControl>
                      <Input
                        placeholder="San Francisco"
                        autoComplete="address-level2"
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
                        autoComplete="address-level1"
                        {...field}
                        className={inputClass}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem className="relative md:col-span-2">
                    <FormControl>
                      <Input
                        placeholder="United States"
                        autoComplete="country-name"
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
                        autoComplete="postal-code"
                        {...field}
                        className={inputClass}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                          autoComplete="new-password"
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
                          autoComplete="new-password"
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

            <div className={`border-t border-white/10 pt-2 ${isMobile ? 'flex flex-col gap-3' : 'flex items-center justify-between gap-6'}`}>
              <p className={isMobile ? smsBodyClass : 'max-w-[28rem] flex-1 text-sm leading-6 text-muted-foreground dark:text-slate-300'}>
                {isMobile ? (
                  'Next, you can review optional SMS updates and accept the terms before creating your account.'
                ) : (
                  <>
                    <span className="block">Next, review optional SMS updates and accept the terms</span>
                    <span className="block">before creating your account.</span>
                  </>
                )}
              </p>
              <Button
                type="button"
                onClick={() => {
                  void goToPreferencesStep();
                }}
                className={`h-12 rounded-full border border-white/10 px-8 text-base font-semibold text-white transition-all duration-300 ${
                  isMobile
                    ? 'w-full hover:opacity-95'
                    : 'min-w-[220px] hover:opacity-95'
                }`}
                style={{
                  background:
                    stepOneProgressFill === 0
                      ? 'rgba(51, 65, 85, 0.58)'
                      : `linear-gradient(90deg, rgb(37 99 235) 0%, rgb(34 211 238) ${stepOneProgressFill}%, rgba(51, 65, 85, 0.58) ${stepOneProgressFill}%, rgba(51, 65, 85, 0.58) 100%)`,
                  boxShadow:
                    stepOneProgressPercent >= 100
                      ? '0 10px 30px rgba(37, 99, 235, 0.28)'
                      : '0 10px 24px rgba(8, 47, 73, 0.16)',
                }}
              >
                <span className="flex w-full items-center justify-between gap-4 leading-none">
                  <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/65">
                    1 of 2
                  </span>
                  <span>Next</span>
                </span>
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className={smsSectionClass}>
              <div className="flex flex-col gap-2 px-1">
                <p className={metaLabelClass}>SMS Opt-In</p>
                <p className={smsBodyClass}>
                  Choose any text updates you want. You can leave both boxes unchecked and still create your account.
                </p>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                {smsConsentOptions.map((option) => (
                  <FormField
                    key={option.name}
                    control={form.control}
                    name={option.name}
                    render={({ field }) => (
                      <FormItem className={smsCardClass}>
                        <div className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox
                              id={option.name}
                              checked={field.value ?? false}
                              onCheckedChange={(checked) => field.onChange(checked === true)}
                              className={
                                isMobile
                                  ? 'mt-1 border-white/30 bg-slate-950/70 data-[state=checked]:bg-cyan-400 data-[state=checked]:text-slate-950'
                                  : 'mt-1 dark:border-white/30 dark:bg-slate-950/50 dark:data-[state=checked]:bg-cyan-400 dark:data-[state=checked]:text-slate-950'
                              }
                            />
                          </FormControl>
                          <label htmlFor={option.name} className="flex-1 cursor-pointer">
                            <span className={smsHeadingClass}>{option.title}</span>
                            <span className={`mt-1 block ${smsBodyClass}`}>{option.description}</span>
                          </label>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              <FormField
                control={form.control}
                name="terms"
                render={({ field }) => (
                  <FormItem className="mt-4 px-1">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="terms"
                        checked={field.value ?? false}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setTermsOpen(true);
                            return;
                          }
                          field.onChange(false);
                        }}
                        aria-label="Agree to the Terms and Conditions"
                        className={`mt-0.5 ${isMobile ? 'border-white/30 bg-slate-900/60 data-[state=checked]:bg-cyan-400 data-[state=checked]:text-slate-950' : 'border-border dark:border-white/30 dark:bg-transparent dark:data-[state=checked]:bg-cyan-400 dark:data-[state=checked]:text-slate-950'}`}
                      />
                      <div className={`text-sm leading-6 ${isMobile ? 'text-slate-300' : 'text-muted-foreground dark:text-slate-300'}`}>
                        <button
                          type="button"
                          onClick={() => setTermsOpen(true)}
                          className="select-none bg-transparent p-0 text-left text-inherit"
                        >
                          I agree to the{' '}
                        </button>
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
                        <span>{' '}and{' '}</span>
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
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                onClick={() => setCurrentStep(1)}
                className={`h-12 rounded-full px-8 text-base font-semibold ${
                  isMobile
                    ? 'w-full border border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.06]'
                    : 'min-w-[180px] border border-border/60 bg-transparent text-foreground hover:bg-accent dark:border-white/15 dark:text-white dark:hover:bg-white/[0.06]'
                }`}
              >
                Back
              </Button>

              <Button
                type="submit"
                className={`h-12 rounded-full text-base font-semibold ${
                  hasAcceptedTerms
                    ? isMobile
                      ? 'w-full bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/30 hover:opacity-90'
                      : 'min-w-[220px] bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-600/25 hover:opacity-90'
                    : isMobile
                      ? 'w-full bg-slate-500/40 text-slate-300 shadow-none cursor-not-allowed hover:opacity-100'
                      : 'min-w-[220px] bg-slate-700/60 text-slate-400 shadow-none cursor-not-allowed hover:opacity-100'
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
            </div>
          </>
        )}

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
      </form>
    </Form>
  );
};

export default RegisterForm;
