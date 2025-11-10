import { create } from 'zustand';
import { supabase } from '../integrations/supabase/client';
import type { Tables } from '../integrations/supabase/types';

// Types based on actual Supabase schema
type DeliveryBatch = Tables<'delivery_batch'> & {
  projects?: { name: string | null } | null;
};
type Task = Tables<'tasks'>;

// Pagination parameters
interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface DeliveryBatchState {
  // State
  deliveryBatches: DeliveryBatch[];
  loading: boolean;
  error: string | null;
  createdDeliveryBatch: DeliveryBatch | null;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };

  // Actions
  getDeliveryBatches: (orgId: string, pagination?: PaginationParams, projectId?: string) => Promise<void>;
  getDeliveryBatch: (deliveryBatchId: string) => Promise<DeliveryBatch | null>;
  refreshDeliveryBatches: (pagination?: PaginationParams, projectId?: string) => Promise<void>;
  createDeliveryBatch: (batchData: { name: string; org_id: string; created_by: string; project_id?: string }) => Promise<DeliveryBatch | null>;
  updateDeliveryBatch: (batchData: { id: string; name: string }) => Promise<void>;
  deleteDeliveryBatch: (deliveryBatchId: string) => Promise<void>;
  clearDeliveryBatches: () => void;
  clearError: () => void;
  
  // Task management for delivery batches
  getTasksForDeliveryBatch: (deliveryBatchId: string) => Promise<Task[]>;
  getReadyForDeliveryTasks: (orgId: string, projectId?: string) => Promise<Task[]>;
  getOtherAvailableTasks: (orgId: string, projectId?: string) => Promise<Task[]>;
  getReadyForDeliveryTasksPaginated: (orgId: string, page: number, pageSize: number, projectId?: string) => Promise<{ tasks: Task[], total: number, totalPages: number }>;
  getOtherAvailableTasksPaginated: (orgId: string, page: number, pageSize: number, projectId?: string) => Promise<{ tasks: Task[], total: number, totalPages: number }>;
  addTasksToDeliveryBatch: (deliveryBatchId: string, taskIds: string[]) => Promise<void>;
  removeTasksFromDeliveryBatch: (taskIds: string[]) => Promise<void>;
  updateBatchStatusToCompleted: (taskIds: string[]) => Promise<void>;
}

