import { useCallback, useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSessionStore } from '@/store/sessionStore';
import { useBreakStore } from '@/store/breakStore';

type UserRole = 'admin' | 'employee';

type ProfileRecord = {
  id: string;
  email: string | null;
  role: UserRole | null;
};

/**
 * Custom hook for managing time tracking data fetching and state
 */
export function useTimeTrackingData(userId: string | undefined) {
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const {
    getCurrentSession,
    getEmployeeSessions,
  } = useSessionStore();
  
  const { getActiveBreak } = useBreakStore();

  /**
   * Fetches user profile, creating if it doesn't exist
   */
  const fetchProfile = useCallback(async (): Promise<ProfileRecord | null> => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('id', userId)
        .maybeSingle<ProfileRecord>();

      if (error) throw error;

      if (data) {
        setProfile(data);
        return data;
      }

      // Create profile if it doesn't exist
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

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

      return null;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }, [userId]);

  /**
   * Fetches all time tracking data for the user
   */
  const fetchEmployeeData = useCallback(async (profileId: string) => {
    // Fetch current session and active break in parallel
    await Promise.all([
      getCurrentSession(profileId),
      getActiveBreak(profileId),
    ]);
    
    // Fetch today's sessions for productive time calculation
    const today = new Date();
    const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    await getEmployeeSessions(profileId, { page: 1, pageSize: 100 }, {
      status: null,
      dateFrom: midnight.toISOString(),
      dateTo: null,
    });
  }, [getCurrentSession, getActiveBreak, getEmployeeSessions]);

  /**
   * Refreshes all data
   */
  const refreshData = useCallback(async () => {
    if (!userId) return;

    setRefreshing(true);
    
    try {
      const loadedProfile = await fetchProfile();
      if (loadedProfile) {
        await fetchEmployeeData(loadedProfile.id);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [userId, fetchProfile, fetchEmployeeData]);

  // Initial data fetch
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    profile,
    loading,
    refreshing,
    refreshData,
  };
}

/**
 * Hook for calculating today's productive time
 */
export function useTodayProductiveTime(
  sessions: any[],
  currentSession: any,
  liveDurationSeconds: number | null
) {
  return useMemo(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get all sessions that started today
    const todaySessions = sessions.filter((session) => {
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
          if (liveDurationSeconds !== null) {
            totalSeconds += liveDurationSeconds;
          } else {
            // Fallback to calculated duration
            const start = sessionStart.getTime();
            const now = Date.now();
            totalSeconds += Math.max(0, Math.floor((now - start) / 1000));
          }
        }
      }
    });

    return totalSeconds;
  }, [sessions, currentSession, liveDurationSeconds]);
}

/**
 * Hook for managing live session duration timer
 */
export function useLiveSessionTimer(currentSession: any) {
  const [liveDurationSeconds, setLiveDurationSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!currentSession || currentSession.status !== 'open') {
      setLiveDurationSeconds(null);
      return;
    }

    const calculateDuration = () => {
      const start = new Date(currentSession.started_at).getTime();
      const now = Date.now();
      return Math.max(0, Math.floor((now - start) / 1000));
    };

    // Set initial value
    setLiveDurationSeconds(calculateDuration());

    // Update every second
    const interval = setInterval(() => {
      setLiveDurationSeconds(calculateDuration());
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSession]);

  return liveDurationSeconds;
}

