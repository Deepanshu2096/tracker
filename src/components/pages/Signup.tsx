import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { supabase } from '@/integrations/supabase/client';
import { ROUTES_FRONTEND } from '@/constant';
import { useToast } from '@/hooks/use-toast';

interface SignupFormData {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
}

export default function Signup() {
  const [signingUp, setSigningUp] = useState(false);
  const { toast } = useToast()
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch
  } = useForm<SignupFormData>({
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      name: ''
    }
  });

  const onSubmit = async (data: SignupFormData) => {
    setSigningUp(true);
    try {
      // Check if passwords match
      if (data.password !== data.confirmPassword) {
        toast({
          title: "Error",
          description: "Passwords do not match",
          variant: "destructive",
        });
        setSigningUp(false);
        return;
      }

      // Sign up the user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password
      });

      if (signUpError) {
        // Handle connection errors
        if (signUpError.message.includes('Cannot connect to Supabase') || 
            signUpError.message.includes('Failed to fetch') ||
            signUpError.message.includes('network')) {
          toast({
            title: "Connection Error",
            description: "Unable to connect to the server. Please check your internet connection and try again.",
            variant: "destructive",
          });
          setSigningUp(false);
          return;
        }

        // Handle email rate limit error
        if (signUpError.code === 'over_email_send_rate_limit' || 
            signUpError.message.includes('email rate limit exceeded') ||
            signUpError.message.includes('rate limit')) {
          toast({
            title: "Email Rate Limit",
            description: "Too many emails sent. Please wait a few minutes before trying again, or contact support if you need immediate access.",
            variant: "destructive",
          });
          setSigningUp(false);
          return;
        }

        // Handle account exists error
        if (signUpError.message.includes('already registered') ||
          signUpError.message.includes('already been registered')) {
          toast({
            title: "Account Exists",
            description: "An account with this email already exists. Please sign in instead.",
            variant: "destructive",
          });
          setSigningUp(false);
          return;
        }
        
        toast({
          title: "Error",
          description: signUpError.message || "Failed to create account. Please try again.",
          variant: "destructive",
        });
        setSigningUp(false);
        return;
      }

      if (authData.user) {
        // Create profile with employee role
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: authData.user.id, // id is the primary key and references auth.users(id)
              email: data.email,
              full_name: data.name, // Use full_name instead of name
              role: 'employee' // Use 'employee' role from user_role enum
            });

          if (profileError && 
              !profileError.message.includes('duplicate') && 
              !profileError.message.includes('unique')) {
            console.error('Error creating profile:', profileError);
          }
        } catch (profileErr: any) {
          if (!profileErr.message?.includes('duplicate') && 
              !profileErr.message?.includes('unique')) {
            console.error('Profile creation error:', profileErr);
          }
        }
        
        // Check if we have a session (user is logged in)
        if (authData.session) {
          toast({
            title: "Success",
            description: "Account created successfully!",
          });
          await supabase.auth.refreshSession();
          navigate(ROUTES_FRONTEND.DASHBOARD);
        } else {
          // No session - email confirmation might be required
          toast({
            title: "Success",
            description: "Account created! Please sign in to continue.",
          });
          navigate('/login');
        }
      }
    } catch (error: any) {
      if (error?.message?.includes('Cannot connect to Supabase') || 
          error?.message?.includes('Failed to fetch') ||
          error?.message?.includes('network')) {
        toast({
          title: "Connection Error",
          description: "Unable to connect to the server. Please check your internet connection and try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error?.message || "Failed to create account. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setSigningUp(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      {/* Left side - brand */}
      <div className="hidden lg:flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900 text-white px-10">
        <div className="space-y-6 max-w-md">
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-semibold tracking-wide p-2 px-4 border rounded-xl">Anvesana</h1>
          </div>
          <h2 className="text-4xl font-bold leading-tight">Get Started</h2>
          <p className="text-lg text-slate-200">
            Create your account and start using Anvesana
          </p>
        </div>
      </div>

      {/* Right side - signup form */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <UserPlus className="h-12 w-12 text-purple-500 mx-auto mb-4" />
            <CardTitle className="text-2xl">Create Your Account</CardTitle>
            <CardDescription>
              Create your account to get started with Anvesana
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  {...register('name', {
                    required: 'Name is required',
                    minLength: { value: 2, message: 'Name must be at least 2 characters' }
                  })}
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a password"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 8, message: 'Password must be at least 8 characters' }
                  })}
                  className={errors.password ? 'border-red-500' : ''}
                />
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  {...register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (value) => value === watch('password') || 'Passwords do not match'
                  })}
                  className={errors.confirmPassword ? 'border-red-500' : ''}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={signingUp || !isValid}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {signingUp ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating Account...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create Account
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Button
                  variant="link"
                  className="p-0 h-auto text-purple-600 hover:text-purple-700"
                  onClick={() => navigate('/login')}
                >
                  Sign in
                </Button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
