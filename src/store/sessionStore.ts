import { create } from 'zustand';
import { supabase } from '../integrations/supabase/client';
import { useBatchStore } from './batchStore';

// Types based on work_sessions table
type WorkSession = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: 'open' | 'closed';
  notes: string | null;
};

// Pagination parameters
interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface FilterParams {
  status?: 'open' | 'closed' | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

interface SessionState {
  // State
  sessions: WorkSession[];
  currentSession: WorkSession | null;
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  employeeSessionsPage: number;
  employeeSessionsTotal: number;

  // Admin state
  adminActiveSessions: WorkSession[];
  adminRecentSessions: WorkSession[];
  adminRecentSessionsPage: number;
  adminRecentSessionsTotal: number;

  // Filters
  filters: FilterParams;

  // Actions
  getEmployeeSessions: (userId: string, pagination?: PaginationParams, filters?: FilterParams) => Promise<void>;
  getCurrentSession: (userId: string) => Promise<void>;
  startSession: (notes?: string | null) => Promise<WorkSession | null>;
  endSession: (sessionId: string) => Promise<void>;
  refreshSessions: (userId: string) => Promise<void>;
  getAdminActiveSessions: () => Promise<void>;
  getAdminRecentSessions: (pagination?: PaginationParams) => Promise<void>;
  clearSessions: () => void;
  clearError: () => void;
  setAdminRecentSessionsPage: (page: number) => void;
  setEmployeeSessionsPage: (page: number) => void;
  setFilters: (filters: FilterParams) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  // Initial state
  sessions: [],
  currentSession: null,
  loading: false,
  error: null,
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  },
  adminActiveSessions: [],
  adminRecentSessions: [],
  adminRecentSessionsPage: 0,
  adminRecentSessionsTotal: 0,
  employeeSessionsPage: 1,
  employeeSessionsTotal: 0,
  filters: {},

  // Actions
  getEmployeeSessions: async (userId: string, pagination?: PaginationParams, filters?: FilterParams) => {
    set({ loading: true, error: null });
    try {
      const page = pagination?.page ?? get().employeeSessionsPage;
      const pageSize = pagination?.pageSize ?? 10;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Apply filters
      const activeFilters = filters ?? get().filters;
      let query = (supabase as any)
        .from('work_sessions')
        .select('id, user_id, started_at, ended_at, duration_seconds, status, notes', { count: 'exact' })
        .eq('user_id', userId);

      // Apply status filter
      if (activeFilters.status) {
        query = query.eq('status', activeFilters.status);
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

      const sessions = (data ?? []) as WorkSession[];
      const current = sessions.find((session) => session.status === 'open') ?? null;

      // Also fetch current session separately if not in results
      if (!current) {
        const { data: currentData } = await (supabase as any)
          .from('work_sessions')
          .select('id, user_id, started_at, ended_at, duration_seconds, status, notes')
          .eq('user_id', userId)
          .eq('status', 'open')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (currentData) {
          set({ currentSession: currentData as WorkSession });
        }
      } else {
        set({ currentSession: current });
      }

      set({ 
        sessions,
        employeeSessionsPage: page,
        employeeSessionsTotal: count ?? 0,
        filters: activeFilters,
        loading: false 
      });

      // Refresh batch store after session operations (optional, safe to fail)
      try {
        const batchStore = useBatchStore.getState();
        if (batchStore && batchStore.refreshBatches) {
          await batchStore.refreshBatches();
        }
      } catch (error) {
        // Ignore batch refresh errors - not critical for session operations
        console.warn('Failed to refresh batches:', error);
      }
    } catch (error: any) {
      set({ 
        error: error.message || 'Error loading sessions', 
        loading: false 
      });
    }
  },

  getCurrentSession: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await (supabase as any)
        .from('work_sessions')
        .select('id, user_id, started_at, ended_at, duration_seconds, status, notes')
        .eq('user_id', userId)
        .eq('status', 'open')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      set({ 
        currentSession: (data as WorkSession | null) ?? null,
        loading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.message || 'Error loading current session', 
        loading: false 
      });
    }
  },

  startSession: async (notes?: string | null) => {
    set({ loading: true, error: null });
    
    try {
      const { data, error: rpcError } = await (supabase as any).rpc('start_session', {
        notes: notes || null,
      });

      if (rpcError) {
        throw rpcError;
      }

      const session = data as WorkSession;
      
      set({ 
        currentSession: session,
        sessions: [session, ...get().sessions],
        loading: false 
      });

      // Refresh batch store after session operations (optional, safe to fail)
      try {
        const batchStore = useBatchStore.getState();
        if (batchStore && batchStore.refreshBatches) {
          await batchStore.refreshBatches();
        }
      } catch (error) {
        // Ignore batch refresh errors - not critical for session operations
        console.warn('Failed to refresh batches:', error);
      }

      return session;
    } catch (error: any) {
      set({ 
        error: error.message || 'Error starting session', 
        loading: false 
      });
      return null;
    }
  },

  endSession: async (sessionId: string) => {
    set({ loading: true, error: null });
    
    try {
      const { error: rpcError } = await (supabase as any).rpc('end_session', {
        session_id: sessionId,
      });

      if (rpcError) {
        throw rpcError;
      }

      // Update local state
      const updatedSessions = get().sessions.map((session) =>
        session.id === sessionId
          ? { ...session, status: 'closed' as const, ended_at: new Date().toISOString() }
          : session
      );

      set({ 
        currentSession: null,
        sessions: updatedSessions,
        loading: false 
      });

      // Refresh batch store after session operations (optional, safe to fail)
      try {
        const batchStore = useBatchStore.getState();
        if (batchStore && batchStore.refreshBatches) {
          await batchStore.refreshBatches();
        }
      } catch (error) {
        // Ignore batch refresh errors - not critical for session operations
        console.warn('Failed to refresh batches:', error);
      }
    } catch (error: any) {
      set({ 
        error: error.message || 'Error ending session', 
        loading: false 
      });
      throw error;
    }
  },

  refreshSessions: async (userId: string) => {
    await get().getEmployeeSessions(userId);
    await get().getCurrentSession(userId);
  },

  getAdminActiveSessions: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await (supabase as any)
        .from('work_sessions')
        .select('id, user_id, started_at, ended_at, duration_seconds, status, notes')
        .eq('status', 'open')
        .order('started_at', { ascending: false });

      if (error) {
        throw error;
      }

      set({ 
        adminActiveSessions: (data ?? []) as WorkSession[],
        loading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.message || 'Error loading active sessions', 
        loading: false 
      });
    }
  },

  getAdminRecentSessions: async (pagination?: PaginationParams) => {
    set({ loading: true, error: null });
    try {
      const page = pagination?.page ?? get().adminRecentSessionsPage;
      const pageSize = pagination?.pageSize ?? 8;
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await (supabase as any)
        .from('work_sessions')
        .select('id, user_id, started_at, ended_at, duration_seconds, status, notes', { count: 'exact' })
        .order('started_at', { ascending: false })
        .range(from, to);

      if (error) {
        throw error;
      }

      set({ 
        adminRecentSessions: (data ?? []) as WorkSession[],
        adminRecentSessionsTotal: count ?? 0,
        adminRecentSessionsPage: page,
        loading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.message || 'Error loading recent sessions', 
        loading: false 
      });
    }
  },

  setAdminRecentSessionsPage: (page: number) => {
    set({ adminRecentSessionsPage: page });
  },

  setEmployeeSessionsPage: (page: number) => {
    set({ employeeSessionsPage: page });
  },

  setFilters: (filters: FilterParams) => {
    set({ filters });
  },

  clearSessions: () => {
    set({ 
      sessions: [],
      currentSession: null,
      error: null,
      employeeSessionsPage: 1,
      employeeSessionsTotal: 0,
      filters: {},
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));
