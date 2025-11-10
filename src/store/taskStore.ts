import { create } from 'zustand';
import { supabase } from '../integrations/supabase/client';
import type { Tables, Json } from '../integrations/supabase/types';
import type { ManagerDashboardStats, AnnotatorDashboardStats, ReviewerDashboardStats } from '../types/dashboard';

// Types based on actual Supabase schema
type Task = Tables<'tasks'>;
type TaskHistory = Tables<'task_history'>;

interface TaskTemplateHistory {
  id: string;
  project_id: string;
  task_template: Json | null;
  created_at: string | null;
  created_by: string | null;
  version_number: number;
  version_name: string;
  notes: string | null;
  instructions: string | null;
  reference_link: string | null;
  created_by_profile?: { name: string | null; email: string | null } | null;
}

// Pagination parameters
interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Batch metrics type
interface BatchTaskMetrics {
  batchId: string;
  totalTasks: number;
  completedTasks: number;
}

// Dashboard stats types imported from types/dashboard.ts

interface TaskState {
  // Task State
  tasks: Task[];
  loading: boolean;
  error: string | null;
  createdTask: Task | null;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  
  // Filter State
  activeFilters: {
    status: string | null;
    date: string | null;
    skip: boolean | null;
  };

  // Batch metrics state
  batchMetrics: BatchTaskMetrics[];
  metricsLoading: boolean;

  // Task History State
  taskHistory: TaskHistory[];
  historyLoading: boolean;
  historyError: string | null;

  // Task Template History State
  taskTemplateHistory: TaskTemplateHistory[];
  templateHistoryLoading: boolean;
  templateHistoryError: string | null;

 
  getTasks: (batchId: string | undefined, pagination?: PaginationParams, userRole?: string, currentUserId?: string, projectIdParam?: string) => Promise<void>;
  getAllTasks: () => Promise<void>;

  getBatchTaskMetrics: (projectId: string) => Promise<BatchTaskMetrics[]>;
  getBatchTaskMetricsForBatches: (batchIds: string[]) => Promise<BatchTaskMetrics[]>;

  createTask: (taskData: { batch_id: string; created_by: string; org_id: string; required_annotations: number; type: string; task_data: any }) => Promise<void>;
  updateTask: (id: string, data: { annotations_done?: number; status?: string; task_data?: any; assigned_user?: string | null }) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  clearTasks: () => void;
  clearError: () => void;
  // Local-only helpers
  removeTaskLocally: (id: string) => void;
  incrementTaskSkipCount: (taskId: string) => Promise<void>;

  // Task History Actions
  getTaskHistory: (taskId: string) => Promise<void>;
  getTaskHistoryWithProfiles: (taskId: string) => Promise<any[]>;
  getAllTaskHistory: () => Promise<void>;
  getTaskHistoryLast7Days: () => Promise<void>;

  createTaskHistory: (taskHistoryData: {
    task_id: string;
    annotated_by?: string | null;
    assigned_to?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    results?: Json | null;
    comment?: string | null;
    is_reviewed?: boolean | null;
    reviewed_by?: string | null;
    created_by?: string | null;
    time_taken_to_annotate?: string;
    is_accepted?: boolean | null;
    userRole?: string; // Add user role to determine status update
  }) => Promise<any>; // Return the created history entry
  updateTaskHistory: (id: string, data: {
    end_time?: string | null;
    results?: Json | null;
    comment?: string | null;
    is_reviewed?: boolean | null;
    reviewed_by?: string | null;
    reviewer_comment?: string | null;
    time_taken_to_annotate?: string;
    is_accepted?: boolean | null;
  }) => Promise<void>;
  deleteTaskHistory: (id: string) => Promise<void>;
  clearTaskHistory: () => void;
  clearHistoryError: () => void;

  // Task Template History Actions
  getTaskTemplateHistory: (projectId: string) => Promise<void>;
  createTaskTemplateHistory: (data: {
    project_id?: string | null;
    task_template: Json | null;
    created_by?: string | null;
    notes?: string | null;
    version_name: string;
    instructions?: string | null;
    reference_link?: string | null;
  }) => Promise<TaskTemplateHistory | null>;
  updateTaskTemplateHistory: (id: string, data: {
    project_id?: string | null;
    task_template?: Record<string, unknown>;
    notes?: string | null;
    instructions?: string | null;
    reference_link?: string | null;
  }) => Promise<TaskTemplateHistory | null>;
  getTaskTemplateById: (id: string) => Promise<TaskTemplateHistory | null>;
  getTaskTemplateByBatchId: (batchId: string) => Promise<{ instructions: string | null; reference_link: string | null } | null>;
  clearTaskTemplateHistory: () => void;
  clearTemplateHistoryError: () => void;

