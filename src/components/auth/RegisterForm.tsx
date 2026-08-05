import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { toast } from '@/components/ui/use-toast';
import type { EmailHealth, UserData } from '@/types/auth';
import { API_BASE_URL } from '@/config/env';
import { useIsMobile } from '@/hooks/use-mobile';
import { EmailHealthInlineHint } from '@/components/email/EmailHealthInlineHint';
import { analyzeEmailInput, normalizeEmailHealth } from '@/utils/emailHealth';
import { PrivacyPolicyDialog, TermsAgreementDialog } from './RegisterLegalDialogs';
import {
  registerSchema,
  smsConsentOptions,
  type RegisterFormProps,
  type RegisterFormValues,
} from './registerFormModel';

interface RegistrationErrorPayload {
  email_health?: unknown;
  errors?: { email?: unknown };
  message?: string;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, onStepChange, isActive = false }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverEmailHealth, setServerEmailHealth] = useState<EmailHealth | undefined>(undefined);
  const [emailWarningOverride, setEmailWarningOverride] = useState(false);
  const [showRegisterTermsHint, setShowRegisterTermsHint] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsScrollProgress, setTermsScrollProgress] = useState(0);
  const [termsScrolledToEnd, setTermsScrolledToEnd] = useState(false);
  const isMobile = useIsMobile();
  const formTopRef = useRef<HTMLDivElement | null>(null);
  const termsScrollRef = useRef<HTMLDivElement | null>(null);
  const previousStepRef = useRef<1 | 2>(1);

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
    ? 'space-y-4'
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
  const resetTermsAgreement = useCallback(() => {
    form.setValue('terms', false, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });
    setTermsOpen(false);
    setTermsScrollProgress(0);
    setTermsScrolledToEnd(false);
  }, [form]);
  const openTermsDialog = () => {
    setTermsOpen(true);
  };
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
  useEffect(() => {
    if (hasAcceptedTerms) {
      setShowRegisterTermsHint(false);
    }
  }, [hasAcceptedTerms]);
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
    const previousStep = previousStepRef.current;
    previousStepRef.current = currentStep;

    if (!isMobile || previousStep === currentStep) {
      return;
    }

    window.requestAnimationFrame(() => {
      let current: HTMLElement | null = formTopRef.current;

      while (current) {
        const style = window.getComputedStyle(current);
        const canScrollY =
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          current.scrollHeight > current.clientHeight;

        if (canScrollY) {
          current.scrollTop = 0;
          break;
        }

        current = current.parentElement;
      }
    });
  }, [currentStep, isMobile]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    resetTermsAgreement();
  }, [isActive, resetTermsAgreement]);

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

    resetTermsAgreement();
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
    } catch (error: unknown) {
      console.error('Registration error:', error);
      const errorPayload = axios.isAxiosError<RegistrationErrorPayload>(error)
        ? error.response?.data
        : undefined;
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
          errorPayload?.message ||
          'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <div ref={formTopRef} />
      <form
        onSubmit={handleFormSubmit}
        className="space-y-6"
      >
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
                        placeholder="City"
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
                        placeholder="State"
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
                        placeholder="Country"
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
                        placeholder="ZIP Code"
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
          <div className="space-y-6">
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
                        checked={field.value === true}
                        onClick={(event) => {
                          event.preventDefault();
                          if (field.value === true) {
                            field.onChange(false);
                            setTermsScrollProgress(0);
                            setTermsScrolledToEnd(false);
                            return;
                          }
                          openTermsDialog();
                        }}
                        aria-label="Agree to the Terms and Conditions"
                        className={`mt-0.5 ${isMobile ? 'border-white/30 bg-slate-900/60 data-[state=checked]:bg-cyan-400 data-[state=checked]:text-slate-950' : 'border-border dark:border-white/30 dark:bg-transparent dark:data-[state=checked]:bg-cyan-400 dark:data-[state=checked]:text-slate-950'}`}
                      />
                      <div className={`text-sm leading-6 ${isMobile ? 'text-slate-300' : 'text-muted-foreground dark:text-slate-300'}`}>
                        <button
                          type="button"
                          onClick={openTermsDialog}
                          className="select-none bg-transparent p-0 text-left text-inherit"
                        >
                          I agree to the{' '}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            openTermsDialog();
                          }}
                          className={`font-medium underline underline-offset-4 transition-colors ${isMobile ? 'text-cyan-300 hover:text-cyan-200' : 'text-primary dark:text-cyan-400 dark:hover:text-cyan-300'}`}
                        >
                          Terms and Conditions
                        </button>
                        <span>{' '}and{' '}</span>
                        <PrivacyPolicyDialog isMobile={isMobile} />
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 pt-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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

              <div className={`flex items-center justify-center ${isMobile ? 'order-last min-h-0' : 'min-h-[48px] flex-1 px-4'}`}>
                <p
                  aria-hidden={!showRegisterTermsHint || hasAcceptedTerms}
                  className={`max-w-[22rem] text-center text-xs leading-5 text-cyan-200 transition-all duration-200 ${
                    showRegisterTermsHint && !hasAcceptedTerms
                      ? 'translate-y-0 opacity-100'
                      : 'pointer-events-none translate-y-1 opacity-0'
                  }`}
                >
                  Please agree to the Terms and Conditions and Privacy Policy to enable registration.
                </p>
              </div>

              <div
                className={isMobile ? 'w-full' : 'shrink-0'}
                onMouseEnter={() => {
                  if (!hasAcceptedTerms) {
                    setShowRegisterTermsHint(true);
                  }
                }}
                onMouseLeave={() => setShowRegisterTermsHint(false)}
                onClick={() => {
                  if (!hasAcceptedTerms) {
                    setShowRegisterTermsHint(true);
                  }
                }}
              >
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
            </div>
          </div>
        )}

        <TermsAgreementDialog
          open={termsOpen}
          onOpenChange={setTermsOpen}
          canDismiss={canDismissTermsDialog}
          isMobile={isMobile}
          scrollRef={termsScrollRef}
          onScroll={updateTermsScrollState}
          scrollProgress={termsScrollProgress}
          onAgree={() => {
            form.setValue('terms', true, {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            });
            setTermsOpen(false);
          }}
        />
      </form>
    </Form>
  );
};

export default RegisterForm;
