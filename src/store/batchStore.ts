import { create } from 'zustand';
import { supabase } from '../integrations/supabase/client';
import type { Tables } from '../integrations/supabase/types';

// Types based on actual Supabase schema
type Batch = Tables<'batches'>;

// Pagination parameters
interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface BatchState {
  // State
  batches: Batch[];
  loading: boolean;
  error: string | null;
  createdBatch: Batch | null;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };

  // Actions
  getBatchesByProjectId: (projectId: string, pagination?: PaginationParams) => Promise<void>;
  getAllBatches: (orgId: string) => Promise<void>;
  currentBatch: Batch | null;
  getBatch: (batchId: string) => Promise<void>;
  refreshBatches: (pagination?: PaginationParams) => Promise<void>;
  createBatch: (batchData: { project_id: string; name: string; org_id: string; file_url?: string; task_template_id?: string; due_date?: string; priority?: string; created_by: string; isActive?: boolean }) => Promise<Batch | null>;
  updateBatch: (batchData: { id: string; name: string; file_url?: string; due_date?: string; priority?: string; isActive?: boolean }) => Promise<void>;
  toggleBatchActive: (batchId: string, isActive: boolean) => Promise<void>;
  deleteBatch: (batchId: string) => Promise<void>;
  clearBatches: () => void;
  clearError: () => void;
}


export const useBatchStore = create<BatchState>((set, get) => ({
  // Initial state
  batches: [],
  currentBatch: null,
  loading: false, 
  error: null,
  createdBatch: null,
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  },

  // Actions
  getBatchesByProjectId: async (projectId: string, pagination?: PaginationParams) => {
    set({ loading: true, error: null });
    try {
      let query = supabase
        .from('batches')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      // Apply pagination
      const page = pagination?.page || 1;
      const pageSize = pagination?.pageSize || 10;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      query = query.range(from, to);

      const { data, error, count } = await query;
      
      if (error) {
        throw error;
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / pageSize);

      set({ 
        batches: data || [], 
        loading: false,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        }
      });
    } catch (error: any) {
      set({ 
        error: error.message || 'Error loading batches', 
        loading: false 
      });
    }
  },

  getBatch: async (batchId: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('id', batchId)
        .single();

      if (error) {
        throw error;
      }

      set({ currentBatch: data || null, loading: false });
    } catch (error: any) {
      set({ 
        error: error.message || 'Error loading batch', 
        loading: false 
      });
    }
  },

  getAllBatches: async (orgId: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      set({ batches: data || [], loading: false });
    } catch (error: any) {
      set({ 
        error: error.message || 'Error loading all batches', 
        loading: false 
      });
    }
  },

  refreshBatches: async (pagination?: PaginationParams) => {
    const currentProjectId = get().batches[0]?.project_id;
    if (currentProjectId) {
      await get().getBatchesByProjectId(currentProjectId, pagination);
    }
  },

  createBatch: async (batchData: { project_id: string; name: string; org_id: string; file_url?: string; task_template_id?: string; due_date?: string; priority?: string; created_by: string; isActive?: boolean }) => {
    set({ loading: true, error: null });
    
    try {
      // Ensure required fields are provided
      const batchToInsert = {
        id: crypto.randomUUID(),
        project_id: batchData.project_id,
        name: batchData.name,
        org_id: batchData.org_id,
        file_url: batchData.file_url || null,
        task_template_id: batchData.task_template_id || null,
        due_date: batchData.due_date || null,
        priority: batchData.priority || 'medium',
        isActive: batchData.isActive !== undefined ? batchData.isActive : true,
        created_by: batchData.created_by || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('batches')
        .insert([batchToInsert])
        .select()
        .single();

      if (error) {
        throw error;
      }

      set({ 
        batches: [data, ...get().batches],
        createdBatch: data,
        loading: false 
      });
      
      return data;
    } catch (error: any) {
      set({ 
        error: error.message || 'Error creating batch', 
        loading: false 
      });
      return null;
    }
  },

  updateBatch: async (batchData: { id: string; name: string; file_url?: string; due_date?: string; priority?: string; isActive?: boolean }) => {
    set({ loading: true, error: null });
    
    try {
      const { error } = await supabase
        .from('batches')
        .update({
          name: batchData.name,
          file_url: batchData.file_url || null,
          due_date: batchData.due_date || null,
          priority: batchData.priority,
          isActive: batchData.isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', batchData.id);

      if (error) {
        throw error;
      }

      set({
        batches: get().batches.map(batch =>
          batch.id === batchData.id ? {
            ...batch,
            name: batchData.name,
            file_url: batchData.file_url || null,
            due_date: batchData.due_date || null,
            priority: batchData.priority,
            isActive: batchData.isActive !== undefined ? batchData.isActive : batch.isActive,
            updated_at: new Date().toISOString()
          } : batch
        ),
        loading: false
      });
    } catch (error: any) {
      set({ 
        error: error.message || 'Error updating batch', 
        loading: false 
      });
    }
  },

  toggleBatchActive: async (batchId: string, isActive: boolean) => {
    set({ loading: true, error: null });

    try {
      const { error } = await supabase
        .from('batches')
        .update({
          isActive: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', batchId);

      if (error) {
        throw error;
      }

      set({
        batches: get().batches.map(batch =>
          batch.id === batchId ? {
            ...batch,
            isActive: isActive,
            updated_at: new Date().toISOString()
          } : batch
        ),
        loading: false
      });
    } catch (error: any) {
      set({
        error: error.message || 'Error toggling batch active status',
        loading: false
      });
    }
  },

  deleteBatch: async (batchId: string) => {
    set({ loading: true, error: null });
    
    try {
      const { error } = await supabase
        .from('batches')
        .delete()
        .eq('id', batchId);

      if (error) {
        throw error;
      }

      set({ 
        batches: get().batches.filter(batch => batch.id !== batchId),
        loading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.message || 'Error deleting batch', 
        loading: false 
      });
    }
  },

  clearBatches: () => {
    set({ 
      batches: [],
      error: null 
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));