  // Filter management functions
  setStatusFilter: (status: string | null) => void;
  setDateFilter: (date: string | null) => void;
  setSkipFilter: (skip: boolean | null) => void;
  clearFilters: () => void;

  // Add pagination control functions
  setPagination: (pagination: { page: number; pageSize: number }) => void;
  loadNextPage: (batchId: string, userRole?: string, currentUserId?: string) => Promise<void>;
  loadPreviousPage: (batchId: string, userRole?: string, currentUserId?: string) => Promise<void>;
  loadPage: (batchId: string, page: number, userRole?: string, currentUserId?: string) => Promise<void>;

  // Delivery batch functions
  getTasksForDeliveryBatch: (deliveryBatchId: string) => Promise<Task[]>;
  updateTaskDeliveryBatch: (taskId: string, deliveryBatchId: string | null) => Promise<void>;
  getTasksByStatus: (orgId: string, status: string) => Promise<Task[]>;

  // Dashboard stats state
  dashboardStats: {
    manager: ManagerDashboardStats | null;
    annotator: AnnotatorDashboardStats | null;
    reviewer: ReviewerDashboardStats | null;
    loading: boolean;
    error: string | null;
  };

  // Dashboard stats functions
  getManagerDashboardStats: (orgId: string) => Promise<ManagerDashboardStats>;
  getAnnotatorDashboardStats: (userId: string, orgId: string) => Promise<AnnotatorDashboardStats>;
  getReviewerDashboardStats: (userId: string, orgId: string) => Promise<ReviewerDashboardStats>;
}


