import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import type { TaskTemplate } from '@/lib/fileIngestion/types';
import { useTaskStore } from './taskStore';

// Types based on actual Supabase schema
type Project = Tables<'projects'>;

// Pagination parameters
interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface ProjectState {
  // State
  projects: Project[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };

  // Actions
  getProjects: (orgId: string, pagination?: PaginationParams , userId?: string) => Promise<void>;
 
  refreshProjects: (orgId: string, pagination?: PaginationParams, userId?: string) => Promise<void>;
  getUserProjectIds: (userId: string) => Promise<string[]>;
  getProjectsByIds: (projectIds: string[]) => Promise<Project[]>;
  updateUserProjectAccess: (userId: string, projectIds: string[], orgId: string) => Promise<void>;
  createProject: (projectData: { org_id: string; name: string; client: string; task_template?: TaskTemplate | null; version_name?: string; instructions?: string; reference_link?: string; created_by: string }) => Promise<void>;
  updateProject: (projectData: { id: string; name?: string; client?: string; task_template?: TaskTemplate | null; version_name?: string; instructions?: string; reference_link?: string }) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  addBatch: (batchData: { project_id: string; name: string; org_id: string; file_url?: string }) => Promise<void>;
  clearErrors: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // Initial state
  projects: [],
  loading: false,
  error: null,
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  },


  // Actions
  getProjects: async (orgId: string, pagination?: PaginationParams, userId?: string) => {
    set({ loading: true, error: null });
    try {
      let query;
      
   
      let currentUserId = userId;
      if (!currentUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        currentUserId = user?.id;
      }
      
      console.log('userId', currentUserId);
      
      if (currentUserId) {
        // Use getUserProjectIds to get resource IDs
        const resourceIds = await get().getUserProjectIds(currentUserId);
        console.log('Resource IDs for user:', currentUserId, resourceIds);
        
        if (resourceIds.length === 0) {
          // No projects assigned to user, return empty result
          set({
            projects: [],
            loading: false,
            pagination: {
              page: pagination?.page || 1,
              pageSize: pagination?.pageSize || 10,
              total: 0,
              totalPages: 0,
            }
          });
          return;
        }

        // Single query to get projects with profiles
        query = supabase
          .from('projects')
          .select(`
            *,
            profiles!projects_created_by_fkey(name, email)
          `, { count: 'exact' })
          .in('id', resourceIds)
          .order('created_at', { ascending: false });
          
      } 

      // Apply pagination
      const page = pagination?.page || 1;
      const pageSize = pagination?.pageSize || 10;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      query = query.range(from, to);
     
      const { data, error, count } = await query;
      console.log('query----->', data);
      if (error) {
        console.log(error);
        throw error;
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / pageSize);

      // Data is already in the correct format
      const projects = data || [];

      set({
        projects,
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
        error: error.message || 'Error loading projects',
        loading: false
      });
    }
  },

  
  refreshProjects: async (orgId: string,pagination?: PaginationParams, userId?: string) => {
    await get().getProjects(orgId,pagination, userId);
  },

  getUserProjectIds: async (userId: string) => {
    try {
      const { data: aclData, error } = await supabase
        .from('resource_acl')
        .select('resource_id')
        .eq('user_id', userId)
        .eq('resource_type', 'project');

      if (error) {
        throw error;
      }

      return aclData?.map(item => item.resource_id) || [];
    } catch (error: any) {
      console.error('Error fetching user project IDs:', error);
      throw error;
    }
  },

  getProjectsByIds: async (projectIds: string[]) => {
    try {
      if (!projectIds || projectIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error: any) {
      console.error('Error fetching projects by IDs:', error);
      throw error;
    }
  },

  updateUserProjectAccess: async (userId: string, projectIds: string[], orgId: string) => {
    try {
      // Get current project access for this user
      const { data: currentAccess, error: fetchError } = await supabase
        .from('resource_acl')
        .select('resource_id')
        .eq('user_id', userId)
        .eq('resource_type', 'project')
        .eq('org_id', orgId);

      if (fetchError) {
        throw fetchError;
      }

      const currentProjectIds = currentAccess?.map(item => item.resource_id) || [];
      const projectsToAdd = projectIds.filter(id => !currentProjectIds.includes(id));
      const projectsToRemove = currentProjectIds.filter(id => !projectIds.includes(id));

      console.log('Projects to add:', projectsToAdd);
      console.log('Projects to remove:', projectsToRemove);

      // Remove access for projects that are no longer selected
      if (projectsToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('resource_acl')
          .delete()
          .eq('user_id', userId)
          .eq('resource_type', 'project')
          .eq('org_id', orgId)
          .in('resource_id', projectsToRemove);

        if (deleteError) {
          throw deleteError;
        }
      }

      // Add access for new projects
      if (projectsToAdd.length > 0) {
        const newAccessRecords = projectsToAdd.map(projectId => ({
          user_id: userId,
          resource_id: projectId,
          resource_type: 'project',
          org_id: orgId
        }));

        const { error: insertError } = await supabase
          .from('resource_acl')
          .insert(newAccessRecords);

        if (insertError) {
          throw insertError;
        }
      }
    } catch (error: any) {
      console.error('Error updating user project access:', error);
      throw error;
    }
  },

  createProject: async (projectData: { org_id: string; name: string; client: string; task_template?: TaskTemplate | null; version_name?: string; instructions?: string; reference_link?: string; created_by: string }) => {
    set({ loading: true, error: null });

    try {
      const projectId = crypto.randomUUID();
      let taskTemplateId: string | null = null;

      // If task template was provided, create history entry first with null project_id
      if (projectData.task_template && projectData.version_name) {
        try {
          // Get current user ID
          const { data: { user } } = await supabase.auth.getUser();
          
          // Create task template history with null project_id first
          const historyEntry = await useTaskStore.getState().createTaskTemplateHistory({
            project_id: null,
            task_template: projectData.task_template,
            created_by: user?.id || null,
            notes: 'Initial task template creation',
            version_name: projectData.version_name,
            instructions: projectData.instructions || null,
            reference_link: projectData.reference_link || null
          });

          taskTemplateId = historyEntry?.id || null;
        } catch (historyError) {
          console.error('Failed to save task template history:', historyError);
          throw new Error('Failed to create task template. Please provide a version name.');
        }
      }

      // Create project with reference to task template history
      const projectToInsert = {
        id: projectId,
        org_id: projectData.org_id,
        name: projectData.name,
        client: projectData.client,
        task_template_id: taskTemplateId,
        created_by: projectData.created_by,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('projects')
        .insert([projectToInsert])
        .select()
        .single();

      if (error) {
        console.log(error);
        throw error;
      }

      // Update the task template history with the project_id now that project is created
      if (taskTemplateId) {
        try {
          await useTaskStore.getState().updateTaskTemplateHistory(taskTemplateId, {
            project_id: projectId
          });
        } catch (updateError) {
          console.error('Failed to update task template history with project_id:', updateError);
          // Don't fail the entire operation for this update
        }
      }

      // Add ACL entry for project creator so they can access their own project
      try {
        await supabase
          .from('resource_acl')
          .insert({
            org_id: projectData.org_id,
            user_id: projectData.created_by,
            resource_type: 'project',
            resource_id: projectId
          });
      } catch (aclError) {
        console.error('Failed to create resource ACL entry:', aclError);
        // Don't fail the entire operation for this - project is already created
      }

      set({
        projects: [data, ...get().projects],
        loading: false
      });
    } catch (error: any) {
      set({
        error: error.message || 'Error creating project',
        loading: false
      });
    }
  },

  updateProject: async (projectData: { id: string; name?: string; client?: string; task_template?: TaskTemplate | null; version_name?: string; instructions?: string; reference_link?: string }) => {
    set({ loading: true, error: null });

    try {
      let taskTemplateId: string | null = null;

      // If task template was provided, create new history entry
      if (projectData.task_template && projectData.version_name) {
        try {
          // Get current user ID
          const { data: { user } } = await supabase.auth.getUser();
          
          const historyEntry = await useTaskStore.getState().createTaskTemplateHistory({
            project_id: projectData.id,
            task_template: projectData.task_template,
            created_by: user?.id || null,
            notes: 'Task template updated',
            version_name: projectData.version_name,
            instructions: projectData.instructions || null,
            reference_link: projectData.reference_link || null
          });

          taskTemplateId = historyEntry?.id || null;
        } catch (historyError) {
          console.error('Failed to save task template history:', historyError);
          throw new Error('Failed to update task template. Please provide a version name.');
        }
      }

      // Prepare the update data
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (projectData.name !== undefined) updateData.name = projectData.name;
      if (projectData.client !== undefined) updateData.client = projectData.client;
      if (taskTemplateId !== null) updateData.task_template_id = taskTemplateId;

      const { data, error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', projectData.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Update the project in the store
      set({
        projects: get().projects.map((p) =>
          p.id === projectData.id ? data : p
        ),
        loading: false
      });
    } catch (error: any) {
      set({
        error: error.message || 'Error updating project',
        loading: false
      });
    }
  },

  deleteProject: async (projectId: string) => {
    set({ loading: true, error: null });

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) {
        throw error;
      }

      set({
        projects: get().projects.filter(project => project.id !== projectId),
        loading: false
      });
    } catch (error: any) {
      set({
        error: error.message || 'Error deleting project',
        loading: false
      });
    }
  },

  addBatch: async (batchData: { project_id: string; name: string; org_id: string; file_url?: string }) => {
    set({ loading: true, error: null });

    try {
      // Ensure required fields are provided
      const batchToInsert = {
        id: crypto.randomUUID(),
        project_id: batchData.project_id,
        name: batchData.name,
        org_id: batchData.org_id,
        file_url: batchData.file_url || null,
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
        loading: false
      });

      // Optionally refresh projects or update specific project
      // You might want to add a method to refresh a specific project's batches
    } catch (error: any) {
      set({
        error: error.message || 'Error adding batch',
        loading: false
      });
    }
  },


  clearErrors: () => {
    set({
      error: null,
    });
  },
})); 