import React, { useState } from 'react';
import axios from 'axios';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import type { UserData } from '@/types/auth';
import { API_BASE_URL } from '@/config/env';

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
    role: z.enum(['client', 'photographer', 'editor', 'admin', 'salesRep'], {
      required_error: 'Please select a role',
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
      role: 'client',
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
        role: values.role,
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
        isActive: apiUser.account_status === 'active',
        metadata: {
          avatar: apiUser.avatar,
          bio: apiUser.bio,
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
                    className="border-0 border-b border-border rounded-none focus-visible:ring-0 focus:border-primary text-base placeholder:text-muted-foreground"
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
                    className="border-0 border-b border-border rounded-none focus-visible:ring-0 focus:border-primary text-base placeholder:text-muted-foreground"
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
                  <Input
                    placeholder="+1 (555) 123-4567"
                    {...field}
                    className="border-0 border-b border-border rounded-none focus-visible:ring-0 focus:border-primary text-base placeholder:text-muted-foreground"
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
                    className="border-0 border-b border-border rounded-none focus-visible:ring-0 focus:border-primary text-base placeholder:text-muted-foreground"
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
                    className="border-0 border-b border-border rounded-none focus-visible:ring-0 focus:border-primary text-base placeholder:text-muted-foreground"
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
                    className="border-0 border-b border-border rounded-none focus-visible:ring-0 focus:border-primary text-base placeholder:text-muted-foreground"
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
                    className="border-0 border-b border-border rounded-none focus-visible:ring-0 focus:border-primary text-base placeholder:text-muted-foreground"
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
                  className="border-0 border-b border-border rounded-none focus-visible:ring-0 focus:border-primary text-base placeholder:text-muted-foreground"
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
              <FormItem className="relative">
                <FormControl>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    {...field}
                    className="border-0 border-b border-border rounded-none focus-visible:ring-0 focus:border-primary text-base placeholder:text-muted-foreground pr-10"
                  />
                </FormControl>
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem className="relative">
                <FormControl>
                  <Input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Confirm Password"
                    {...field}
                    className="border-0 border-b border-border rounded-none focus-visible:ring-0 focus:border-primary text-base placeholder:text-muted-foreground pr-10"
                  />
                </FormControl>
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground"
                  aria-label="Toggle confirm password visibility"
                >
                  {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Register as</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="photographer">Photographer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

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
                  className="h-4 w-4 rounded border border-border"
                />
                <label htmlFor="terms" className="text-sm text-muted-foreground select-none">
                  I agree to the Terms
                </label>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full h-12 rounded-full text-base font-semibold" disabled={isSubmitting}>
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