export const useDeliveryBatchStore = create<DeliveryBatchState>((set, get) => ({
  // Initial state
  deliveryBatches: [],
  loading: false, 
  error: null,
  createdDeliveryBatch: null,
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  },

  // Actions
  getDeliveryBatches: async (orgId: string, pagination?: PaginationParams, projectId?: string) => {
    set({ loading: true, error: null });
    try {
      let query = supabase
        .from('delivery_batch')
        .select(`
          *,
          projects!delivery_batch_project_id_fkey(name)
        `, { count: 'exact' })
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      // Filter by project if provided
      if (projectId) {
        query = query.eq('project_id', projectId);
      }

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
        deliveryBatches: data || [], 
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
        error: error.message || 'Error loading delivery batches', 
        loading: false 
      });
    }
  },

  getDeliveryBatch: async (deliveryBatchId: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('delivery_batch')
        .select('*')
        .eq('id', deliveryBatchId)
        .single();

      if (error) {
        throw error;
      }

      set({ loading: false });
      return data;
    } catch (error: any) {
      set({ 
        error: error.message || 'Error loading delivery batch', 
        loading: false 
      });
      return null;
    }
  },

  refreshDeliveryBatches: async (pagination?: PaginationParams, projectId?: string) => {
    const currentOrgId = get().deliveryBatches[0]?.org_id;
    if (currentOrgId) {
      await get().getDeliveryBatches(currentOrgId, pagination, projectId);
    }
  },

  createDeliveryBatch: async (batchData: { name: string; org_id: string; created_by: string; project_id?: string }) => {
    set({ loading: true, error: null });
    
    try {
      const deliveryBatchToInsert = {
        id: crypto.randomUUID(),
        name: batchData.name,
        org_id: batchData.org_id,
        created_by: batchData.created_by,
        project_id: batchData.project_id || null,
        created_at: new Date().toISOString(),
        total_tasks: 0,
      };

      const { data, error } = await supabase
        .from('delivery_batch')
        .insert([deliveryBatchToInsert])
        .select(`
          *,
          projects!delivery_batch_project_id_fkey(name)
        `)
        .single();

      if (error) {
        throw error;
      }

      set({ 
        deliveryBatches: [data, ...get().deliveryBatches],
        createdDeliveryBatch: data,
        loading: false 
      });
      
      return data;
    } catch (error: any) {
      set({ 
        error: error.message || 'Error creating delivery batch', 
        loading: false 
      });
      return null;
    }
  },

  updateDeliveryBatch: async (batchData: { id: string; name: string }) => {
    set({ loading: true, error: null });
    
    try {
      const { error } = await supabase
        .from('delivery_batch')
        .update({
          name: batchData.name,
        })
        .eq('id', batchData.id);

      if (error) {
        throw error;
      }

      set({ 
        deliveryBatches: get().deliveryBatches.map(batch => 
          batch.id === batchData.id ? { ...batch, name: batchData.name } : batch
        ),
        loading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.message || 'Error updating delivery batch', 
        loading: false 
      });
    }
  },

  deleteDeliveryBatch: async (deliveryBatchId: string) => {
    set({ loading: true, error: null });
    
    try {
      // First, remove all tasks from this delivery batch
      const { error: removeTasksError } = await supabase
        .from('tasks')
        .update({ delivery_batch_id: null })
        .eq('delivery_batch_id', deliveryBatchId);

      if (removeTasksError) {
        throw removeTasksError;
      }

      // Then delete the delivery batch
      const { error } = await supabase
        .from('delivery_batch')
        .delete()
        .eq('id', deliveryBatchId);

      if (error) {
        throw error;
      }

      set({ 
        deliveryBatches: get().deliveryBatches.filter(batch => batch.id !== deliveryBatchId),
        loading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.message || 'Error deleting delivery batch', 
        loading: false 
      });
    }
  },

  // Task management functions
  getTasksForDeliveryBatch: async (deliveryBatchId: string) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          profiles!tasks_assigned_user_fkey(name, email)
        `)
        .eq('delivery_batch_id', deliveryBatchId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error: any) {
      console.error('Error loading tasks for delivery batch:', error);
      return [];
    }
  },

  getReadyForDeliveryTasks: async (orgId: string, projectId?: string) => {
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          profiles!tasks_assigned_user_fkey(name, email),
          batches!tasks_batch_id_fkey(project_id)
        `)
        .eq('org_id', orgId)
        .eq('status', 'ready_for_delivery')
        .order('created_at', { ascending: false });

      // Filter by project if provided
      if (projectId) {
        query = query.eq('batches.project_id', projectId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error: any) {
      console.error('Error loading ready for delivery tasks:', error);
      return [];
    }
  },

  getOtherAvailableTasks: async (orgId: string, projectId?: string) => {
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          profiles!tasks_assigned_user_fkey(name, email),
          batches!tasks_batch_id_fkey(project_id)
        `)
        .eq('org_id', orgId)
        .not('status', 'in', '(completed,ready_for_delivery)')
        .order('created_at', { ascending: false });

      // Filter by project if provided
      if (projectId) {
        query = query.eq('batches.project_id', projectId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error: any) {
      console.error('Error loading other available tasks:', error);
      return [];
    }
  },

  getReadyForDeliveryTasksPaginated: async (orgId: string, page: number, pageSize: number, projectId?: string) => {
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          profiles!tasks_assigned_user_fkey(name, email),
          batches!tasks_batch_id_fkey(project_id)
        `, { count: 'exact' })
        .eq('org_id', orgId)
        .eq('status', 'ready_for_delivery')
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      // Filter by project if provided
      if (projectId) {
        query = query.eq('batches.project_id', projectId);
      }

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / pageSize);

      return {
        tasks: (data as Task[]) || [],
        total,
        totalPages,
      };
    } catch (error: any) {
      console.error('Error loading ready for delivery tasks (paginated):', error);
      return {
        tasks: [],
        total: 0,
        totalPages: 0,
      };
    }
  },

  getOtherAvailableTasksPaginated: async (orgId: string, page: number, pageSize: number, projectId?: string) => {
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          profiles!tasks_assigned_user_fkey(name, email),
          batches!tasks_batch_id_fkey(project_id)
        `, { count: 'exact' })
        .eq('org_id', orgId)
        .not('status', 'in', '(completed,ready_for_delivery)')
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      // Filter by project if provided
      if (projectId) {
        query = query.eq('batches.project_id', projectId);
      }

      const { data, error, count } = await query;

      if (error) {
        console.log('other available tasks error', error);
        
        throw error;
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / pageSize);

      return {
        tasks: (data as Task[]) || [],
        total,
        totalPages,
      };
    } catch (error: any) {
      console.error('Error loading other available tasks (paginated):', error);
      return {
        tasks: [],
        total: 0,
        totalPages: 0,
      };
    }
  },

  addTasksToDeliveryBatch: async (deliveryBatchId: string, taskIds: string[]) => {
    console.log('🔄 [DeliveryBatchStore] Adding tasks to delivery batch', { deliveryBatchId, taskIds });
    try {
      // Update tasks: assign to delivery batch and change status to completed
      const { error } = await supabase
        .from('tasks')
        .update({ 
          delivery_batch_id: deliveryBatchId,
          status: 'completed' // Change status from ready_for_delivery to completed
        })
        .in('id', taskIds);

      if (error) {
        console.error('❌ [DeliveryBatchStore] Error updating tasks for delivery batch:', error);
        throw error;
      }

      console.log('✅ [DeliveryBatchStore] Successfully updated tasks status to completed and assigned to delivery batch');

      // Update the total_tasks count in the delivery batch
      const { error: countError } = await supabase
        .from('delivery_batch')
        .update({ 
          total_tasks: taskIds.length 
        })
        .eq('id', deliveryBatchId);

      if (countError) {
        console.error('❌ [DeliveryBatchStore] Error updating delivery batch task count:', countError);
      } else {
        console.log('✅ [DeliveryBatchStore] Successfully updated delivery batch task count');
      }
    } catch (error: any) {
      console.error('❌ [DeliveryBatchStore] Failed to add tasks to delivery batch:', {
        error: error.message,
        stack: error.stack,
        deliveryBatchId,
        taskIds
      });
      throw error;
    }
  },

  removeTasksFromDeliveryBatch: async (taskIds: string[]) => {
    console.log('🔄 [DeliveryBatchStore] Removing tasks from delivery batch', { taskIds });
    try {
      // Update tasks: remove from delivery batch and change status back to ready_for_delivery
      const { error } = await supabase
        .from('tasks')
        .update({ 
          delivery_batch_id: null,
          status: 'ready_for_delivery' // Change status back to ready_for_delivery
        })
        .in('id', taskIds);

      if (error) {
        console.error('❌ [DeliveryBatchStore] Error removing tasks from delivery batch:', error);
        throw error;
      }

      console.log('✅ [DeliveryBatchStore] Successfully removed tasks from delivery batch and changed status back to ready_for_delivery');
    } catch (error: any) {
      console.error('❌ [DeliveryBatchStore] Failed to remove tasks from delivery batch:', {
        error: error.message,
        stack: error.stack,
        taskIds
      });
      throw error;
    }
  },

  updateBatchStatusToCompleted: async (taskIds: string[]) => {
    console.log('🔄 [DeliveryBatchStore] Updating batch status to completed', { taskIds });
    try {
      // Get unique batch IDs from the selected tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('batch_id')
        .in('id', taskIds);

      if (tasksError) {
        console.error('❌ [DeliveryBatchStore] Error fetching batch IDs from tasks:', tasksError);
        throw tasksError;
      }

      const uniqueBatchIds = [...new Set(tasks?.map(task => task.batch_id) || [])];
      console.log('📊 [DeliveryBatchStore] Found unique batch IDs to update:', uniqueBatchIds);

      // Update all batches to completed status
      for (const batchId of uniqueBatchIds) {
        const { error: batchError } = await supabase
          .from('batches')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', batchId);

        if (batchError) {
          console.error(`❌ [DeliveryBatchStore] Error updating batch ${batchId}:`, batchError);
        } else {
          console.log(`✅ [DeliveryBatchStore] Successfully updated batch ${batchId} timestamp`);
        }
      }

      console.log('✅ [DeliveryBatchStore] Completed updating all batch statuses');
    } catch (error: any) {
      console.error('❌ [DeliveryBatchStore] Failed to update batch status:', {
        error: error.message,
        stack: error.stack,
        taskIds
      });
      throw error;
    }
  },

  clearDeliveryBatches: () => {
    set({ 
      deliveryBatches: [],
      error: null 
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));
