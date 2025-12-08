import { create } from 'zustand';
import { supabase } from '../integrations/supabase/client';

// Types based on activity_logs table
export type ActivityLog = {
  id: string;
  actor_id: string | null;
  target_user_id: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type ProfileInfo = {
  id: string;
  email: string | null;
  role: string | null;
};

// Pagination parameters
interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface ActivityLogState {
  // State
  logs: ActivityLog[];
  profilesDirectory: Record<string, ProfileInfo>;
  loading: boolean;
  error: string | null;
  page: number;
  total: number;
  pageSize: number;

  // Actions
  getActivityLogs: (pagination?: PaginationParams) => Promise<void>;
  getProfiles: () => Promise<void>;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  clearLogs: () => void;
  clearError: () => void;
}

export const useActivityLogStore = create<ActivityLogState>((set, get) => ({
  // Initial state
  logs: [],
  profilesDirectory: {},
  loading: false,
  error: null,
  page: 0,
  total: 0,
  pageSize: 10,

  // Actions
  getProfiles: async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role');

      if (error) {
        console.error('Error fetching profiles:', error);
        throw error;
      }

      const directory: Record<string, ProfileInfo> = {};
      (data ?? []).forEach((item: any) => {
        if (item.id) {
          directory[item.id] = {
            id: item.id,
            email: item.email,
            role: item.role,
          };
        }
      });

      set({ profilesDirectory: directory, error: null });
    } catch (error: any) {
      console.error('Error fetching profiles:', error);
      set({ error: error.message || 'Error loading profiles' });
    }
  },

  getActivityLogs: async (pagination?: PaginationParams) => {
    set({ loading: true, error: null });

    try {
      const page = pagination?.page ?? get().page;
      const pageSize = pagination?.pageSize ?? get().pageSize ?? 10;
      const from = page * pageSize;
      const to = from + pageSize - 1;

      // Fetch activity logs (table might not exist in generated types, so use 'as any')
      const { data, error, count } = await (supabase as any)
        .from('activity_logs')
        .select('id, actor_id, target_user_id, action, metadata, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error fetching activity logs:', error);
        // Check if table doesn't exist
        const errorMessage = error?.message || error?.error_description || '';
        if (errorMessage.includes('does not exist') || errorMessage.includes('relation') || error.code === '42P01' || error.code === 'PGRST116') {
          set({
            error: 'The activity_logs table does not exist in the database. Please contact your administrator.',
            loading: false,
            logs: [],
            total: 0,
          });
          return;
        }
        throw error;
      }

      set({
        logs: (data ?? []) as ActivityLog[],
        total: count ?? 0,
        page,
        pageSize,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('Error loading activity logs:', error);
      const errorMessage = error?.message || error?.error_description || error?.error || 'Error loading activity logs';
      set({
        error: errorMessage,
        loading: false,
        logs: [],
        total: 0,
      });
    }
  },

  setPage: (page: number) => {
    set({ page });
  },

  setPageSize: (pageSize: number) => {
    set({ pageSize, page: 0 }); // Reset to first page when changing page size
  },

  clearLogs: () => {
    set({ logs: [], profilesDirectory: {}, page: 0, total: 0 });
  },

  clearError: () => {
    set({ error: null });
  },
}));

