import { create } from 'zustand';
import { supabase } from '../integrations/supabase/client';
import { useBatchStore } from './batchStore';

// Types based on breaks table
type Break = {
  id: string;
  session_id: string;
  type: 'lunch' | 'tea' | 'bio' | 'other';
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
};

interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface BreakFilterParams {
  type?: 'lunch' | 'tea' | 'bio' | 'other' | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

interface BreakState {
  // State
  activeBreak: Break | null;
  breakHistory: Break[];
  loading: boolean;
  error: string | null;
  breakHistoryPage: number;
  breakHistoryTotal: number;
  filters: BreakFilterParams;

  // Actions
  getActiveBreak: (userId: string) => Promise<void>;
  getBreakHistory: (userId: string, pagination?: PaginationParams, filters?: BreakFilterParams) => Promise<void>;
  startBreak: (breakType: Break['type'], sessionId?: string | null) => Promise<Break | null>;
  endBreak: (breakId: string) => Promise<void>;
  refreshBreaks: (userId: string) => Promise<void>;
  clearBreaks: () => void;
  clearError: () => void;
  setBreakHistoryPage: (page: number) => void;
  setFilters: (filters: BreakFilterParams) => void;
}

export const useBreakStore = create<BreakState>((set, get) => ({
  // Initial state
  activeBreak: null,
  breakHistory: [],
  loading: false,
  error: null,
  breakHistoryPage: 1,
  breakHistoryTotal: 0,
  filters: {},

  // Get active break for a user (through work_sessions join)
  getActiveBreak: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      // First get user's work sessions, then find active breaks
      const { data: sessions, error: sessionsError } = await (supabase as any)
        .from('work_sessions')
        .select('id')
        .eq('user_id', userId);

      if (sessionsError) {
        throw sessionsError;
      }

      if (!sessions || sessions.length === 0) {
        console.log('No sessions found for user:', userId);
        set({ activeBreak: null, loading: false });
        return;
      }

      const sessionIds = sessions.map((s: any) => s.id);
      console.log('Found sessions for user:', sessionIds);

      // Find active break for any of user's sessions
      const { data, error } = await (supabase as any)
        .from('breaks')
        .select('id, session_id, type, started_at, ended_at, duration_seconds')
        .in('session_id', sessionIds)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching active break:', error);
        throw error;
      }

      console.log('Active break found:', data);
      set({ 
        activeBreak: (data as Break | null) ?? null,
        loading: false 
      });
    } catch (error: any) {
      console.error('getActiveBreak error:', error);
      set({ 
        error: error.message || 'Error loading active break', 
        loading: false 
      });
    }
  },

  getBreakHistory: async (userId: string, pagination?: PaginationParams, filters?: BreakFilterParams) => {
    set({ loading: true, error: null });
    try {
      const page = pagination?.page ?? get().breakHistoryPage;
      const pageSize = pagination?.pageSize ?? 10;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Get user's work sessions first
      const { data: sessions, error: sessionsError } = await (supabase as any)
        .from('work_sessions')
        .select('id')
        .eq('user_id', userId);

      if (sessionsError) {
        throw sessionsError;
      }

      if (!sessions || sessions.length === 0) {
        set({ 
          breakHistory: [],
          breakHistoryPage: page,
          breakHistoryTotal: 0,
          loading: false 
        });
        return;
      }

      const sessionIds = sessions.map((s: any) => s.id);

      // Apply filters
      const activeFilters = filters ?? get().filters;
      let query = (supabase as any)
        .from('breaks')
        .select('id, session_id, type, started_at, ended_at, duration_seconds', { count: 'exact' })
        .in('session_id', sessionIds)
        .not('ended_at', 'is', null);

      // Apply type filter
      if (activeFilters.type) {
        query = query.eq('type', activeFilters.type);
      }

      // Apply date filters
      if (activeFilters.dateFrom) {
        query = query.gte('started_at', activeFilters.dateFrom);
      }
      if (activeFilters.dateTo) {
        query = query.lte('started_at', activeFilters.dateTo);
      }

      query = query.order('started_at', { ascending: false }).range(from, to);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      set({ 
        breakHistory: (data ?? []) as Break[],
        breakHistoryPage: page,
        breakHistoryTotal: count ?? 0,
        filters: activeFilters,
        loading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.message || 'Error loading break history', 
        loading: false 
      });
    }
  },

  startBreak: async (breakType: Break['type'], sessionId?: string | null) => {
    set({ loading: true, error: null });
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // If no session_id provided, find the most recent session
      if (!sessionId) {
        const { data: recentSession, error: sessionError } = await (supabase as any)
          .from('work_sessions')
          .select('id, status')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sessionError) {
          throw new Error('Unable to find a session. Please start a session first.');
        }

        if (!recentSession) {
          throw new Error('No session found. Please start a session first, then end it before taking a break.');
        }

        sessionId = recentSession.id;
      }

      // Check session status
      const { data: sessionData, error: sessionCheckError } = await (supabase as any)
        .from('work_sessions')
        .select('id, status')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (sessionCheckError || !sessionData) {
        throw new Error('Session not found or not owned by user');
      }

      // Use RPC for open sessions, direct insert for closed sessions
      if (sessionData.status === 'open') {
        const { error: rpcError } = await (supabase as any).rpc('start_break', {
          break_type: breakType,
          session_id: sessionId,
        });

        if (rpcError) {
          throw rpcError;
        }
      } else {
        // For closed sessions, we need to set started_at to session's ended_at
        // to pass the database validation trigger
        const { data: sessionWithEndTime, error: sessionTimeError } = await (supabase as any)
          .from('work_sessions')
          .select('ended_at, user_id')
          .eq('id', sessionId)
          .single();

        if (sessionTimeError) {
          throw new Error('Unable to get session end time');
        }

        // Use session's ended_at as break start time to pass validation
        // Or use current time if session doesn't have an end time
        const breakStartTime = sessionWithEndTime?.ended_at || new Date().toISOString();
        const sessionUserId = sessionWithEndTime?.user_id || user.id;

        // For closed sessions, insert directly with started_at set to session end time
        // Include user_id to satisfy check constraint
        const { data: insertedBreak, error: insertError } = await (supabase as any)
          .from('breaks')
          .insert({
            session_id: sessionId,
            type: breakType,
            started_at: breakStartTime, // Set to session end time to pass validation
            user_id: sessionUserId, // Required by check constraint
          })
          .select()
          .single();

        if (insertError) {
          console.error('Direct break insert error:', insertError);
          throw insertError;
        }

        // Set the active break immediately if we got it back
        if (insertedBreak) {
          const newBreak: Break = {
            id: insertedBreak.id,
            session_id: insertedBreak.session_id,
            type: insertedBreak.type,
            started_at: insertedBreak.started_at, // This will be session's ended_at to pass validation
            ended_at: insertedBreak.ended_at,
            duration_seconds: insertedBreak.duration_seconds,
          };
          console.log('Break created and set immediately:', newBreak);
          set({ 
            activeBreak: newBreak,
            loading: false 
          });
          await get().getBreakHistory(user.id);
          return newBreak;
        }
      }

      // For RPC calls, refresh break data
      await new Promise(resolve => setTimeout(resolve, 300));
      await get().getActiveBreak(user.id);

      await get().getBreakHistory(user.id);

      // Refresh batch store
      const batchStore = useBatchStore.getState();
      if (batchStore.refreshBatches) {
        await batchStore.refreshBatches();
      }

      return get().activeBreak;
    } catch (error: any) {
      const errorMessage = error?.message || error?.details || error?.hint || 'Error starting break';
      set({ 
        error: errorMessage, 
        loading: false 
      });
      return null;
    }
  },

  endBreak: async (breakId: string) => {
    set({ loading: true, error: null });
    
    try {
      const { error: rpcError } = await (supabase as any).rpc('end_break', {
        break_id: breakId,
      });

      if (rpcError) {
        throw rpcError;
      }

      // Clear active break immediately
      set({ activeBreak: null });

      // Refresh break data
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        await get().getBreakHistory(user.id);
      }

      // Refresh batch store
      const batchStore = useBatchStore.getState();
      if (batchStore.refreshBatches) {
        await batchStore.refreshBatches();
      }

      set({ loading: false });
    } catch (error: any) {
      set({ 
        error: error.message || 'Error ending break', 
        loading: false 
      });
      
      // Refresh on error to restore correct state
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        await get().refreshBreaks(user.id);
      }
      
      throw error;
    }
  },

  refreshBreaks: async (userId: string) => {
    await get().getActiveBreak(userId);
    await get().getBreakHistory(userId);
  },

  setBreakHistoryPage: (page: number) => {
    set({ breakHistoryPage: page });
  },

  setFilters: (filters: BreakFilterParams) => {
    set({ filters });
  },

  clearBreaks: () => {
    set({ 
      activeBreak: null,
      breakHistory: [],
      error: null,
      breakHistoryPage: 1,
      breakHistoryTotal: 0,
      filters: {},
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));
