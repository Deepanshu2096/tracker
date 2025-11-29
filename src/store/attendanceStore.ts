import { create } from 'zustand';
import { supabase } from '../integrations/supabase/client';

// Types
export type ProfileRecord = {
  id: string;
  email: string | null;
  role: string | null;
};

export type WorkSessionRecord = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: 'open' | 'closed';
  notes: string | null;
};

export type DailyAttendance = {
  date: string;
  employees: {
    userId: string;
    email: string | null;
    hoursWorked: number;
    sessions: number;
    checkIn: string | null;
    checkOut: string | null;
    status: 'full' | 'half' | 'miss' | 'partial';
  }[];
};

interface AttendanceState {
  // State
  attendanceData: DailyAttendance[];
  profilesDirectory: Record<string, ProfileRecord>;
  loading: boolean;
  error: string | null;

  // Actions
  getAttendanceData: (startDate: string, endDate: string) => Promise<void>;
  getProfiles: () => Promise<void>;
  clearError: () => void;
}

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  // Initial state
  attendanceData: [],
  profilesDirectory: {},
  loading: false,
  error: null,

  // Actions
  getProfiles: async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, role');

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

      const directory = Object.fromEntries(
        (profiles ?? []).map((item) => [item.id, item])
      );

      set({ profilesDirectory: directory, error: null });
    } catch (error: any) {
      console.error('Error fetching profiles:', error);
      set({ error: error.message || 'Error loading profiles' });
    }
  },

  getAttendanceData: async (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return;

    set({ loading: true, error: null });

    try {
      // Fetch profiles first if not already loaded
      if (Object.keys(get().profilesDirectory).length === 0) {
        await get().getProfiles();
      }

      const directory = get().profilesDirectory;

      // Fetch all work sessions in the date range
      const { data: sessions, error: sessionsError } = await (supabase as any)
        .from('work_sessions')
        .select('id, user_id, started_at, ended_at, duration_seconds, status, notes')
        .gte('started_at', `${startDate}T00:00:00`)
        .lte('started_at', `${endDate}T23:59:59`)
        .order('started_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      // Group sessions by date and employee
      const attendanceByDate = new Map<string, Map<string, WorkSessionRecord[]>>();

      (sessions || []).forEach((session: WorkSessionRecord) => {
        const sessionDate = new Date(session.started_at).toISOString().split('T')[0];
        
        if (!attendanceByDate.has(sessionDate)) {
          attendanceByDate.set(sessionDate, new Map());
        }

        const dayMap = attendanceByDate.get(sessionDate)!;
        if (!dayMap.has(session.user_id)) {
          dayMap.set(session.user_id, []);
        }

        dayMap.get(session.user_id)!.push(session);
      });

      // Convert to DailyAttendance format
      const dailyAttendance: DailyAttendance[] = Array.from(attendanceByDate.entries())
        .map(([date, employeeMap]) => {
          const employees = Array.from(employeeMap.entries()).map(([userId, sessions]) => {
            const totalSeconds = sessions.reduce(
              (sum, s) => sum + (s.duration_seconds || 0),
              0
            );
            const hoursWorked = totalSeconds / 3600;

            // Find earliest check-in and latest check-out
            const checkIns = sessions.map((s) => s.started_at).sort();
            const checkOuts = sessions
              .map((s) => s.ended_at)
              .filter((date): date is string => date !== null)
              .sort();

            // Determine status: Full day = 8+ hours, Half day = 4-8 hours, Partial = 1-4 hours, Miss = <1 hour or no closed session
            let status: 'full' | 'half' | 'miss' | 'partial';
            const hasClosedSession = sessions.some((s) => s.status === 'closed');
            
            if (!hasClosedSession && hoursWorked < 1) {
              status = 'miss';
            } else if (hoursWorked >= 8) {
              status = 'full';
            } else if (hoursWorked >= 4) {
              status = 'half';
            } else if (hoursWorked >= 1) {
              status = 'partial';
            } else {
              status = 'miss';
            }

            return {
              userId,
              email: directory[userId]?.email || null,
              hoursWorked,
              sessions: sessions.length,
              checkIn: checkIns[0] || null,
              checkOut: checkOuts[checkOuts.length - 1] || null,
              status,
            };
          });

          return {
            date,
            employees,
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      set({ 
        attendanceData: dailyAttendance, 
        loading: false, 
        error: null 
      });
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load attendance data';
      console.error('Error fetching attendance data:', error);
      set({ 
        error: errorMessage, 
        loading: false 
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

