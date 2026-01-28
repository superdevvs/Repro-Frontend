import React, { useState } from 'react';
import axios from 'axios';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { toast } from '@/components/ui/use-toast';
import type { UserData } from '@/types/auth';
import { API_BASE_URL } from '@/config/env';
import { useIsMobile } from '@/hooks/use-mobile';

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
    terms: z.boolean().optional(),
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
  const isMobile = useIsMobile();

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
      <form onSubmit={form.handleSubmit(handleRegister)} className="space-y-6 pb-4">
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
              <div className="flex items-center gap-2 pt-2">
                <input
                  id="terms"
                  type="checkbox"
                  checked={field.value ?? false}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className={`h-4 w-4 rounded border ${isMobile ? 'border-white/30 bg-slate-900/60' : 'border-border dark:border-white/30 dark:bg-transparent'}`}
                />
                <label
                  htmlFor="terms"
                  className={`text-sm select-none ${isMobile ? 'text-slate-300' : 'text-muted-foreground dark:text-slate-300'}`}
                >
                  I agree to the Terms
                </label>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className={`w-full h-12 rounded-full text-base font-semibold mb-4 ${
            isMobile
              ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/30 hover:opacity-90'
              : 'dark:bg-gradient-to-r dark:from-blue-600 dark:to-cyan-500 dark:text-white dark:shadow-lg dark:shadow-blue-600/25 dark:hover:opacity-90'
          }`}
          disabled={isSubmitting}
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

