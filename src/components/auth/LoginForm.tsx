  const heroCopy = {
    login: {
      title: 'Log in to your dashboard',
      subtitle: '',
    },
    register: {
      title: 'Create your account',
      subtitle: 'Manage shoots and approvals in one place',
    },
  } as const;

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/components/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { toast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { UserData } from '@/types/auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { AlertCircle } from 'lucide-react';
import axios from 'axios';
import { Logo } from '@/components/layout/Logo';
import { Eye, EyeOff } from 'lucide-react';
import RegisterForm, { type RegisterSuccessPayload } from './RegisterForm';
import { API_BASE_URL } from '@/config/env';


const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onTabChange?: (tab: string) => void;
}

export function LoginForm({ onTabChange }: LoginFormProps = {}) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('login');
  const isMobile = useIsMobile();
  const [loginShowPassword, setLoginShowPassword] = useState(false);

  useEffect(() => {
    onTabChange?.(activeTab);
  }, [activeTab, onTabChange]);

  const mobileInputClass =
    'bg-slate-900/70 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0 focus:border-transparent';
  const desktopInputClass =
    'border-0 border-b border-border rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-primary text-base placeholder:text-muted-foreground dark:bg-white/5 dark:border dark:border-white/10 dark:rounded-xl dark:px-4 dark:py-3 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-cyan-400/40 dark:focus:ring-1 dark:focus:ring-cyan-400/20';
  const inputClass = isMobile ? mobileInputClass : desktopInputClass;

  const mobileTabsListClass = 'flex w-full border-b border-white/15 mb-6 bg-transparent px-0 rounded-none text-white/50';
  const desktopTabsListClass = 'grid grid-cols-2 w-full !bg-transparent border-b border-border dark:border-white/15 mb-4 p-0 h-auto';
  const tabsListClass = isMobile ? mobileTabsListClass : desktopTabsListClass;

  const getTabsTriggerClass = (tab: 'login' | 'register') => {
    if (isMobile) {
      return `relative flex-1 text-center pb-3 text-base font-medium tracking-wide rounded-none px-0 text-white/60 transition-colors data-[state=active]:text-white data-[state=active]:bg-transparent after:absolute after:left-0 after:-bottom-[1px] after:h-0.5 after:w-full after:bg-transparent data-[state=active]:after:bg-gradient-to-r data-[state=active]:after:from-cyan-400 data-[state=active]:after:to-blue-500`;
    }

    return `rounded-none border-b-2 relative bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none ${
      activeTab === tab 
        ? 'border-primary text-primary font-medium dark:border-transparent dark:text-white dark:after:absolute dark:after:left-0 dark:after:-bottom-[2px] dark:after:h-0.5 dark:after:w-full dark:after:bg-gradient-to-r dark:after:from-cyan-400 dark:after:to-blue-500' 
        : 'border-transparent text-muted-foreground dark:text-white/50'
    }`;
  };


  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const clearErrors = () => {
    setLoginError(null);
  };

  const normalizeUser = (apiUser: any): UserData => ({
    id: String(apiUser?.id ?? ''),
    name: apiUser?.name ?? '',
    email: apiUser?.email ?? '',
    role:
      apiUser?.role === 'sales_rep'
        ? 'salesRep'
        : apiUser?.role || 'client',
    company: apiUser?.company_name,
    phone: apiUser?.phonenumber,
    avatar: apiUser?.avatar,
    bio: apiUser?.bio,
    isActive: apiUser?.account_status === 'active',
    metadata: {
      city: apiUser?.city,
      state: apiUser?.state,
      zip: apiUser?.zip,
      country: apiUser?.country,
    },
  });

  const handleRegisterSuccess = ({ user, token }: RegisterSuccessPayload) => {
    login(user, token);
    toast({
      title: 'Account created',
      description: 'You have successfully registered and logged in!',
    });
    navigate('/dashboard');
  };

  // Example after login API response
  const handleLogin = async (values: LoginFormValues) => {
    setIsLoginLoading(true);
    clearErrors();

    try {
      const normalizedEmail = values.email.trim().toLowerCase();
      const response = await axios.post(`${API_BASE_URL}/api/login`, {
        email: normalizedEmail,
        password: values.password,
      });

      const { token, user } = response.data;
      const normalizedUser = normalizeUser(user);

      toast({
        title: 'Success',
        description: 'You have successfully logged in!',
      });

      login(normalizedUser, token); // your auth context method
      // Navigation is handled by useEffect in Index.tsx based on auth state
      // or inside the login function if needed, but typically we let the
      // protected route or the index page redirect authenticated users.
      navigate('/dashboard');
    } catch (error: any) {
      console.error("Login error:", error);
      const message = error.response?.data?.message || 'Login failed.';
      setLoginError(message);
      toast({
        title: "Login Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoginLoading(false);
    }
  };

  useEffect(() => {
    clearErrors();
  }, [activeTab]);

  const isRegister = activeTab === 'register';

  const registerContentClass = isMobile
    ? 'space-y-6 pb-8 -mt-1'
    : 'space-y-6';

  return (
    <motion.div
      className={`w-full max-w-md mx-auto ${
        isMobile
          ? `${isRegister ? 'rounded-[28px]' : 'rounded-b-[28px] rounded-t-none'} shadow-[0_24px_60px_rgba(1,3,9,0.68)] bg-[#03060B]`
          : ''
      }`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className={`shadow-none ${
          isMobile
            ? `relative ${isRegister ? 'rounded-[26px]' : 'rounded-b-[26px] rounded-t-none'} border-none bg-gradient-to-b from-[#050815]/85 via-[#050f20]/55 to-[#0b1a36] backdrop-blur-2xl before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-[46px] before:bg-gradient-to-b before:from-[#050815]/85 before:via-[#050815]/35 before:to-transparent before:pointer-events-none`
            : 'border-none bg-transparent'
        }`}
      >
        <CardContent className={`${isMobile ? 'p-4 sm:p-6 relative z-10' : 'p-0'}`}>
          {/* Top header (logo + heading + subtext) */}
          <div className={`${isMobile ? 'text-left mb-5 space-y-2.5' : 'text-center mb-8'}`}>
            <div className={`h-[34px] mb-4 flex items-center ${isMobile ? 'justify-start mt-[10px]' : 'justify-center'}`}>
              <Logo
                className="h-[34px] w-auto"
                variant={isMobile ? 'light' : 'auto'}
              />
            </div>
            <h1 className={`text-2xl font-semibold ${isMobile ? 'text-white' : ''}`}>
              {heroCopy[activeTab as 'login' | 'register'].title}
            </h1>
            <p className={`text-sm mt-1 ${isMobile ? 'text-slate-300' : 'text-muted-foreground'}`}>
              {heroCopy[activeTab as 'login' | 'register'].subtitle}
            </p>
          </div>

          {/* Tabs styled like design 1 */}
          <Tabs
            defaultValue="login"
            value={activeTab}
            onValueChange={setActiveTab}
            className={isMobile ? 'flex flex-col space-y-0' : 'space-y-6'}
          >
            <TabsList className={tabsListClass}>
              <TabsTrigger
                value="login"
                className={getTabsTriggerClass('login')}
              >
                Log In
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className={getTabsTriggerClass('register')}
              >
                Register
              </TabsTrigger>
            </TabsList>

            {/* Login Form */}
            <TabsContent value="login" className="space-y-6">
              {loginError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle size={16} />
                  <span>{loginError}</span>
                </div>
              )}

              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-6">
                  {/* Email Field */}
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="relative">
                        <FormControl>
                          <Input
                            placeholder="Email"
                            {...field}
                            className={inputClass}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Password Field */}
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="relative">
                          <FormControl>
                            <Input
                              type={loginShowPassword ? 'text' : 'password'}
                              placeholder="Password"
                              {...field}
                              className={`${inputClass} pr-10`}
                            />
                          </FormControl>

                          <button
                            type="button"
                            onClick={() => setLoginShowPassword((s) => !s)}
                            aria-label={loginShowPassword ? 'Hide password' : 'Show password'}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-md transition ${
                              isMobile
                                ? 'text-slate-300 hover:text-white hover:bg-white/5'
                                : 'text-muted-foreground hover:text-primary hover:bg-gray-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            {loginShowPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>

                        <FormMessage />
                      </FormItem>
                    )}
                  />


                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className={`w-full h-12 rounded-full text-base font-semibold mt-2 ${
                      isMobile
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/30 hover:opacity-90'
                        : 'dark:bg-gradient-to-r dark:from-blue-600 dark:to-cyan-500 dark:text-white dark:shadow-lg dark:shadow-blue-600/25 dark:hover:opacity-90'
                    }`}
                    disabled={isLoginLoading}
                  >
                    {isLoginLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-t-transparent rounded-full" />
                        <span>Signing in...</span>
                      </div>
                    ) : (
                      'Log In'
                    )}
                  </Button>

                  {/* Register Redirect Text */}
                  <p className={`text-center text-sm mt-4 mb-2 ${isMobile ? 'text-slate-400' : 'text-muted-foreground dark:text-slate-400'}`}>
                    No account yet?{' '}
                    <span
                      onClick={() => setActiveTab('register')}
                      className={`font-medium cursor-pointer hover:underline ${isMobile ? 'text-cyan-300' : 'text-primary dark:text-cyan-400'}`}
                    >
                      Register now
                    </span>
                  </p>
                </form>
              </Form>
            </TabsContent>


            {/* Register Form */}
            <TabsContent value="register" className={registerContentClass}>
              <RegisterForm onSuccess={handleRegisterSuccess} />
              <p
                className={`text-center text-sm ${isMobile ? 'text-slate-400' : 'text-muted-foreground dark:text-slate-400'}`}
                style={{ marginTop: '15px', marginBottom: '-25px' }}
              >
                <span
                  onClick={() => setActiveTab('login')}
                  className="text-muted-foreground/70 dark:text-slate-400 font-medium cursor-pointer hover:underline inline-flex items-center"
                >
                  <span>
                    Go back to{' '}
                    <span className={`${isMobile ? 'text-cyan-300' : 'text-primary dark:text-cyan-400'} font-semibold`}>
                      Login
                    </span>
                  </span>
                </span>
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div >

  );
}

