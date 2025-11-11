import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { UserPlus, AlertCircle, CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { supabase } from '@/integrations/supabase/client';
import { ROUTES_FRONTEND } from '@/constant';
import { useToast } from '@/hooks/use-toast';

interface InviteData {
  token: string;
  email: string;
  role: string;
  name: string | null;
  org_id: string;
  expires_at: string;
}

interface SignupFormData {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
}

export default function Signup() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingUp, setSigningUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast()
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
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

  useEffect(() => {
    if (!token) {
      setError('No invite token provided');
      setLoading(false);
      return;
    }

    fetchInviteData();
  }, [token]);

  const fetchInviteData = async () => {
    try {
      if (!token) {
        setError('No invite token provided');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('invites')
        .select('*')
        .eq('token', token)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        setError('Invalid or expired invite token');
        setLoading(false);
        return;
      }

      // Check if invite is expired
      if (new Date(data.expires_at) < new Date()) {
        setError('This invite has expired');
        setLoading(false);
        return;
      }

      setInviteData(data as InviteData);
      // Pre-fill the email and name from invite
      setValue('email', data.email);
      if (data.name) {
        setValue('name', data.name);
      }
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching invite:', error);
      setError('Failed to load invite data');
      setLoading(false);
    }
  };

  const onSubmit = async (data: SignupFormData) => {

    if (!inviteData) return;
    console.log('invitedata', inviteData);

    setSigningUp(true);
    try {
      // Check if passwords match
      if (data.password !== data.confirmPassword) {
        toast({
          title: "Error",
          description: "Passwords do not match",
          variant: "destructive",
        });
        return;
      }

      // Check if email matches invite email
      if (data.email !== inviteData.email) {
        toast({
          title: "Error",
          description: "Email must match the invite email",
          variant: "destructive",
        });
        return;
      }

      // Sign up the user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password
      });

      if (signUpError) {
        console.log('signUpError', signUpError.message, signUpError.message.includes('Invalid login credentials'));

        // Handle specific signup errors
        if (signUpError.message.includes('already registered') ||
          signUpError.message.includes('Invalid login credentials') ||
          signUpError.message.includes('already been registered')) {
          toast({
            title: "Account Exists",
            description: "An account with this email already exists. Please sign in instead.",
            variant: "destructive",
          });
          return;
        }
        throw signUpError;
      }

      if (authData.user) {
        const { data, error } = await supabase.rpc('accept_invite', { p_token: inviteData.token });
        console.log(data,error);
        
        toast({
          title: "Success",
          description: "Account created successfully!",
        });

        // Refresh session to get updated JWT claims
        await supabase.auth.refreshSession();
        navigate(ROUTES_FRONTEND.DASHBOARD);
      }
    } catch (error: any) {
      console.error('Error signing up:', error);
      toast({
        title: "Error",
        description: "Failed to create account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSigningUp(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const roleMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      'manager': { label: 'Manager', variant: 'default' },
      'admin': { label: 'Admin', variant: 'default' },
      'annotator': { label: 'Annotator', variant: 'secondary' },
      'reviewer': { label: 'Reviewer', variant: 'outline' }
    };

    const config = roleMap[role] || { label: role, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading invite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-xl text-red-600">Invalid Invite</CardTitle>
            <CardDescription>
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              This is an invite-only platform. Please ask your organization to send you a personal invite link.
            </p>
            <Button onClick={() => navigate('/login')} variant="outline">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!inviteData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No invite data found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      {/* Left side - brand / mission */}
      <div className="hidden lg:flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900 text-white px-10">
        <div className="space-y-6 max-w-md">
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-semibold tracking-wide p-2 px-4 border rounded-xl">Anvesana</h1>
          </div>
          <h2 className="text-4xl font-bold leading-tight">
            Join the team!
          </h2>
          <p className="text-lg text-slate-200">
            Create your account and start collaborating with your team on Anvesana, the AI-powered workspace for efficient, scalable data annotation.
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
              Complete your registration to join Anvesana
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Invite Info */}
            <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-700">Invite Details:</span>
                {getRoleBadge(inviteData.role)}
              </div>
              <div className="text-sm text-purple-600">
                <p>Email: {inviteData.email}</p>
                {inviteData.name && <p>Name: {inviteData.name}</p>}
                <p>Expires: {new Date(inviteData.expires_at).toLocaleDateString()}</p>
              </div>
            </div>

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
                  disabled={true} // Email is pre-filled and locked from invite
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
