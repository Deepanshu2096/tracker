import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, AlertCircle, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { useAuth } from '@/hooks/useAuth';
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

export default function Invite() {
  const { token } = useParams<{ token: string }>();
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching invite:', error);
      setError('Failed to load invite data');
      setLoading(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!inviteData) return;

    setAccepting(true);
    try {
      if (user) {
        // User is logged in - check if they already exist in profiles
        const { data: existingProfile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .eq('org_id', inviteData.org_id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          throw profileError;
        }

        if (existingProfile) {
          toast({
            title: "Profile Exists",
            description: "You already have a profile in this organization",
            variant: "destructive",
          });
          return;
        }

        const { data, error } = await supabase.rpc('accept_invite', { p_token: inviteData.token });
        console.log(data, error);
        if (!error) {
          console.log('failed to create profile');
        }
        else {
          console.log('profile created');
        }

        toast({
          title: "Success",
          description: "Invite accepted successfully!",
        });

        // Refresh session to get updated JWT claims
        await supabase.auth.refreshSession();

        // Redirect to dashboard
        navigate(ROUTES_FRONTEND.DASHBOARD);
      } else {
        // User is not logged in - redirect to signup with token
        navigate(`/signup?token=${token}`);
      }
    } catch (error: any) {
      console.error('Error accepting invite:', error);
      toast({
        title: "Error",
        description: "Failed to accept invite. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
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

  if (loading || authLoading) {
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
            Welcome to the team!
          </h2>
          <p className="text-lg text-slate-200">
            You've been invited to join Anvesana, the AI-powered workspace for efficient, scalable data annotation.
          </p>
        </div>
      </div>

      {/* Right side - invite acceptance */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-2xl">You're Invited!</CardTitle>
            <CardDescription>
              Join Anvesana and start collaborating with your team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Email:</span>
                <span className="text-sm text-gray-900">{inviteData.email}</span>
              </div>

              {inviteData.name && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Name:</span>
                  <span className="text-sm text-gray-900">{inviteData.name}</span>
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Role:</span>
                <div>{getRoleBadge(inviteData.role)}</div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Expires:</span>
                <span className="text-sm text-gray-900">
                  {new Date(inviteData.expires_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleAcceptInvite}
                disabled={accepting}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {accepting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    {user ? 'Accept Invite' : 'Continue to Sign Up'}
                  </>
                )}
              </Button>

              {user && (
                <p className="text-xs text-gray-500 text-center">
                  You're currently logged in as {user.email}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
