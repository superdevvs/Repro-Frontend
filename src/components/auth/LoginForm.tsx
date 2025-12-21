import React, { Suspense, lazy, useEffect, useState } from 'react';
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
import type { RegisterSuccessPayload } from './RegisterForm';
import { API_BASE_URL } from '@/config/env';

const RegisterForm = lazy(() => import('./RegisterForm'));


const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('login');
  const isMobile = useIsMobile();
  const [loginShowPassword, setLoginShowPassword] = useState(false);


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
    isActive: apiUser?.account_status === 'active',
    metadata: {
      avatar: apiUser?.avatar,
      bio: apiUser?.bio,
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

  return (
    <motion.div
      className={`w-full max-w-md mx-auto ${isMobile ? 'px-4 pb-8' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-none shadow-none bg-transparent">
        <CardContent className={`${isMobile ? 'p-0' : 'p-0'}`}>
          {/* Top header (logo + heading + subtext) */}
          <div className="text-center mb-8">
            <div className="h-[52px] mx-auto mb-4 flex items-center justify-center">
              <Logo className="h-[52px] w-auto" />
            </div>
            <h1 className="text-2xl font-semibold">Log in to your dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Centralize shoots, assets, and approvals
            </p>
          </div>

          {/* Tabs styled like design 1 */}
          <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid grid-cols-2 w-full bg-transparent border-b border-border mb-4">
              <TabsTrigger
                value="login"
                className={`rounded-none border-b-2 ${activeTab === 'login'
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground'
                  }`}
              >
                Log In
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className={`rounded-none border-b-2 ${activeTab === 'register'
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground'
                  }`}
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
                            className="
                  border-0 
                  border-b 
                  border-border 
                  rounded-none 
                  focus-visible:ring-0 
                  focus:border-primary 
                  text-base 
                  placeholder:text-muted-foreground
                "
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
                      <FormItem className="relative">
                        <FormControl>
                          <Input
                            type={loginShowPassword ? 'text' : 'password'}
                            placeholder="Password"
                            {...field}
                            className="
                              border-0 
                              border-b 
                              border-border 
                              rounded-none 
                              focus-visible:ring-0 
                              focus:border-primary 
                              text-base 
                              placeholder:text-muted-foreground
                              pr-10
                            "
                          />
                        </FormControl>

                        <button
                          type="button"
                          onClick={() => setLoginShowPassword((s) => !s)}
                          aria-label={loginShowPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                        >
                          {loginShowPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>

                        <FormMessage />
                      </FormItem>
                    )}
                  />


                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full h-12 rounded-full text-base font-semibold mt-2"
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
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    No account yet?{' '}
                    <span
                      onClick={() => setActiveTab('register')}
                      className="text-primary font-medium cursor-pointer hover:underline"
                    >
                      Register now
                    </span>
                  </p>
                </form>
              </Form>
            </TabsContent>


            {/* Register Form */}
            <TabsContent value="register" className="space-y-6">
              <Suspense
                fallback={
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Loading registration form...
                  </div>
                }
              >
                <RegisterForm onSuccess={handleRegisterSuccess} />
              </Suspense>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div >

  );
}

