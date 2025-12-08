import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Coffee,
  Droplet,
  Loader2,
  LogOut,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  RefreshCcw,
  UtensilsCrossed,
  Clock,
  Zap,
  Moon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useSessionStore } from '@/store/sessionStore';
import { useBreakStore } from '@/store/breakStore';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

type UserRole = 'admin' | 'employee';

type ProfileRecord = {
  id: string;
  email: string | null;
  role: UserRole | null;
};

type BreakRecord = {
  id: string;
  session_id: string | null;
  user_id: string;
  type: 'lunch' | 'tea' | 'bio' | 'other';
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
};

const BREAK_OPTIONS: Array<{ value: BreakRecord['type']; label: string }> = [
  { value: 'lunch', label: 'Lunch' },
  { value: 'tea', label: 'Tea' },
  { value: 'bio', label: 'Bio' },
  { value: 'other', label: 'Other' },
];

const OTHER_BREAK_OPTIONS = [
  { value: 'training', label: 'Training' },
  { value: 'refresher', label: 'Refresher' },
  { value: 'floor_activity', label: 'Floor Activity' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'medical_break', label: 'Medical Break' },
];

const formatDateTime = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatDuration = (seconds: number | null | undefined) => {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const absolute = Math.max(0, seconds);
  const hours = Math.floor(absolute / 3600);
  const minutes = Math.floor((absolute % 3600) / 60);
  const remainingSeconds = absolute % 60;
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!hours && !minutes) parts.push(`${remainingSeconds}s`);
  return parts.join(' ');
};

const formatTimer = (seconds: number | null | undefined) => {
  if (seconds == null || Number.isNaN(seconds)) return '00:00:00';
  const absolute = Math.max(0, seconds);
  const hours = Math.floor(absolute / 3600);
  const minutes = Math.floor((absolute % 3600) / 60);
  const remainingSeconds = absolute % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const getLiveDurationSeconds = (startedAt: string) => {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now - start) / 1000));
};

const getBreakLabel = (type: BreakRecord['type']) =>
  BREAK_OPTIONS.find((option) => option.value === type)?.label ?? type;

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
};