export const useTaskStore = create<TaskState>((set, get) => ({
  // Initial task state
  tasks: [],
  loading: false,
  error: null,
  createdTask: null,
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  },
  
  // Initial filter state
  activeFilters: {
    status: null,
    date: null,
    skip: null,
  },

  // Initial batch metrics state
  batchMetrics: [],
  metricsLoading: false,

  // Initial task history state
  taskHistory: [],
  historyLoading: false,
  historyError: null,

  // Initial task template history state
  taskTemplateHistory: [],
  templateHistoryLoading: false,
  templateHistoryError: null,

  // Initial dashboard stats state
  dashboardStats: {
    manager: null,
    annotator: null,
    reviewer: null,
    loading: false,
    error: null,
  },

  // Actions
  getTasks: async (batchId: string | undefined, pagination?: PaginationParams, userRole?: string, currentUserId?: string, projectIdParam?: string) => {
    set({ loading: true, error: null });
    try {
      // Get current filter state
      const { activeFilters } = get();
      const statusFilter = activeFilters.status;
      const dateFilter = activeFilters.date;
      const skipFilter = activeFilters.skip;
      
      // For annotators, use the optimized RPC function with priority sorting
      if (userRole === 'annotator' && currentUserId) {
        const page = pagination?.page || 1;
        const pageSize = pagination?.pageSize || 10;
        const offset = (page - 1) * pageSize;

        // For annotators, pass all statuses to RPC but let it handle ordering
        // Priority tasks: available/rejected (with custom ordering)
        // Other tasks: needs_review/ready_for_delivery (appended at end)
        const taskStatuses = ['available', 'rejected', 'needs_review', 'ready_for_delivery'];
        // Build the params object dynamically to only include batch_id_param and project_id_param if present
        const rpcParams: Record<string, any> = {
          current_user_id: currentUserId,
          task_statuses: taskStatuses,
          offset_param: offset,
          limit_param: pageSize,
          status_filter: statusFilter || null,
          date_filter: dateFilter || null,
          skip_filter: skipFilter
        };
        if (batchId) {
          rpcParams.batch_id_param = batchId;
        }
        if (projectIdParam) {
          rpcParams.project_id_param = projectIdParam;
        }

        const { data, error } = await supabase.rpc('get_tasks_with_priority_sorting', rpcParams);

        if (error) {
          console.error('Error with priority sorting RPC, falling back to standard query:', error);
          // Fall through to standard query below
        } else {
          // Process RPC results - transform to match expected structure
          const transformedTasks = (data || []).map((task: any) => ({
            ...task,
            profiles: task.profile_name ? {
              name: task.profile_name,
              email: task.profile_email
            } : null
          }));

          const total = transformedTasks.length > 0 ? transformedTasks[0].total_count : 0;
          const totalPages = Math.ceil(total / pageSize);

          set({
            tasks: transformedTasks,
            loading: false,
            pagination: {
              page,
              pageSize,
              total,
              totalPages,
            }
          });
          return;
        }
      }

      // Standard query for other roles or fallback
      let query;
      
      if (projectIdParam) {
        console.log('projectIdParam2', projectIdParam);
        // Project-wide tasks: join batches to filter by project
        query = supabase
          .from('tasks')
          .select(`
            *,
            profiles!assigned_user(name, email),
            batches!inner(id, name, project_id)
          `, { count: 'exact' })
          .eq('batches.project_id', projectIdParam);
      } else if (batchId) {
        // Batch-specific tasks
        query = supabase
          .from('tasks')
          .select(`
            *,
            profiles!assigned_user(name, email)
          `, { count: 'exact' })
          .eq('batch_id', batchId as string);
      } else {
        return;
      }
      
      // Apply status filter if provided (no more role-based hard-coding)
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      // Apply date filter if provided
      if (dateFilter) {
        const now = new Date();
        let dateThreshold: Date;
        
        switch (dateFilter) {
          case '7days':
            dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '15days':
            dateThreshold = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
            break;
          case '30days':
            dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '90days':
            dateThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          default:
            dateThreshold = new Date(0); // Show all if invalid filter
        }
        query = query.gte('created_at', dateThreshold.toISOString());
      }

      // Apply skip filter if provided
      if (skipFilter !== null) {
        if (skipFilter === true) {
          // Show only skipped tasks
          query = query.gt('skip_count', 0);
        } else {
          // Hide skipped tasks (show only non-skipped)
          query = query.eq('skip_count', 0);
        }
      }
      
      // Use simple ordering at database level
      query = query.order('created_at', { ascending: false });

      // Always apply pagination with default page size of 10
      const page = pagination?.page || 1;
      const pageSize = pagination?.pageSize || 10; // Always default to 10 items
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      
      if (error) {
        console.log(error);
        throw error;
      }

      const filteredTasks = data || [];

      const total = count || 0;
      const totalPages = Math.ceil(total / pageSize);

      set({
        tasks: filteredTasks,
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
        error: error.message || 'Failed to fetch tasks',
        loading: false
      });
    }
  },

  getAllTasks: async (pagination?: PaginationParams) => {
    set({ loading: true, error: null });
    try {
      let query = supabase
        .from('tasks')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Only apply pagination if explicitly provided  
      if (pagination && pagination.pageSize) {
        const page = pagination.page || 1;
        const pageSize = pagination.pageSize;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      const total = count || 0;
      const page = pagination?.page || 1;
      const pageSize = pagination?.pageSize || total; // Default to all tasks
      const totalPages = pagination?.pageSize ? Math.ceil(total / pageSize) : 1;

      set({
        tasks: data || [],
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
        error: error.message || 'Failed to fetch all tasks',
        loading: false
      });
    }
  },

  getBatchTasks: async (batchId: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          profiles!assigned_user(name, email)
        `)
        .eq('batch_id', batchId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      set({
        tasks: data || [],
        loading: false,
        pagination: {
          page: 1,
          pageSize: data?.length || 0,
          total: data?.length || 0,
          totalPages: 1,
        }
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch batch tasks',
        loading: false
      });
    }
  },

  // Optimized method for annotation workflow - only essential fields
  getAnnotationTasks: async (batchId: string, page: number = 1, pageSize: number = 5) => {
    set({ loading: true, error: null });
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Only fetch essential fields for annotation
      const { data, error, count } = await supabase
        .from('tasks')
        .select(`
          id,
          batch_id,
          status,
          annotations_done,
          required_annotations,
          task_data,
          created_at,
          updated_at,
          assigned_user,
          created_by,
          org_id,
          type
        `, { count: 'exact' })
        .eq('batch_id', batchId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        throw error;
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / pageSize);

      set({
        tasks: page === 1 ? (data || []) : [...get().tasks, ...(data || [])],
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
        error: error.message || 'Failed to fetch annotation tasks',
        loading: false
      });
    }
  },

  // Ensure specific task is loaded for annotation
  ensureTaskLoaded: async (batchId: string, taskId: string) => {
    set({ loading: true, error: null });
    try {
      // First check if the task is already loaded
      const existingTasks = get().tasks;
      const taskExists = existingTasks.some(task => task.id === taskId);
      
      if (taskExists) {
        set({ loading: false });
        return;
      }

      // Load the specific task plus some surrounding tasks
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          batch_id,
          status,
          annotations_done,
          required_annotations,
          task_data,
          created_at,
          updated_at,
          assigned_user,
          created_by,
          org_id,
          type
        `)
        .eq('batch_id', batchId)
        .eq('id', taskId);

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        // Only update if we're actually adding new tasks
        const newTasks = [...existingTasks, ...data];
        const hasNewTasks = newTasks.length > existingTasks.length;
        
        if (hasNewTasks) {
          set({
            tasks: newTasks,
            loading: false,
            pagination: {
              page: 1,
              pageSize: newTasks.length,
              total: newTasks.length,
              totalPages: 1,
            }
          });
        } else {
          set({ loading: false });
        }
      } else {
        set({ loading: false });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Failed to ensure task is loaded',
        loading: false
      });
    }
  },



  createTask: async (taskData: { batch_id: string; created_by: string; org_id: string; required_annotations: number; type: string; task_data: any; assigned_user?: string | null }) => {
    set({ loading: true, error: null });

    try {
      // Ensure required fields are provided
      const taskToInsert = {
        batch_id: taskData.batch_id,
        created_by: taskData.created_by,
        org_id: taskData.org_id,
        required_annotations: taskData.required_annotations,
        type: taskData.type,
        task_data: taskData.task_data,
        assigned_user: taskData.assigned_user || null,
        annotations_done: 0,
        status: 'available',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      console.log(taskToInsert);
      const { data, error } = await supabase
        .from('tasks')
        .insert([taskToInsert])
        .select()
        .single();

      if (error) {
        console.log(error);
        throw error;
      }

      set({
        tasks: [...get().tasks, data],
        createdTask: data,
        loading: false
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to create task',
        loading: false
      });
    }
  },

  updateTask: async (id: string, data: { annotations_done?: number; status?: string; task_data?: any; assigned_user?: string | null }) => {
    set({ loading: true, error: null });

    try {
      const updateData = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedTask, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      set({
        tasks: get().tasks.map(task =>
          task.id === id ? updatedTask : task
        ),
        loading: false
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to update task',
        loading: false
      });
    }
  },

  deleteTask: async (id: string) => {
    set({ loading: true, error: null });

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }


      set({
        tasks: get().tasks.filter(task => task.id !== id),
        loading: false
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to delete task',
        loading: false
      });
    }
  },

  clearTasks: () => {
    set({
      tasks: [],
      error: null
    });
  },

  clearError: () => {
    set({ error: null });
  },

  // Remove a task from local state without hitting DB
  removeTaskLocally: (id: string) => {
    set((state) => {
      const updatedTasks = state.tasks.filter(t => t.id !== id);
      const newTotal = Math.max(0, state.pagination.total - 1);
      const newTotalPages = state.pagination.pageSize > 0
        ? Math.max(1, Math.ceil(newTotal / state.pagination.pageSize))
        : state.pagination.totalPages;
      // If current page exceeds new total pages, clamp it
      const newPage = Math.min(state.pagination.page, newTotalPages);
      return {
        tasks: updatedTasks,
        pagination: {
          ...state.pagination,
          total: newTotal,
          totalPages: newTotalPages,
          page: newPage,
        }
      };
    });
  },

  getBatchTaskMetrics: async (projectId: string) => {
    set({ metricsLoading: true, error: null });
    try {
      // First, get all batch IDs for this project
      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .select('id')
        .eq('project_id', projectId);

      if (batchError) {
        throw batchError;
      }

      if (!batchData || batchData.length === 0) {
        set({
          batchMetrics: [],
          metricsLoading: false
        });
        return [];
      }

      const batchIds = batchData.map(b => b.id);

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          batch_id,
          status,
          annotations_done,
          required_annotations
        `)
        .in('batch_id', batchIds);

      if (error) {
        throw error;
      }

      // Group tasks by batch_id and calculate metrics
      const metricsMap = new Map<string, { total: number; completed: number }>();
      
      (data || []).forEach(task => {
        const batchId = task.batch_id;
        if (!metricsMap.has(batchId)) {
          metricsMap.set(batchId, { total: 0, completed: 0 });
        }
        
        const metrics = metricsMap.get(batchId)!;
        metrics.total++;
        
        // Consider task completed if annotations_done >= required_annotations or status is 'ready_for_delivery'
        if (task.status === 'ready_for_delivery' || (task.annotations_done >= task.required_annotations)) {
          metrics.completed++;
        }
      });

      // Convert map to array
      const batchMetrics: BatchTaskMetrics[] = Array.from(metricsMap.entries()).map(([batchId, metrics]) => ({
        batchId,
        totalTasks: metrics.total,
        completedTasks: metrics.completed,
      }));

      set({
        batchMetrics,
        metricsLoading: false
      });

      return batchMetrics;
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch batch task metrics',
        metricsLoading: false
      });
      return [];
    }
  },

  getBatchTaskMetricsForBatches: async (batchIds: string[]) => {
    set({ metricsLoading: true, error: null });
    try {
      if (!batchIds || batchIds.length === 0) {
        set({
          batchMetrics: [],
          metricsLoading: false
        });
        return [];
      }

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          batch_id,
          status,
          annotations_done,
          required_annotations
        `)
        .in('batch_id', batchIds);

      if (error) {
        throw error;
      }

      // Group tasks by batch_id and calculate metrics
      const metricsMap = new Map<string, { total: number; completed: number }>();
      
      // Initialize map with all batch IDs to ensure every batch has metrics even if no tasks
      batchIds.forEach(batchId => {
        metricsMap.set(batchId, { total: 0, completed: 0 });
      });

      (data || []).forEach(task => {
        const batchId = task.batch_id;
        const metrics = metricsMap.get(batchId)!;
        metrics.total++;
        
        // Consider task completed if annotations_done >= required_annotations or status is 'ready_for_delivery'
        if (task.status === 'ready_for_delivery' || (task.annotations_done >= task.required_annotations)) {
          metrics.completed++;
        }
      });

      // Convert map to array
      const batchMetrics: BatchTaskMetrics[] = Array.from(metricsMap.entries()).map(([batchId, metrics]) => ({
        batchId,
        totalTasks: metrics.total,
        completedTasks: metrics.completed,
      }));

      // Update existing batch metrics with new data
      const currentMetrics = get().batchMetrics;
      const updatedMetrics = currentMetrics.filter(m => !batchIds.includes(m.batchId));
      updatedMetrics.push(...batchMetrics);

      set({
        batchMetrics: updatedMetrics,
        metricsLoading: false
      });

      return batchMetrics;
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch batch task metrics for batches',
        metricsLoading: false
      });
      return [];
    }
  },

  // Task History Actions
  getTaskHistory: async (taskId: string) => {
    set({ historyLoading: true, historyError: null });
    try {
      const { data, error } = await supabase
        .from('task_history')
        .select(`
          *,
          annotated_by_profile:profiles!annotated_by(name, email),
          assigned_to_profile:profiles!assigned_to(name, email),
          reviewed_by_profile:profiles!reviewed_by(name, email),
          created_by_profile:profiles!created_by(name, email)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      set({
        taskHistory: data || [],
        historyLoading: false
      });
    } catch (error: any) {
      set({
        historyError: error.message || 'Failed to fetch task history',
        historyLoading: false
      });
    }
  },

  getTaskHistoryWithProfiles: async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from('task_history')
        .select(`
          *,
          annotated_by_profile:profiles!annotated_by(name, email),
          reviewed_by_profile:profiles!reviewed_by(name, email)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error: any) {
      console.error('Error fetching task history with profiles:', error);
      return [];
    }
  },

  getAllTaskHistory: async () => {
    set({ historyLoading: true, historyError: null });
    try {
      const { data, error } = await supabase
        .from('task_history')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      set({
        taskHistory: data || [],
        historyLoading: false
      });
    } catch (error: any) {
      set({
        historyError: error.message || 'Failed to fetch all task history',
        historyLoading: false
      });
    }
  },

  getTaskHistoryLast7Days: async () => {
    set({ historyLoading: true, historyError: null });
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('task_history')
        .select('*')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      set({
        taskHistory: data || [],
        historyLoading: false
      });
    } catch (error: any) {
      set({
        historyError: error.message || 'Failed to fetch task history for last 7 days',
        historyLoading: false
      });
    }
  },

  createTaskHistory: async (taskHistoryData: {
    task_id: string;
    annotated_by?: string | null;
    assigned_to?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    results?: Json | null;
    comment?: string | null;
    is_reviewed?: boolean | null;
    reviewed_by?: string | null;
    created_by?: string | null;
    time_taken_to_annotate?: string;
    is_accepted?: boolean | null;
    userRole?: string; // Add user role to determine status update
  }) => {
    set({ historyLoading: true, historyError: null });
    const { userRole } = taskHistoryData;
    delete taskHistoryData.userRole;
    
    try {
      const taskHistoryToInsert = {
        ...taskHistoryData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('task_history')
        .insert([taskHistoryToInsert])
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Update task status based on user role
      if (data) {
        let newStatus = (userRole === 'reviewer' || userRole === 'manager' || userRole === 'admin') ? 'ready_for_delivery' : 'needs_review'; 

        // Update task status
        await supabase
          .from('tasks')
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', taskHistoryData.task_id);
      }

      set({
        taskHistory: [...get().taskHistory, data],
        historyLoading: false
      });

      return data; 
    } catch (error: any) {
      set({
        historyError: error.message || 'Failed to create task history',
        historyLoading: false
      });
      throw error; // Re-throw to allow caller to handle
    }
  },

  updateTaskHistory: async (id: string, data: {
    end_time?: string | null;
    results?: Json | null;
    comment?: string | null;
    is_reviewed?: boolean | null;
    reviewed_by?: string | null;
    reviewer_comment?: string | null;
    time_taken_to_annotate?: string;
    is_accepted?: boolean | null;
  }) => {
    set({ historyLoading: true, historyError: null });

    try {
      const updateData = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedTaskHistory, error } = await supabase
        .from('task_history')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      set({
        taskHistory: get().taskHistory.map(th =>
          th.id === id ? updatedTaskHistory : th
        ),
        historyLoading: false
      });
    } catch (error: any) {
      set({
        historyError: error.message || 'Failed to update task history',
        historyLoading: false
      });
    }
  },

  deleteTaskHistory: async (id: string) => {
    set({ historyLoading: true, historyError: null });

    try {
      const { error } = await supabase
        .from('task_history')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      set({
        taskHistory: get().taskHistory.filter(th => th.id !== id),
        historyLoading: false
      });
    } catch (error: any) {
      set({
        historyError: error.message || 'Failed to delete task history',
        historyLoading: false
      });
    }
  },

  clearTaskHistory: () => {
    set({
      taskHistory: [],
      historyError: null
    });
  },

  clearHistoryError: () => {
    set({ historyError: null });
  },

  // Task Template History Actions
  getTaskTemplateHistory: async (projectId: string) => {
    set({ templateHistoryLoading: true, templateHistoryError: null });
    try {
      const { data, error } = await supabase
        .from('tasktemplate_history')
        .select(`
          *,
          created_by_profile:profiles!created_by(name, email)
        `)
        .eq('project_id', projectId)
        .order('version_number', { ascending: false });

      if (error) {
        throw error;
      }

      set({
        taskTemplateHistory: data || [],
        templateHistoryLoading: false
      });
    } catch (error: any) {
      set({
        templateHistoryError: error.message || 'Failed to fetch task template history',
        templateHistoryLoading: false
      });
    }
  },

  createTaskTemplateHistory: async (data) => {
    set({ templateHistoryLoading: true, templateHistoryError: null });
    try {
      let nextVersionNumber = 1;
      
      // Only check for existing versions if project_id is provided
      if (data.project_id) {
        const { data: existingVersions, error: versionError } = await supabase
          .from('tasktemplate_history')
          .select('version_number')
          .eq('project_id', data.project_id)
          .order('version_number', { ascending: false })
          .limit(1);

        if (versionError) {
          throw versionError;
        }

        nextVersionNumber = existingVersions && existingVersions.length > 0 
          ? existingVersions[0].version_number + 1 
          : 1;
      }

      // Insert new version (project_id can be null)
      const { data: newHistory, error } = await supabase
        .from('tasktemplate_history')
        .insert({
          project_id: data.project_id || null,
          task_template: data.task_template,
          created_by: data.created_by,
          notes: data.notes,
          version_number: nextVersionNumber,
          version_name: data.version_name,
          instructions: data.instructions || null,
          reference_link: data.reference_link || null,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      set({
        taskTemplateHistory: [newHistory, ...get().taskTemplateHistory],
        templateHistoryLoading: false
      });

      return newHistory;
    } catch (error: any) {
      set({
        templateHistoryError: error.message || 'Failed to create task template history',
        templateHistoryLoading: false
      });
      return null;
    }
  },

  updateTaskTemplateHistory: async (id: string, data) => {
    set({ templateHistoryLoading: true, templateHistoryError: null });
    try {
      const { data: updatedHistory, error } = await supabase
        .from('tasktemplate_history')
        .update({
          project_id: data.project_id,
          task_template: data.task_template,
          notes: data.notes,
          instructions: data.instructions,
          reference_link: data.reference_link,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      set({
        taskTemplateHistory: get().taskTemplateHistory.map(th =>
          th.id === id ? updatedHistory : th
        ),
        templateHistoryLoading: false
      });

      return updatedHistory;
    } catch (error: any) {
      set({
        templateHistoryError: error.message || 'Failed to update task template history',
        templateHistoryLoading: false
      });
      return null;
    }
  },

  getTaskTemplateById: async (id: string) => {
    if (!id) return null;
    
    set({ templateHistoryLoading: true, templateHistoryError: null });
    try {
      const { data, error } = await supabase
        .from('tasktemplate_history')
        .select(`
          *,
          created_by_profile:profiles!created_by(name, email)
        `)
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      set({ templateHistoryLoading: false });
      return data;
    } catch (error: any) {
      set({
        templateHistoryError: error.message || 'Failed to fetch task template',
        templateHistoryLoading: false
      });
      return null;
    }
  },

  getTaskTemplateByBatchId: async (batchId: string) => {
    if (!batchId) return null;

    try {
      // First get the batch to find the task_template_id
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .select('task_template_id')
        .eq('id', batchId)
        .single();

      if (batchError || !batch?.task_template_id) {
        return null;
      }

      // Then get the task template instructions and reference link
      const { data: template, error: templateError } = await supabase
        .from('tasktemplate_history')
        .select('instructions, reference_link')
        .eq('id', batch.task_template_id)
        .single();

      if (templateError) {
        console.error('Error fetching task template instructions:', templateError);
        return null;
      }

      return {
        instructions: template.instructions,
        reference_link: template.reference_link
      };
    } catch (error: any) {
      console.error('Error fetching task template by batch ID:', error);
      return null;
    }
  },

  clearTaskTemplateHistory: () => {
    set({
      taskTemplateHistory: [],
      templateHistoryError: null
    });
  },

  clearTemplateHistoryError: () => {
    set({ templateHistoryError: null });
  },

  // Add pagination control functions
  setPagination: (pagination: { page: number; pageSize: number }) => {
    set((state) => ({
      pagination: {
        ...state.pagination,
        ...pagination,
        totalPages: Math.ceil(state.pagination.total / pagination.pageSize)
      }
    }));
  },

  loadNextPage: async (batchId: string, userRole?: string, currentUserId?: string) => {
    const currentState = get();
    const nextPage = currentState.pagination.page + 1;
    
    if (nextPage <= currentState.pagination.totalPages) {
      await get().getTasks(batchId, { 
        page: nextPage, 
        pageSize: currentState.pagination.pageSize 
      }, userRole, currentUserId);
    }
  },

  loadPreviousPage: async (batchId: string, userRole?: string, currentUserId?: string) => {
    const currentState = get();
    const prevPage = currentState.pagination.page - 1;
    
    if (prevPage >= 1) {
      await get().getTasks(batchId, { 
        page: prevPage, 
        pageSize: currentState.pagination.pageSize 
      }, userRole, currentUserId);
    }
  },

  loadPage: async (batchId: string, page: number, userRole?: string, currentUserId?: string) => {
    const currentState = get();
    if (page >= 1 && page <= currentState.pagination.totalPages) {
      await get().getTasks(batchId, { 
        page, 
        pageSize: currentState.pagination.pageSize 
      }, userRole, currentUserId);
    }
  },

  // Delivery batch functions
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

  updateTaskDeliveryBatch: async (taskId: string, deliveryBatchId: string | null) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ delivery_batch_id: deliveryBatchId })
        .eq('id', taskId);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Error updating task delivery batch:', error);
      throw error;
    }
  },

  getTasksByStatus: async (orgId: string, status: string) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          profiles!tasks_assigned_user_fkey(name, email)
        `)
        .eq('org_id', orgId)
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error: any) {
      console.error('Error loading tasks by status:', error);
      return [];
    }
  },

  // Filter management functions
  setStatusFilter: (status: string | null) => {
    set((state) => ({
      activeFilters: {
        ...state.activeFilters,
        status,
      },
      pagination: {
        ...state.pagination,
        page: 1, // Reset to first page when filter changes
      },
    }));
  },

  setDateFilter: (date: string | null) => {
    set((state) => ({
      activeFilters: {
        ...state.activeFilters,
        date,
      },
      pagination: {
        ...state.pagination,
        page: 1, // Reset to first page when filter changes
      },
    }));
  },

  setSkipFilter: (skip: boolean | null) => {
    set((state) => ({
      activeFilters: {
        ...state.activeFilters,
        skip,
      },
      pagination: {
        ...state.pagination,
        page: 1, // Reset to first page when filter changes
      },
    }));
  },

  clearFilters: () => {
    set((state) => ({
      activeFilters: {
        status: null,
        date: null,
        skip: null,
      },
      pagination: {
        ...state.pagination,
        page: 1, // Reset to first page when filters are cleared
      },
    }));
  },

  incrementTaskSkipCount: async (taskId: string) => {
    try {
      // First get current task to read skip_count
      const { data: currentTask, error: fetchError } = await supabase
        .from('tasks')
        .select('skip_count')
        .eq('id', taskId)
        .single();

      if (fetchError) {
        console.error('Error fetching current task:', fetchError);
        throw fetchError;
      }

      const newSkipCount = (currentTask?.skip_count || 0) + 1;

      // Update with incremented value
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          skip_count: newSkipCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (updateError) {
        console.error('Error updating skip count:', updateError);
        throw updateError;
      }

      // Update local state to reflect the change
      set((state) => ({
        tasks: state.tasks.map(task =>
          task.id === taskId
            ? { ...task, skip_count: newSkipCount, updated_at: new Date().toISOString() }
            : task
        ),
      }));
    } catch (error: any) {
      console.error('Failed to increment task skip count:', error);
      throw error;
    }
  },

  // Dashboard stats functions
  getManagerDashboardStats: async (orgId: string) => {
    set(state => ({
      dashboardStats: {
        ...state.dashboardStats,
        loading: true,
        error: null,
      },
    }));

    try {
      const { data, error } = await supabase.rpc('get_manager_dashboard_stats', {
        p_org_id: orgId,
      });

      if (error) {
        throw error;
      }

      const stats = data as ManagerDashboardStats;
      set(state => ({
        dashboardStats: {
          ...state.dashboardStats,
          manager: stats,
          loading: false,
        },
      }));

      return stats;
    } catch (error: any) {
      set(state => ({
        dashboardStats: {
          ...state.dashboardStats,
          loading: false,
          error: error.message || 'Failed to fetch manager dashboard stats',
        },
      }));
      throw error;
    }
  },

  getAnnotatorDashboardStats: async (userId: string, orgId: string) => {
    set(state => ({
      dashboardStats: {
        ...state.dashboardStats,
        loading: true,
        error: null,
      },
    }));

    try {
      const { data, error } = await supabase.rpc('get_annotator_dashboard_stats', {
        p_user_id: userId,
        p_org_id: orgId,
      });

      if (error) {
        throw error;
      }

      const stats = data as AnnotatorDashboardStats;
      set(state => ({
        dashboardStats: {
          ...state.dashboardStats,
          annotator: stats,
          loading: false,
        },
      }));

      return stats;
    } catch (error: any) {
      set(state => ({
        dashboardStats: {
          ...state.dashboardStats,
          loading: false,
          error: error.message || 'Failed to fetch annotator dashboard stats',
        },
      }));
      throw error;
    }
  },

  getReviewerDashboardStats: async (userId: string, orgId: string) => {
    set(state => ({
      dashboardStats: {
        ...state.dashboardStats,
        loading: true,
        error: null,
      },
    }));

    try {
      const { data, error } = await supabase.rpc('get_reviewer_dashboard_stats', {
        p_user_id: userId,
        p_org_id: orgId,
      });

      if (error) {
        throw error;
      }

      const stats = data as ReviewerDashboardStats;
      set(state => ({
        dashboardStats: {
          ...state.dashboardStats,
          reviewer: stats,
          loading: false,
        },
      }));

      return stats;
    } catch (error: any) {
      set(state => ({
        dashboardStats: {
          ...state.dashboardStats,
          loading: false,
          error: error.message || 'Failed to fetch reviewer dashboard stats',
        },
      }));
      throw error;
    }
  },
}));
