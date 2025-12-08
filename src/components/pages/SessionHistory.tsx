import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Loader2, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSessionStore } from '@/store/sessionStore';
import { useBreakStore } from '@/store/breakStore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type UserRole = 'admin' | 'manager' | 'annotator' | 'reviewer';

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

const PAGE_SIZE = 10;
const ADMIN_PAGE_SIZE = 10;

const SessionHistory = () => {
  const { user } = useAuth();

  // Session store
  const {
    sessions: employeeSessions,
    adminActiveSessions,
    adminRecentSessions,
    adminRecentSessionsPage,
    adminRecentSessionsTotal,
    employeeSessionsPage,
    employeeSessionsTotal,
    getEmployeeSessions,
    getAdminActiveSessions,
    getAdminRecentSessions,
    setAdminRecentSessionsPage,
    setEmployeeSessionsPage,
    loading: sessionLoading,
    error: sessionError,
  } = useSessionStore();

  // Break store
  const {
    breakHistory,
    breakHistoryPage,
    breakHistoryTotal,
    getBreakHistory,
    setBreakHistoryPage,
    loading: breakLoading,
    error: breakError,
  } = useBreakStore();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [adminActivityLogs, setAdminActivityLogs] = useState<ActivityLogRecord[]>([]);
  const [profilesDirectory, setProfilesDirectory] = useState<Record<string, ProfileRecord>>({});
  const [adminActivityLogsPage, setAdminActivityLogsPage] = useState(0);
  const [adminActivityLogsTotal, setAdminActivityLogsTotal] = useState(0);
  const [dailyBreaksData, setDailyBreaksData] = useState<Array<{
    user_id: string;
    date: string;
    total_break_seconds: number;
    break_count: number;
  }>>([]);
  const [loadingDailyBreaks, setLoadingDailyBreaks] = useState(false);

  // Local filter states
  const [sessionStatusFilter, setSessionStatusFilter] = useState<string>('all');
  const [sessionDateFrom, setSessionDateFrom] = useState<string>('');
  const [sessionDateTo, setSessionDateTo] = useState<string>('');
  const [breakTypeFilter, setBreakTypeFilter] = useState<string>('all');
  const [breakDateFrom, setBreakDateFrom] = useState<string>('');
  const [breakDateTo, setBreakDateTo] = useState<string>('');

  const error = sessionError || breakError;
  const isAdmin = useMemo(() => profile?.role === 'admin' || profile?.role === 'manager', [profile]);

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
      const { data: createdProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          role: 'annotator' as UserRole,
          user_id: user.id,
        })
        .select('id, email, role')
        .single<ProfileRecord>();

      if (insertError) {
        throw insertError;
      }

      setProfile(createdProfile);
      return createdProfile;
    }

    setProfile(data);
    return data;
  }, [user?.id, user?.email]);

  const fetchEmployeeData = useCallback(
    async (profileId: string) => {
      const sessionFilters = {
        status: sessionStatusFilter === 'all' ? null : (sessionStatusFilter as 'open' | 'closed'),
        dateFrom: sessionDateFrom || null,
        dateTo: sessionDateTo || null,
      };

      const breakFilters = {
        type: breakTypeFilter === 'all' ? null : (breakTypeFilter as 'lunch' | 'tea' | 'bio' | 'other'),
        dateFrom: breakDateFrom || null,
        dateTo: breakDateTo || null,
      };

      await getEmployeeSessions(profileId, { page: employeeSessionsPage, pageSize: PAGE_SIZE }, sessionFilters);
      await getBreakHistory(profileId, { page: breakHistoryPage, pageSize: PAGE_SIZE }, breakFilters);
    },
    [getEmployeeSessions, getBreakHistory, employeeSessionsPage, breakHistoryPage, sessionStatusFilter, sessionDateFrom, sessionDateTo, breakTypeFilter, breakDateFrom, breakDateTo]
  );

  const fetchDailyBreaks = useCallback(async () => {
    setLoadingDailyBreaks(true);
    try {
      // Get breaks from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      // First get all breaks from the last 30 days
      const { data: breaks, error: breaksError } = await (supabase as any)
        .from('breaks')
        .select('id, session_id, started_at, ended_at, duration_seconds')
        .gte('started_at', thirtyDaysAgo.toISOString())
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false });

      if (breaksError) throw breaksError;

      // Get unique session IDs
      const sessionIds = [...new Set(breaks?.map((b: any) => b.session_id).filter(Boolean) || [])];
      
      // Get sessions with user_id
      const { data: sessions, error: sessionsError } = await (supabase as any)
        .from('work_sessions')
        .select('id, user_id')
        .in('id', sessionIds);

      if (sessionsError) throw sessionsError;

      // Create a map of session_id to user_id
      const sessionToUserMap: Record<string, string> = {};
      sessions?.forEach((session: any) => {
        sessionToUserMap[session.id] = session.user_id;
      });

      if (breaksError) throw breaksError;

      // Group breaks by user and date
      const breaksByUserAndDate: Record<string, {
        user_id: string;
        date: string;
        total_break_seconds: number;
        break_count: number;
      }> = {};

      breaks?.forEach((breakItem: any) => {
        const user_id = sessionToUserMap[breakItem.session_id];
        if (!user_id) return; // Skip if no user_id found

        const breakDate = new Date(breakItem.started_at);
        const dateKey = breakDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const userDateKey = `${user_id}_${dateKey}`;

        if (!breaksByUserAndDate[userDateKey]) {
          breaksByUserAndDate[userDateKey] = {
            user_id: user_id,
            date: dateKey,
            total_break_seconds: 0,
            break_count: 0,
          };
        }

        const duration = breakItem.duration_seconds || 0;
        breaksByUserAndDate[userDateKey].total_break_seconds += duration;
        breaksByUserAndDate[userDateKey].break_count += 1;
      });

      // Convert to array and sort by date (newest first)
      const dailyBreaksArray = Object.values(breaksByUserAndDate).sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      setDailyBreaksData(dailyBreaksArray);
    } catch (error: any) {
      console.error('Error fetching daily breaks:', error);
    } finally {
      setLoadingDailyBreaks(false);
    }
  }, []);

  const fetchAdminData = useCallback(async () => {
    try {
      const profilesRes = await supabase
        .from('profiles')
        .select('id, email, role')
        .order('email', { ascending: true });

      if (profilesRes.error) throw profilesRes.error;

      const directory = Object.fromEntries((profilesRes.data ?? []).map((item) => [item.id, item]));
      setProfilesDirectory(directory);

      setAdminActivityLogs([]);
      setAdminActivityLogsTotal(0);

      await getAdminActiveSessions();
      await getAdminRecentSessions({ page: adminRecentSessionsPage, pageSize: ADMIN_PAGE_SIZE });
      await fetchDailyBreaks();
    } catch (error: any) {
      throw error;
    }
  }, [adminRecentSessionsPage, getAdminActiveSessions, getAdminRecentSessions, fetchDailyBreaks]);

  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        const userProfile = await fetchProfile();
        if (userProfile && userProfile.id) {
          await fetchEmployeeData(userProfile.id);
        }
        if (isAdmin) {
          await fetchAdminData();
        }
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.id, fetchProfile, fetchEmployeeData, fetchAdminData, isAdmin]);

  // Reload when filters change
  useEffect(() => {
    if (user?.id && profile) {
      fetchEmployeeData(profile.id);
    }
  }, [sessionStatusFilter, sessionDateFrom, sessionDateTo, breakTypeFilter, breakDateFrom, breakDateTo, user?.id, profile, fetchEmployeeData]);

  // Load admin data when isAdmin and profile are available
  useEffect(() => {
    if (isAdmin && profile) {
      fetchAdminData();
    }
  }, [isAdmin, profile, fetchAdminData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Session History</h1>
          <p className="text-slate-600 mt-1">View and filter your work sessions and breaks</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Employee View - Recent Sessions */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
          <CardDescription>Filter and view your session history</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select
                value={sessionStatusFilter}
                onValueChange={(value: string) => {
                  setSessionStatusFilter(value);
                  setEmployeeSessionsPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Date From</label>
              <Input
                type="date"
                value={sessionDateFrom}
                onChange={(e) => {
                  setSessionDateFrom(e.target.value);
                  setEmployeeSessionsPage(1);
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Date To</label>
              <Input
                type="date"
                value={sessionDateTo}
                onChange={(e) => {
                  setSessionDateTo(e.target.value);
                  setEmployeeSessionsPage(1);
                }}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSessionStatusFilter('all');
                  setSessionDateFrom('');
                  setSessionDateTo('');
                  setEmployeeSessionsPage(1);
                  if (user?.id && profile) {
                    fetchEmployeeData(profile.id);
                  }
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Table */}
          {employeeSessions.length > 0 ? (
            <>
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
              {/* Pagination */}
              {employeeSessionsTotal > PAGE_SIZE && (
                <CardFooter className="flex items-center justify-between border-t border-slate-100 px-0 pt-4 text-xs text-slate-500">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const newPage = Math.max(1, employeeSessionsPage - 1);
                      setEmployeeSessionsPage(newPage);
                      if (user?.id && profile) {
                        const filters = {
                          status: sessionStatusFilter === 'all' ? null : (sessionStatusFilter as 'open' | 'closed'),
                          dateFrom: sessionDateFrom || null,
                          dateTo: sessionDateTo || null,
                        };
                        await getEmployeeSessions(profile.id, { page: newPage, pageSize: PAGE_SIZE }, filters);
                      }
                    }}
                    disabled={employeeSessionsPage === 1}
                  >
                    Previous
                  </Button>
                  <span>
                    Page {employeeSessionsPage} of {Math.max(1, Math.ceil(employeeSessionsTotal / PAGE_SIZE))} ({employeeSessionsTotal} total)
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const newPage = employeeSessionsPage + 1;
                      if (newPage <= Math.ceil(employeeSessionsTotal / PAGE_SIZE)) {
                        setEmployeeSessionsPage(newPage);
                        if (user?.id && profile) {
                          const filters = {
                            status: sessionStatusFilter === 'all' ? null : (sessionStatusFilter as 'open' | 'closed'),
                            dateFrom: sessionDateFrom || null,
                            dateTo: sessionDateTo || null,
                          };
                          await getEmployeeSessions(profile.id, { page: newPage, pageSize: PAGE_SIZE }, filters);
                        }
                      }
                    }}
                    disabled={employeeSessionsPage >= Math.ceil(employeeSessionsTotal / PAGE_SIZE)}
                  >
                    Next
                  </Button>
                </CardFooter>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No sessions found.</p>
          )}
        </CardContent>
      </Card>

      {/* Employee View - Recent Breaks */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle>Recent Breaks</CardTitle>
          <CardDescription>Filter and view your break history</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Break Type</label>
              <Select
                value={breakTypeFilter}
                onValueChange={(value: string) => {
                  setBreakTypeFilter(value);
                  setBreakHistoryPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="tea">Tea</SelectItem>
                  <SelectItem value="bio">Bio</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Date From</label>
              <Input
                type="date"
                value={breakDateFrom}
                onChange={(e) => {
                  setBreakDateFrom(e.target.value);
                  setBreakHistoryPage(1);
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Date To</label>
              <Input
                type="date"
                value={breakDateTo}
                onChange={(e) => {
                  setBreakDateTo(e.target.value);
                  setBreakHistoryPage(1);
                }}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setBreakTypeFilter('all');
                  setBreakDateFrom('');
                  setBreakDateTo('');
                  setBreakHistoryPage(1);
                  if (user?.id && profile) {
                    fetchEmployeeData(profile.id);
                  }
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Table */}
          {breakHistory.length > 0 ? (
            <>
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
              {/* Pagination */}
              {breakHistoryTotal > PAGE_SIZE && (
                <CardFooter className="flex items-center justify-between border-t border-slate-100 px-0 pt-4 text-xs text-slate-500">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const newPage = Math.max(1, breakHistoryPage - 1);
                      setBreakHistoryPage(newPage);
                      if (user?.id && profile) {
                        const filters = {
                          type: breakTypeFilter === 'all' ? null : (breakTypeFilter as 'lunch' | 'tea' | 'bio' | 'other'),
                          dateFrom: breakDateFrom || null,
                          dateTo: breakDateTo || null,
                        };
                        await getBreakHistory(profile.id, { page: newPage, pageSize: PAGE_SIZE }, filters);
                      }
                    }}
                    disabled={breakHistoryPage === 1}
                  >
                    Previous
                  </Button>
                  <span>
                    Page {breakHistoryPage} of {Math.max(1, Math.ceil(breakHistoryTotal / PAGE_SIZE))} ({breakHistoryTotal} total)
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const newPage = breakHistoryPage + 1;
                      if (newPage <= Math.ceil(breakHistoryTotal / PAGE_SIZE)) {
                        setBreakHistoryPage(newPage);
                        if (user?.id && profile) {
                          const filters = {
                            type: breakTypeFilter === 'all' ? null : (breakTypeFilter as 'lunch' | 'tea' | 'bio' | 'other'),
                            dateFrom: breakDateFrom || null,
                            dateTo: breakDateTo || null,
                          };
                          await getBreakHistory(profile.id, { page: newPage, pageSize: PAGE_SIZE }, filters);
                        }
                      }
                    }}
                    disabled={breakHistoryPage >= Math.ceil(breakHistoryTotal / PAGE_SIZE)}
                  >
                    Next
                  </Button>
                </CardFooter>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No breaks found.</p>
          )}
        </CardContent>
      </Card>

      {/* Attendance Section */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Attendance
          </CardTitle>
          <CardDescription>Daily attendance records and statistics</CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            const attendanceByDate = new Map<string, {
              date: string;
              sessions: typeof employeeSessions;
              totalHours: number;
              checkIn: string | null;
              checkOut: string | null;
              status: 'present' | 'absent' | 'partial';
            }>();

            employeeSessions.forEach((session) => {
              const sessionDate = new Date(session.started_at).toISOString().split('T')[0];
              
              if (!attendanceByDate.has(sessionDate)) {
                attendanceByDate.set(sessionDate, {
                  date: sessionDate,
                  sessions: [],
                  totalHours: 0,
                  checkIn: null,
                  checkOut: null,
                  status: 'present',
                });
              }

              const dayAttendance = attendanceByDate.get(sessionDate)!;
              dayAttendance.sessions.push(session);
              
              if (session.duration_seconds) {
                dayAttendance.totalHours += session.duration_seconds / 3600;
              }
              
              if (!dayAttendance.checkIn || session.started_at < dayAttendance.checkIn) {
                dayAttendance.checkIn = session.started_at;
              }
              if (session.ended_at && (!dayAttendance.checkOut || session.ended_at > dayAttendance.checkOut)) {
                dayAttendance.checkOut = session.ended_at;
              }
            });

            const attendanceRecords = Array.from(attendanceByDate.values()).sort((a, b) => 
              new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            const totalDays = attendanceRecords.length;
            const totalHours = attendanceRecords.reduce((sum, record) => sum + record.totalHours, 0);
            const averageHours = totalDays > 0 ? totalHours / totalDays : 0;

            return (
              <>
                {/* Statistics */}
                <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                      <Calendar className="h-4 w-4" />
                      Days Present
                    </div>
                    <div className="text-2xl font-semibold text-slate-800">{totalDays}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                      <Clock className="h-4 w-4" />
                      Total Hours
                    </div>
                    <div className="text-2xl font-semibold text-slate-800">{totalHours.toFixed(1)}h</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                      <Clock className="h-4 w-4" />
                      Avg Hours/Day
                    </div>
                    <div className="text-2xl font-semibold text-slate-800">{averageHours.toFixed(1)}h</div>
                  </div>
                </div>

                {/* Attendance Table */}
                {attendanceRecords.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Check Out</TableHead>
                        <TableHead>Sessions</TableHead>
                        <TableHead>Total Hours</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceRecords.map((record) => (
                        <TableRow key={record.date}>
                          <TableCell className="font-medium">
                            {new Date(record.date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </TableCell>
                          <TableCell>
                            {record.checkIn
                              ? new Date(record.checkIn).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {record.checkOut
                              ? new Date(record.checkOut).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </TableCell>
                          <TableCell>{record.sessions.length}</TableCell>
                          <TableCell>{record.totalHours.toFixed(1)}h</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                record.totalHours >= 8
                                  ? 'default'
                                  : record.totalHours >= 4
                                  ? 'secondary'
                                  : 'outline'
                              }
                            >
                              {record.totalHours >= 8
                                ? 'Full Day'
                                : record.totalHours >= 4
                                ? 'Half Day'
                                : 'Partial'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No attendance records found.
                  </p>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Admin Panel */}
      {isAdmin && (
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
                                {owner?.email ?? 'Unknown user'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{formatDateTime(session.started_at)}</TableCell>
                          <TableCell>
                            {formatTimer(getLiveDurationSeconds(session.started_at))}
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
                                {owner?.email ?? 'Unknown user'}
                              </span>
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
            {adminRecentSessionsTotal > ADMIN_PAGE_SIZE && (
              <CardFooter className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-3 py-1 hover:bg-slate-50 disabled:opacity-50"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const newPage = Math.max(0, adminRecentSessionsPage - 1);
                    setAdminRecentSessionsPage(newPage);
                    await getAdminRecentSessions({ page: newPage, pageSize: ADMIN_PAGE_SIZE });
                  }}
                  disabled={adminRecentSessionsPage === 0}
                >
                  Previous
                </button>
                <span>
                  Page {adminRecentSessionsPage + 1} of{' '}
                  {Math.max(1, Math.ceil(adminRecentSessionsTotal / ADMIN_PAGE_SIZE))}
                </span>
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-3 py-1 hover:bg-slate-50 disabled:opacity-50"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const newPage = adminRecentSessionsPage + 1;
                    if (newPage < Math.ceil(adminRecentSessionsTotal / ADMIN_PAGE_SIZE)) {
                      setAdminRecentSessionsPage(newPage);
                      await getAdminRecentSessions({ page: newPage, pageSize: ADMIN_PAGE_SIZE });
                    }
                  }}
                  disabled={
                    adminRecentSessionsPage + 1 >=
                    Math.ceil(adminRecentSessionsTotal / ADMIN_PAGE_SIZE)
                  }
                >
                  Next
                </button>
              </CardFooter>
            )}
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
                          <TableCell>{actor?.email ?? 'System'}</TableCell>
                          <TableCell className="capitalize">{log.action}</TableCell>
                          <TableCell>{target?.email ?? '—'}</TableCell>
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
            {adminActivityLogsTotal > ADMIN_PAGE_SIZE && (
              <CardFooter className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-3 py-1 hover:bg-slate-50 disabled:opacity-50"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setAdminActivityLogsPage((page) => Math.max(0, page - 1));
                  }}
                  disabled={adminActivityLogsPage === 0}
                >
                  Previous
                </button>
                <span>
                  Page {adminActivityLogsPage + 1} of{' '}
                  {Math.max(1, Math.ceil(adminActivityLogsTotal / ADMIN_PAGE_SIZE))}
                </span>
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-3 py-1 hover:bg-slate-50 disabled:opacity-50"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setAdminActivityLogsPage((page) =>
                      page + 1 >= Math.ceil(adminActivityLogsTotal / ADMIN_PAGE_SIZE)
                        ? page
                        : page + 1
                    );
                  }}
                  disabled={
                    adminActivityLogsPage + 1 >=
                    Math.ceil(adminActivityLogsTotal / ADMIN_PAGE_SIZE)
                  }
                >
                  Next
                </button>
              </CardFooter>
            )}
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle>Daily Break Time</CardTitle>
              <CardDescription>Total break time per employee per day (last 30 days)</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDailyBreaks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : dailyBreaksData.length === 0 ? (
                <p className="text-sm text-muted-foreground">No break data available.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Total Break Time</TableHead>
                      <TableHead>Break Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyBreaksData.map((item, index) => {
                      const employee = profilesDirectory[item.user_id];
                      const date = new Date(item.date);
                      const formattedDate = date.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      });
                      return (
                        <TableRow key={`${item.user_id}_${item.date}_${index}`}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {employee?.email ?? 'Unknown user'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{formattedDate}</TableCell>
                          <TableCell className="font-mono">
                            {formatDuration(item.total_break_seconds)}
                          </TableCell>
                          <TableCell>{item.break_count}</TableCell>
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
  );
};

export default SessionHistory;







