import { create } from 'zustand';
import { supabase } from '../integrations/supabase/client';
import { useBatchStore } from './batchStore';

// Types based on breaks table
type Break = {
  id: string;
  session_id: string | null;
  user_id: string;
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

  // Actions
  getActiveBreak: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await (supabase as any)
        .from('breaks')
        .select('id, session_id, type, started_at, ended_at, duration_seconds, user_id')
        .eq('user_id', userId)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      set({ 
        activeBreak: (data as Break | null) ?? null,
        loading: false 
      });
    } catch (error: any) {
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

      // Apply filters
      const activeFilters = filters ?? get().filters;
      let query = (supabase as any)
        .from('breaks')
        .select('id, session_id, type, started_at, ended_at, duration_seconds, user_id', { count: 'exact' })
        .eq('user_id', userId)
        .not('ended_at', 'is', null); // Only show completed breaks

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
      const { error: rpcError } = await (supabase as any).rpc('start_break', {
        break_type: breakType,
        session_id: sessionId || null,
      });

      if (rpcError) {
        throw rpcError;
      }

      // Refresh break data to get the newly created break
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        await get().getActiveBreak(user.id);
        await get().getBreakHistory(user.id);
      }

      // Refresh batch store after break operations
      const batchStore = useBatchStore.getState();
      if (batchStore.refreshBatches) {
        await batchStore.refreshBatches();
      }

      return get().activeBreak;
    } catch (error: any) {
      set({ 
        error: error.message || 'Error starting break', 
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

      // Immediately clear activeBreak state to update UI
      set({ activeBreak: null });

      // Refresh break data to sync with server
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        await get().getBreakHistory(user.id);
      }

      // Refresh batch store after break operations
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
      
      // On error, refresh data to restore correct state from server
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

