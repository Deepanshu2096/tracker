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
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type UserRole = 'employee' | 'admin';

type ProfileRecord = {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
};

type WorkSessionRecord = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: 'open' | 'closed';
  notes: string | null;
};

type BreakRecord = {
  id: string;
  session_id: string;
  type: 'lunch' | 'tea' | 'bio' | 'other';
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
};

type ActivityLogRecord = {
  id: string;
  actor_id: string | null;
  target_user_id: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const BREAK_OPTIONS: Array<{ value: BreakRecord['type']; label: string }> = [
  { value: 'lunch', label: 'Lunch' },
  { value: 'tea', label: 'Tea' },
  { value: 'bio', label: 'Bio' },
  { value: 'other', label: 'Other' },
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

const getLiveDurationSeconds = (startedAt: string) => {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now - start) / 1000));
};

const metadataPreview = (metadata: Record<string, unknown> | null) => {
  if (!metadata || Object.keys(metadata).length === 0) return '—';
  try {
    return JSON.stringify(metadata);
  } catch {
    return '—';
  }
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

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [currentSession, setCurrentSession] = useState<WorkSessionRecord | null>(null);
  const [employeeSessions, setEmployeeSessions] = useState<WorkSessionRecord[]>([]);
  const [activeBreak, setActiveBreak] = useState<BreakRecord | null>(null);
  const [breakHistory, setBreakHistory] = useState<BreakRecord[]>([]);

  const [adminActiveSessions, setAdminActiveSessions] = useState<WorkSessionRecord[]>([]);
  const [adminRecentSessions, setAdminRecentSessions] = useState<WorkSessionRecord[]>([]);
  const [adminActivityLogs, setAdminActivityLogs] = useState<ActivityLogRecord[]>([]);
  const [profilesDirectory, setProfilesDirectory] = useState<Record<string, ProfileRecord>>({});

  const [sessionNotes, setSessionNotes] = useState('');

  const [liveDurationSeconds, setLiveDurationSeconds] = useState<number | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const isAdmin = useMemo(() => profile?.role === 'admin', [profile]);

  useEffect(() => {
    if (!isAdmin) {
      setShowAdminPanel(false);
    }
  }, [isAdmin]);

  const metadataFullName =
    typeof user?.user_metadata?.full_name === 'string'
      ? (user.user_metadata.full_name as string)
      : undefined;

  const displayName =
    profile?.full_name?.trim() ||
    profile?.email ||
    metadataFullName ||
    user?.email ||
    'there';
  const firstName = displayName.split(' ')[0] || displayName;

  const sessionIsActive = currentSession?.status === 'open';
  const sessionStartTime = currentSession ? formatDateTime(currentSession.started_at) : null;
  const sessionDurationLabel = sessionIsActive
    ? formatDuration(liveDurationSeconds)
    : formatDuration(currentSession?.duration_seconds);
  const canStartBreak = Boolean(currentSession && !activeBreak);
  const canEndBreak = Boolean(activeBreak);

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
      .select('id, full_name, email, role')
      .eq('id', user.id)
      .maybeSingle<ProfileRecord>();

    if (profileError) {
      throw profileError;
    }

    if (!data) {
      const fallbackName = metadataFullName || user.email || 'New User';
      const { data: createdProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          full_name: fallbackName,
          email: user.email,
          role: 'employee',
        })
        .select('id, full_name, email, role')
        .single<ProfileRecord>();

      if (insertError) {
        throw insertError;
      }

      setProfile(createdProfile);
      return createdProfile;
    }

    setProfile(data);
    return data;
  }, [user?.id, metadataFullName, user?.email]);

  const fetchEmployeeData = useCallback(
    async (profileId: string) => {
      const { data: sessions, error: sessionsError } = await supabase
        .from('work_sessions')
        .select('id, user_id, started_at, ended_at, duration_seconds, status, notes')
        .eq('user_id', profileId)
        .order('started_at', { ascending: false })
        .limit(25);

      if (sessionsError) {
        throw sessionsError;
      }

      const current = sessions?.find((session) => session.status === 'open') ?? null;

      setEmployeeSessions(sessions ?? []);
      setCurrentSession(current);

      if (current) {
        const { data: activeBreakData } = await supabase
          .from('breaks')
          .select('id, session_id, type, started_at, ended_at, duration_seconds')
          .eq('session_id', current.id)
          .is('ended_at', null)
          .maybeSingle<BreakRecord>();

        setActiveBreak(activeBreakData ?? null);

        const { data: breakHistoryData, error: breakHistoryError } = await supabase
          .from('breaks')
          .select('id, session_id, type, started_at, ended_at, duration_seconds')
          .eq('session_id', current.id)
          .order('started_at', { ascending: false })
          .limit(25);

        if (breakHistoryError) {
          throw breakHistoryError;
        }

        setBreakHistory(breakHistoryData ?? []);
      } else {
        setActiveBreak(null);
        setBreakHistory([]);
      }
    },
    []
  );

  const fetchAdminData = useCallback(async () => {
    const [{ data: allProfiles, error: profilesError }, { data: activeSessions, error: activeSessionsError }, { data: recentSessions, error: recentSessionsError }, { data: activityLogs, error: activityLogsError }] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .order('full_name', { ascending: true }),
        supabase
          .from('work_sessions')
          .select('id, user_id, started_at, ended_at, duration_seconds, status, notes')
          .eq('status', 'open')
          .order('started_at', { ascending: false }),
        supabase
          .from('work_sessions')
          .select('id, user_id, started_at, ended_at, duration_seconds, status, notes')
          .order('started_at', { ascending: false })
          .limit(50),
        supabase
          .from('activity_logs')
          .select('id, actor_id, target_user_id, action, metadata, created_at')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

    if (profilesError) throw profilesError;
    if (activeSessionsError) throw activeSessionsError;
    if (recentSessionsError) throw recentSessionsError;
    if (activityLogsError) throw activityLogsError;

    const directory = Object.fromEntries((allProfiles ?? []).map((item) => [item.id, item]));

    setProfilesDirectory(directory);
    setAdminActiveSessions(activeSessions ?? []);
    setAdminRecentSessions(recentSessions ?? []);
    setAdminActivityLogs(activityLogs ?? []);
  }, []);

  const refreshData = useCallback(async () => {
    if (!user?.id) return;

    setRefreshing(true);
    setError(null);

    try {
      const loadedProfile = await fetchProfile();

      if (loadedProfile) {
        await fetchEmployeeData(loadedProfile.id);

        if (loadedProfile.role === 'admin') {
          await fetchAdminData();
        }
      }
    } catch (refreshError: unknown) {
      console.error(refreshError);
      setError(getErrorMessage(refreshError));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [user?.id, fetchProfile, fetchEmployeeData, fetchAdminData]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (currentSession && currentSession.status === 'open') {
      setLiveDurationSeconds(getLiveDurationSeconds(currentSession.started_at));
      interval = setInterval(() => {
        setLiveDurationSeconds(getLiveDurationSeconds(currentSession.started_at));
      }, 30000);
    } else {
      setLiveDurationSeconds(null);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentSession]);

  const handleStartSession = async () => {
    try {
      const { data, error: rpcError } = await supabase.rpc('start_session', {
        notes: sessionNotes || null,
      });

      if (rpcError) throw rpcError;

      toast({
        title: 'Session started',
        description: 'Your work session has started successfully.',
      });

      setSessionNotes('');
      setCurrentSession(data as WorkSessionRecord);
      await refreshData();
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

      toast({
        title: 'Unable to start session',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleEndSession = async () => {
    if (!currentSession) return;

    try {
      const { error: rpcError } = await supabase.rpc('end_session', {
        session_id: currentSession.id,
      });

      if (rpcError) throw rpcError;

      toast({
        title: 'Session ended',
        description: 'Your work session has been closed.',
      });

      await refreshData();
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
        await refreshData();
        return;
      }

      toast({
        title: 'Unable to end session',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleStartBreak = async (breakType: BreakRecord['type']) => {
    if (!currentSession) return;

    try {
      const { error: rpcError } = await supabase.rpc('start_break', {
        session_id: currentSession.id,
        break_type: breakType,
      });

      if (rpcError) throw rpcError;

      toast({
        title: `${getBreakLabel(breakType)} break started`,
        description: 'Enjoy your break!',
      });

      await refreshData();
    } catch (breakError: unknown) {
      toast({
        title: 'Unable to start break',
        description: getErrorMessage(breakError),
        variant: 'destructive',
      });
    }
  };

  const handleEndBreak = async () => {
    if (!activeBreak) return;

    try {
      const { error: rpcError } = await supabase.rpc('end_break', {
        break_id: activeBreak.id,
      });

      if (rpcError) throw rpcError;

      toast({
        title: `${getBreakLabel(activeBreak.type)} break ended`,
        description: 'Welcome back!',
      });

      await refreshData();
    } catch (breakError: unknown) {
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-6 rounded-3xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-2xl font-semibold text-sky-600">Anvesana</p>
            <p className="text-sm text-muted-foreground">Welcome, {firstName}.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={refreshData}
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
            {isAdmin && (
              <Button
                variant={showAdminPanel ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
                onClick={() => setShowAdminPanel((prev) => !prev)}
              >
                {showAdminPanel ? 'Hide Admin Panel' : 'Admin Panel'}
              </Button>
            )}
            <Button variant="secondary" size="sm" className="gap-2" onClick={signOut}>
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

        <section className="grid gap-6 md:grid-cols-2">
          <Card className="border border-sky-100 bg-white shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-slate-800">Work Session</CardTitle>
              <CardDescription className="text-slate-500">
                Start your work day
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {sessionIsActive ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm">
                  <p className="font-medium text-slate-700">You are currently checked in.</p>
                  <div className="mt-2 grid gap-1 text-slate-500">
                    {sessionStartTime && <span>Started at {sessionStartTime}</span>}
                    {sessionDurationLabel && <span>Elapsed time {sessionDurationLabel}</span>}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  <p>You're currently checked out. Add optional notes and tap check in when you're ready.</p>
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
                className={`w-full gap-2 text-base font-medium ${
                  sessionIsActive
                    ? 'bg-rose-500 hover:bg-rose-500/90 text-white'
                    : 'bg-sky-500 hover:bg-sky-500/90 text-white'
                }`}
                onClick={sessionIsActive ? handleEndSession : handleStartSession}
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
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-slate-800">Break Tracking</CardTitle>
              <CardDescription>Take a break when needed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!currentSession && (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Start a work session to enable break tracking.
                </p>
              )}

              {currentSession && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {BREAK_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        variant="outline"
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-slate-200 text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50"
                        disabled={!canStartBreak}
                        onClick={() => handleStartBreak(option.value)}
                      >
                        {renderBreakIcon(option.value)}
                        {option.label}
                      </Button>
                    ))}
                  </div>

                  {activeBreak ? (
                    <div className="rounded-2xl border border-slate-200 bg-sky-50 p-4 text-sm text-slate-700">
                      <p className="font-medium">
                        {getBreakLabel(activeBreak.type)} break in progress
                      </p>
                      <p className="text-xs text-slate-500">
                        Started at {formatDateTime(activeBreak.started_at)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Select a break type to log it.</p>
                  )}

                  <Button
                    variant="secondary"
                    className="w-full gap-2"
                    disabled={!canEndBreak}
                    onClick={handleEndBreak}
                  >
                    <PauseCircle className="h-4 w-4" />
                    End Break
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {employeeSessions.length > 0 && (
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle>Recent Sessions</CardTitle>
              <CardDescription>Your last 25 sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Ended</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <Badge variant={session.status === 'open' ? 'default' : 'secondary'}>
                          {session.status === 'open' ? 'Open' : 'Closed'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(session.started_at)}</TableCell>
                      <TableCell>{formatDateTime(session.ended_at)}</TableCell>
                      <TableCell>{formatDuration(session.duration_seconds)}</TableCell>
                      <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                        {session.notes ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {breakHistory.length > 0 && (
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle>Recent Breaks</CardTitle>
              <CardDescription>Breaks taken during this session</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Ended</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{getBreakLabel(item.type)}</TableCell>
                      <TableCell>{formatDateTime(item.started_at)}</TableCell>
                      <TableCell>{formatDateTime(item.ended_at)}</TableCell>
                      <TableCell>{formatDuration(item.duration_seconds)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {showAdminPanel && isAdmin && (
          <section className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-800">Admin Panel</h2>

            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>Active Sessions</CardTitle>
                <CardDescription>Employees currently clocked in</CardDescription>
              </CardHeader>
              <CardContent>
                {adminActiveSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active sessions right now.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Elapsed</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminActiveSessions.map((session) => {
                        const owner = profilesDirectory[session.user_id];
                        return (
                          <TableRow key={session.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {owner?.full_name ?? owner?.email ?? 'Unknown user'}
                                </span>
                                {owner?.email && (
                                  <span className="text-xs text-muted-foreground">{owner.email}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{formatDateTime(session.started_at)}</TableCell>
                            <TableCell>
                              {formatDuration(getLiveDurationSeconds(session.started_at))}
                            </TableCell>
                            <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">
                              {session.notes ?? '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>Recent Sessions</CardTitle>
                <CardDescription>Latest shifts across the organization</CardDescription>
              </CardHeader>
              <CardContent>
                {adminRecentSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sessions recorded yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Ended</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminRecentSessions.map((session) => {
                        const owner = profilesDirectory[session.user_id];
                        return (
                          <TableRow key={session.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {owner?.full_name ?? owner?.email ?? 'Unknown user'}
                                </span>
                                {owner?.email && (
                                  <span className="text-xs text-muted-foreground">{owner.email}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={session.status === 'open' ? 'default' : 'secondary'}>
                                {session.status === 'open' ? 'Open' : 'Closed'}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatDateTime(session.started_at)}</TableCell>
                            <TableCell>{formatDateTime(session.ended_at)}</TableCell>
                            <TableCell>{formatDuration(session.duration_seconds)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>Activity Logs</CardTitle>
                <CardDescription>Auditable record of session and break events</CardDescription>
              </CardHeader>
              <CardContent>
                {adminActivityLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminActivityLogs.map((log) => {
                        const actor = log.actor_id ? profilesDirectory[log.actor_id] : null;
                        const target = log.target_user_id
                          ? profilesDirectory[log.target_user_id]
                          : null;
                        return (
                          <TableRow key={log.id}>
                            <TableCell>{formatDateTime(log.created_at)}</TableCell>
                            <TableCell>{actor?.full_name ?? actor?.email ?? 'System'}</TableCell>
                            <TableCell className="capitalize">{log.action}</TableCell>
                            <TableCell>{target?.full_name ?? target?.email ?? '—'}</TableCell>
                            <TableCell className="max-w-[320px] truncate text-xs text-muted-foreground">
                              {metadataPreview(log.metadata)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
};

export default TimeTracking;