const TimeTracking = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  // Session store
  const {
    sessions: employeeSessions,
    currentSession,
    loading: sessionLoading,
    error: sessionError,
    getEmployeeSessions,
    getCurrentSession,
    startSession,
    endSession,
    clearError: clearSessionError,
  } = useSessionStore();

  // Break store
  const {
    activeBreak,
    breakHistory,
    loading: breakLoading,
    error: breakError,
    startBreak,
    endBreak,
    getActiveBreak,
    getBreakHistory,
    clearError: clearBreakError,
  } = useBreakStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [sessionNotes, setSessionNotes] = useState('');
  const [liveDurationSeconds, setLiveDurationSeconds] = useState<number | null>(null);
  const [showIdleWarning, setShowIdleWarning] = useState<boolean>(false);

  const error = sessionError || breakError;

  const metadataFullName =
    typeof user?.user_metadata?.full_name === 'string'
      ? (user.user_metadata.full_name as string)
      : undefined;

  const displayName =
    profile?.email ||
    metadataFullName ||
    user?.email ||
    'there';
  const firstName = displayName.split(' ')[0] || displayName;

  const sessionIsActive = currentSession?.status === 'open';
  const sessionStartTime = currentSession ? formatDateTime(currentSession.started_at) : null;
  const sessionDurationLabel = sessionIsActive
    ? formatTimer(liveDurationSeconds)
    : formatDuration(currentSession?.duration_seconds);

  // Breaks are now independent - can start without a session
  const canStartBreak = Boolean(!activeBreak);
  const canEndBreak = Boolean(activeBreak);

  // Activity tracking for idle time detection
  const activityTracker = useActivityTracker({
    idleThresholdMs: 1 * 60 * 1000, // 1 minute to mark as idle
    idleWarningThresholdMs: 5 * 60 * 1000, // 5 minutes to show warning popup
    enabled: sessionIsActive && !activeBreak, // Only track when session is active and no break
    onIdleChange: (isIdle) => {
      if (!isIdle) {
        // Reset warning dialog when user becomes active again
        setShowIdleWarning(false);
      }
    },
    onIdleWarning: () => {
      // Show popup when idle for 5 minutes
      setShowIdleWarning(true);
    },
  });

  // Start/stop activity tracking based on session state
  useEffect(() => {
    if (sessionIsActive && !activeBreak) {
      activityTracker.startTracking();
    } else {
      activityTracker.stopTracking();
    }
    return () => {
      activityTracker.stopTracking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIsActive, activeBreak]);

  // Reset tracking when starting a new session
  useEffect(() => {
    if (sessionIsActive && currentSession) {
      activityTracker.resetTracking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession?.id]); // Only reset when session ID changes

  // Calculate today's productive time (since midnight)
  const todayProductiveTime = useMemo(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get all sessions that started today
    const todaySessions = employeeSessions.filter((session) => {
      const sessionDate = new Date(session.started_at);
      return sessionDate >= midnight;
    });

    // Sum up duration_seconds from completed sessions
    let totalSeconds = 0;
    todaySessions.forEach((session) => {
      if (session.status === 'closed' && session.duration_seconds) {
        totalSeconds += session.duration_seconds;
      } else if (session.status === 'open' && session.started_at) {
        // For active session, use live duration
        const sessionStart = new Date(session.started_at);
        if (sessionStart >= midnight) {
          // Only count if session started today
          if (liveDurationSeconds !== null) {
            totalSeconds += liveDurationSeconds;
          } else {
            // Fallback to calculated duration
            totalSeconds += getLiveDurationSeconds(session.started_at);
          }
        }
      }
    });

    return totalSeconds;
  }, [employeeSessions, liveDurationSeconds, currentSession]);

  // Calculate today's total breaks (since midnight)
  const todayTotalBreaks = useMemo(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Count breaks that started today (including active break if it started today)
    const todayBreaks = breakHistory.filter((breakItem) => {
      const breakDate = new Date(breakItem.started_at);
      return breakDate >= midnight;
    });

    // Also count active break if it started today
    let count = todayBreaks.length;
    if (activeBreak) {
      const activeBreakDate = new Date(activeBreak.started_at);
      if (activeBreakDate >= midnight) {
        // Check if it's not already in the history
        const alreadyCounted = todayBreaks.some((b) => b.id === activeBreak.id);
        if (!alreadyCounted) {
          count += 1;
        }
      }
    }

    return count;
  }, [breakHistory, activeBreak]);

  const renderBreakIcon = (type: BreakRecord['type']) => {
    const className = 'h-4 w-4';
    switch (type) {
      case 'lunch':
        return <UtensilsCrossed className={className} />;
      case 'tea':
        return <Coffee className={className} />;
      case 'bio':
        return <Droplet className={className} />;
      default:
        return <MoreHorizontal className={className} />;
    }
  };

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return null;

    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', user.id)
      .maybeSingle<ProfileRecord>();

    if (profileError) {
      throw profileError;
    }

    if (!data) {
      const { data: createdProfile, error: insertError } = await (supabase as any)
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          full_name: user.email?.split('@')[0] || 'User',
          role: 'employee',
        })
        .select('id, email, role')
        .single();

      if (insertError && !insertError.message?.includes('duplicate')) {
        throw insertError;
      }

      if (createdProfile) {
        setProfile(createdProfile);
        return createdProfile;
      }
    }

    setProfile(data);
    return data;
  }, [user?.id, user?.email]);

  const fetchEmployeeData = useCallback(
    async (profileId: string) => {
      // Fetch current session and active break (needed for controls)
      await getCurrentSession(profileId);
      await getActiveBreak(profileId);
      
      // Fetch all sessions for today's productive time calculation (no filters, just today's sessions)
      const today = new Date();
      const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      await getEmployeeSessions(profileId, { page: 1, pageSize: 100 }, {
        status: null,
        dateFrom: midnight.toISOString(),
        dateTo: null,
      });
      
      // Fetch today's breaks for total count
      await getBreakHistory(profileId, { page: 1, pageSize: 100 }, {
        type: null,
        dateFrom: midnight.toISOString(),
        dateTo: null,
      });
    },
    [getCurrentSession, getActiveBreak, getEmployeeSessions, getBreakHistory]
  );

  const refreshData = useCallback(async () => {
    if (!user?.id) return;

    setRefreshing(true);
    clearSessionError();
    clearBreakError();

    try {
      const loadedProfile = await fetchProfile();

      if (loadedProfile) {
        await fetchEmployeeData(loadedProfile.id);
      }
    } catch (refreshError: unknown) {
      console.error(refreshError);
      const errorMsg = getErrorMessage(refreshError);
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [user?.id, fetchProfile, fetchEmployeeData, clearSessionError, clearBreakError, toast]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (currentSession && currentSession.status === 'open') {
      setLiveDurationSeconds(getLiveDurationSeconds(currentSession.started_at));
      interval = setInterval(() => {
        setLiveDurationSeconds(getLiveDurationSeconds(currentSession.started_at));
      }, 1000); // Update every second for live timer
    } else {
      setLiveDurationSeconds(null);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentSession]);

  const handleStartSession = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    // Refresh active break before checking to ensure we have the latest state
    if (user?.id && profile?.id) {
      await getActiveBreak(profile.id);
      // Get the updated active break state after fetching (access store directly)
      const updatedActiveBreak = useBreakStore.getState().activeBreak;
      if (updatedActiveBreak) {
        toast({
          title: 'Cannot check in',
          description: 'Please end your break before checking in.',
          variant: 'destructive',
        });
        return;
      }
    }

    // Also check the current activeBreak state (in case we didn't need to refresh)
    if (activeBreak) {
      toast({
        title: 'Cannot check in',
        description: 'Please end your break before checking in.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const session = await startSession(sessionNotes || null);

      if (session) {
        toast({
          title: 'Session started',
          description: 'Your work session has started successfully.',
        });

        setSessionNotes('');
        if (user?.id && profile?.id) {
          await getCurrentSession(profile.id);
          await fetchEmployeeData(profile.id);
        }
      }
    } catch (startError: unknown) {
      const errorMessage = getErrorMessage(startError);
      const errorCode = typeof startError === 'object' && startError !== null ? (startError as { code?: string }).code : undefined;

      if (errorCode === '409' || errorMessage.includes('work_sessions_one_open_per_user')) {
        toast({
          title: 'Session already active',
          description: 'You already have an open session. Please check out before starting another.',
        });
        return;
      }

      if (errorMessage.includes('break is active') || errorMessage.includes('end your break') || errorMessage.includes('Please end your break first')) {
        // Refresh active break to show it in the UI
        if (user?.id && profile?.id) {
          await getActiveBreak(profile.id);
        }
        toast({
          title: 'Cannot check in',
          description: 'Please end your break before checking in.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Unable to start session',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleEndSession = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    if (!currentSession) return;

    try {
      await endSession(currentSession.id);

      toast({
        title: 'Session ended',
        description: 'Your work session has been closed.',
      });

      if (user?.id && profile?.id) {
        await getCurrentSession(profile.id);
        await fetchEmployeeData(profile.id);
      }
    } catch (endError: unknown) {
      const errorMessage = getErrorMessage(endError);
      const errorCode =
        typeof endError === 'object' && endError !== null
          ? (endError as { code?: string }).code
          : undefined;

      if (errorCode === 'P0001' || errorMessage.includes('No open session found')) {
        toast({
          title: 'No open session',
          description: 'There is no active session to end.',
        });
        if (user?.id && profile?.id) {
          await getCurrentSession(profile.id);
          await fetchEmployeeData(profile.id);
        }
        return;
      }

      toast({
        title: 'Unable to end session',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleStartBreak = async (breakType: BreakRecord['type'], otherBreakLabel?: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    if (activeBreak) {
      toast({
        title: 'Break already in progress',
        description: 'Please end the current break before starting a new one.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Breaks are now independent - can start without a session
      // If checked in, optionally link to current session, otherwise break is standalone
      const sessionId = (sessionIsActive && currentSession) ? currentSession.id : null;
      const newBreak = await startBreak(breakType, sessionId);

      if (newBreak) {
        const breakLabel = otherBreakLabel || getBreakLabel(breakType);
        toast({
          title: `${breakLabel} break started`,
          description: 'Enjoy your break!',
        });

        if (user?.id && profile?.id) {
          await getActiveBreak(profile.id);
        }
      }
    } catch (breakError: unknown) {
      const errorMessage = getErrorMessage(breakError);
      toast({
        title: 'Unable to start break',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleEndBreak = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    if (!activeBreak) return;

    // Save break type before clearing state
    const breakType = activeBreak.type;
    const breakToEnd = activeBreak;

    try {
      await endBreak(breakToEnd.id);

      toast({
        title: `${getBreakLabel(breakType)} break ended`,
        description: 'Welcome back!',
      });

      // Refresh break data in background to sync with server
      if (user?.id && profile?.id) {
        await getActiveBreak(profile.id);
      }
    } catch (breakError: unknown) {
      // On error, refresh data to restore correct state from server
      // This ensures UI matches database state
      if (user?.id && profile?.id) {
        await getActiveBreak(profile.id);
      }
      
      toast({
        title: 'Unable to end break',
        description: getErrorMessage(breakError),
        variant: 'destructive',
      });
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-muted-foreground">Please sign in to manage time tracking.</p>
      </div>
    );
  }

  if (loading || sessionLoading || breakLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-6 rounded-3xl bg-white/80 backdrop-blur-sm p-6 shadow-lg border border-slate-200/50 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">Anvesana</p>
            <p className="text-sm text-slate-600 mt-1">Welcome, {firstName}.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                refreshData();
              }}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Refreshing
                </>
              ) : (
                <>
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                signOut();
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </header>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Today's Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Today's Productive Time Card */}
          <Card className="border-2 border-emerald-200/50 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 shadow-xl hover:shadow-2xl transition-shadow duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Today's Productive Time</p>
                  <p className="text-xs text-slate-500 mt-1">Tracked since midnight</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-emerald-100">
                    <Clock className="h-6 w-6 text-emerald-600" />
                  </div>
                  <span className="text-3xl font-mono font-bold text-emerald-700 tabular-nums drop-shadow-sm">
                    {formatTimer(todayProductiveTime)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Today's Total Breaks Card */}
          <Card className="border-2 border-purple-200/50 bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 shadow-xl hover:shadow-2xl transition-shadow duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Today's Total Breaks</p>
                  <p className="text-xs text-slate-500 mt-1">Counted since midnight</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-purple-100">
                    <Coffee className="h-6 w-6 text-purple-600" />
                  </div>
                  <span className="text-3xl font-mono font-bold text-purple-700 tabular-nums drop-shadow-sm">
                    {todayTotalBreaks}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <section className="grid gap-6 md:grid-cols-2">
          <Card className="border-2 border-sky-200/50 bg-white/90 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold text-slate-800">Work Session</CardTitle>
              <CardDescription className="text-slate-600">
                Start your work day
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {sessionIsActive ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border-2 border-sky-300/50 bg-gradient-to-br from-sky-50 to-blue-50 p-5 text-sm shadow-md">
                    <p className="font-semibold text-slate-800 mb-3">You are currently checked in.</p>
                    <div className="mt-3 grid gap-3">
                      {sessionStartTime && <span className="text-slate-600 text-xs">Started at {sessionStartTime}</span>}
                      {sessionDurationLabel && (
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-sky-100">
                            <Clock className="h-5 w-5 text-sky-600" />
                          </div>
                          <span className="text-2xl font-mono font-bold text-sky-700 tabular-nums drop-shadow-sm">
                            {sessionDurationLabel}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Activity Tracking Display */}
                  {!activeBreak && (
                    <div className="rounded-2xl border-2 border-slate-200/50 bg-gradient-to-br from-white to-slate-50/50 p-5 text-sm shadow-md">
                      <div className="flex items-center justify-between mb-4">
                        <p className="font-semibold text-slate-800">Activity Status</p>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100">
                          {activityTracker.isIdle ? (
                            <>
                              <Moon className="h-4 w-4 text-amber-500" />
                              <span className="text-xs font-semibold text-amber-600">Idle</span>
                            </>
                          ) : (
                            <>
                              <Zap className="h-4 w-4 text-emerald-500" />
                              <span className="text-xs font-semibold text-emerald-600">Active</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-3 border-t-2 border-slate-100">
                        <div className="p-3 rounded-lg bg-emerald-50/50">
                          <p className="text-xs text-slate-600 mb-1.5 font-medium">Active Time</p>
                          <p className="text-lg font-mono font-bold text-emerald-700 tabular-nums">
                            {formatTimer(activityTracker.activeTime)}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-amber-50/50">
                          <p className="text-xs text-slate-600 mb-1.5 font-medium">Idle Time</p>
                          <p className="text-lg font-mono font-bold text-amber-700 tabular-nums">
                            {formatTimer(activityTracker.idleTime)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-slate-300/50 bg-gradient-to-br from-slate-50 to-slate-100/50 p-5 text-sm text-slate-600 shadow-inner">
                  <p className="font-medium">You're currently checked out. Add optional notes and tap check in when you're ready.</p>
                </div>
              )}

              {!sessionIsActive && (
                <Textarea
                  placeholder="Optional notes for this session"
                  value={sessionNotes}
                  onChange={(event) => setSessionNotes(event.target.value)}
                  rows={3}
                />
              )}

              <Button
                type="button"
                className={`w-full gap-2 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 ${
                  sessionIsActive
                    ? 'bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 text-white'
                    : 'bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white'
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (sessionIsActive) {
                    handleEndSession(e);
                  } else {
                    handleStartSession(e);
                  }
                }}
                disabled={!sessionIsActive && activeBreak !== null}
              >
                {sessionIsActive ? (
                  <>
                    <PauseCircle className="h-4 w-4" />
                    Check Out
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4" />
                    Check In
                  </>
                )}
              </Button>
              {!sessionIsActive && activeBreak !== null && (
                <p className="text-xs text-rose-600 text-center">
                  End your break to check in
                </p>
              )}
            </CardContent>
          </Card>

          {/* Show break tracker when checked out OR when there's an active break */}
          {(!sessionIsActive || activeBreak) && (
            <Card className="border-2 border-purple-200/50 bg-white/90 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold text-slate-800">Break Tracking</CardTitle>
                <CardDescription className="text-slate-600">Take a break when needed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {activeBreak ? (
                  <>
                    <div className="rounded-2xl border-2 border-purple-300/50 bg-gradient-to-br from-purple-50 to-pink-50 p-5 text-sm text-slate-700 shadow-md">
                      <p className="font-semibold text-slate-800 mb-2">
                        {getBreakLabel(activeBreak.type)} break in progress
                      </p>
                      <p className="text-xs text-slate-600">
                        Started at {formatDateTime(activeBreak.started_at)}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full gap-2 shadow-md hover:shadow-lg transition-all duration-300 font-semibold"
                      disabled={!canEndBreak}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleEndBreak(e);
                      }}
                    >
                      <PauseCircle className="h-4 w-4" />
                      End Break
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {BREAK_OPTIONS.map((option) => {
                        if (option.value === 'other') {
                          return (
                            <div key={option.value} className="relative">
                              <Select
                                disabled={!canStartBreak}
                                onValueChange={(value) => {
                                  handleStartBreak('other', value);
                                }}
                              >
                                <SelectTrigger className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200/50 text-slate-700 shadow-md hover:shadow-lg transition-all duration-300 hover:border-purple-300 hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <SelectValue placeholder={option.label} />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-2 border-slate-200/50 bg-white shadow-lg min-w-[var(--radix-select-trigger-width)]">
                                  {OTHER_BREAK_OPTIONS.map((otherOption) => (
                                    <SelectItem 
                                      key={otherOption.value} 
                                      value={otherOption.label}
                                      className="cursor-pointer rounded-lg px-3 py-2 text-slate-700 hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50 focus:bg-gradient-to-br focus:from-purple-50 focus:to-pink-50 transition-colors"
                                    >
                                      {otherOption.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        }
                        return (
                          <Button
                            type="button"
                            key={option.value}
                            variant="outline"
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200/50 text-slate-700 shadow-md hover:shadow-lg transition-all duration-300 hover:border-purple-300 hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50 font-medium"
                            disabled={!canStartBreak}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleStartBreak(option.value, undefined, e);
                            }}
                          >
                            {renderBreakIcon(option.value)}
                            {option.label}
                          </Button>
                        );
                      })}
                    </div>
                    <p className="text-sm text-slate-500">
                      Select a break type to start tracking your break.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      {/* Idle Warning Dialog */}
      <Dialog open={showIdleWarning} onOpenChange={setShowIdleWarning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-amber-500" />
              You've been idle for 5 minutes
            </DialogTitle>
            <DialogDescription>
              You've been inactive for 5 minutes. This time is not being counted as productive work time.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm text-amber-800 mb-2">
                <strong>Current Status:</strong>
              </p>
              <div className="space-y-1 text-sm text-amber-700">
                <div className="flex justify-between">
                  <span>Active Time:</span>
                  <span className="font-mono font-semibold">{formatTimer(activityTracker.activeTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Idle Time:</span>
                  <span className="font-mono font-semibold">{formatTimer(activityTracker.idleTime)}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Move your mouse or type to resume tracking active time.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowIdleWarning(false);
              }}
            >
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TimeTracking;
