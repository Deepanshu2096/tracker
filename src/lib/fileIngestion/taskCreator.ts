import { supabase } from '../../integrations/supabase/client';
import { type ParsedRow, type TaskCreationData, FILE_PROCESSING_CONFIG } from './types';
import { useTeamStore } from '../../store/teamStore';
import {
  getExistingTaskCounts,
  calculateTaskDistribution,
  assignTasksToAnnotators,
  getAnnotatorWorkloadSummary
} from '../taskAssignment/taskAssignmentHelper';

/**
 * Creates tasks in bulk from parsed file data
 */
export async function createTasksFromFileData(
  data: ParsedRow[],
  batchId: string,
  createdBy: string,
  orgId: string,
  taskType: string = 'annotation',
  requiredAnnotations: number = 1,
  assignedUser?: string | null,
  enableAutoAssignment: boolean = true
): Promise<{ 
  success: boolean; 
  tasksCreated: number; 
  errors: string[];
  assignmentSummary?: Array<{
    annotatorId: string;
    existingTasks: number;
    newTasks: number;
    totalTasks: number;
  }>;
}> {
  const errors: string[] = [];
  let tasksCreated = 0;
  let assignmentSummary: Array<{
    annotatorId: string;
    existingTasks: number;
    newTasks: number;
    totalTasks: number;
  }> | undefined;
  
  console.log('Starting task creation for', data.length, 'rows');
  
  try {
    let processedData = data;
    
    // Handle auto-assignment if enabled and no specific user assigned
    if (enableAutoAssignment && !assignedUser) {
      console.log('Auto-assignment enabled, calculating task distribution...');
      
      // Get active annotators for the organization
      const activeAnnotators = await useTeamStore.getState().getActiveAnnotators(orgId);
      
      if (activeAnnotators.length > 0) {
        console.log('Found', activeAnnotators.length, 'active annotators');
        
        // Get existing task counts for these annotators
        const annotatorIds = activeAnnotators.map(a => a.user_id);
        const existingCounts = await getExistingTaskCounts(orgId, annotatorIds);
        
        // Calculate optimal distribution
        const taskAssignments = calculateTaskDistribution(existingCounts, data.length);
        
        // Generate assignment summary
        assignmentSummary = getAnnotatorWorkloadSummary(existingCounts, taskAssignments);
        console.log('Task assignment summary:', assignmentSummary);
        
        // Assign tasks to annotators
        processedData = assignTasksToAnnotators(data, taskAssignments);
        console.log('Tasks assigned to annotators successfully');
      } else {
        console.log('No active annotators found, proceeding without assignment');
        errors.push('Warning: No active annotators found for task assignment');
      }
    }
    
    // Process data in batches to avoid overwhelming the database
    const batches = chunkArray(processedData, FILE_PROCESSING_CONFIG.BATCH_SIZE);
    console.log('Processing in', batches.length, 'batches of', FILE_PROCESSING_CONFIG.BATCH_SIZE, 'tasks each');
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} tasks`);
      
      const batchResult = await createTaskBatch(
        batch,
        batchId,
        createdBy,
        orgId,
        taskType,
        requiredAnnotations,
        assignedUser // This will be null when auto-assignment is used
      );
      
      console.log(`Batch ${i + 1} result:`, batchResult);
      
      tasksCreated += batchResult.tasksCreated;
      errors.push(...batchResult.errors);
      
      // Add a small delay between batches to avoid rate limiting
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return {
      success: (errors.length === 1 && errors[0].includes('Warning')) || errors.length === 0,
      tasksCreated,
      errors,
      assignmentSummary
    };
  } catch (error) {
    return {
      success: false,
      tasksCreated,
      errors: [`Bulk task creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      assignmentSummary
    };
  }
}

/**
 * Creates a batch of tasks
 */
async function createTaskBatch(
  data: Array<ParsedRow & { assigned_user?: string | null }>,
  batchId: string,
  createdBy: string,
  orgId: string,
  taskType: string,
  requiredAnnotations: number,
  fallbackAssignedUser?: string | null
): Promise<{ tasksCreated: number; errors: string[] }> {
  const errors: string[] = [];
  let tasksCreated = 0;
  
  console.log('Creating task batch with', data.length, 'tasks');
  
  try {
    // Prepare task data for bulk insert
    const tasksToInsert = data.map((row, index) => {
      // Extract assigned_user from row if present, otherwise use fallback
      const { assigned_user, ...taskData } = row;
      
      return {
        id: crypto.randomUUID(),
        batch_id: batchId,
        created_by: createdBy,
        org_id: orgId,
        required_annotations: requiredAnnotations,
        type: taskType,
        task_data: taskData,
        assigned_user: assigned_user !== undefined ? assigned_user : (fallbackAssignedUser || null),
        annotations_done: 0,
        status: 'available',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
    
    // Bulk insert tasks
    console.log('Inserting', tasksToInsert.length, 'tasks into database...');
    const { data: insertedTasks, error } = await supabase
      .from('tasks')
      .insert(tasksToInsert)
      .select();
    
    if (error) {
      console.error('Bulk task creation error:', error);
      errors.push(`Batch insert failed: ${error.message}`);
    } else {
      tasksCreated = insertedTasks?.length || 0;
      console.log('Successfully inserted', tasksCreated, 'tasks');
    }
  } catch (error) {
    console.error('Task batch creation error:', error);
    errors.push(`Task batch creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return { tasksCreated, errors };
}

/**
 * Creates a single task (for manual task creation)
 */
export async function createSingleTask(taskData: TaskCreationData): Promise<{ success: boolean; taskId?: string; error?: string }> {
  try {
    // Validate required fields
    const validationResult = validateTaskData(taskData);
    if (!validationResult.isValid) {
      return {
        success: false,
        error: validationResult.error
      };
    }
    
    const taskToInsert = {
      id: crypto.randomUUID(),
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
    
    const { data, error } = await supabase
      .from('tasks')
      .insert([taskToInsert])
      .select()
      .single();
    
    if (error) {
      console.error('Single task creation error:', error);
      return {
        success: false,
        error: `Failed to create task: ${error.message}`
      };
    }
    
    return {
      success: true,
      taskId: data.id
    };
  } catch (error) {
    console.error('Single task creation error:', error);
    return {
      success: false,
      error: `Task creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Validates task creation data
 */
function validateTaskData(taskData: TaskCreationData): { isValid: boolean; error?: string } {
  if (!taskData.batch_id) {
    return { isValid: false, error: 'Batch ID is required' };
  }
  
  if (!taskData.created_by) {
    return { isValid: false, error: 'Created by is required' };
  }
  
  if (!taskData.org_id) {
    return { isValid: false, error: 'Organization ID is required' };
  }
  
  if (!taskData.type) {
    return { isValid: false, error: 'Task type is required' };
  }
  
  if (taskData.required_annotations < 1) {
    return { isValid: false, error: 'Required annotations must be at least 1' };
  }
  
  if (!taskData.task_data) {
    return { isValid: false, error: 'Task data is required' };
  }
  
  return { isValid: true };
}

/**
 * Gets tasks for a specific batch
 */
export async function getTasksByBatchId(batchId: string): Promise<{ success: boolean; tasks: any[]; error?: string }> {
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
      return {
        success: false,
        tasks: [],
        error: `Failed to fetch tasks: ${error.message}`
      };
    }
    
    return {
      success: true,
      tasks: data || []
    };
  } catch (error) {
    return {
      success: false,
      tasks: [],
      error: `Failed to fetch tasks: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Deletes all tasks for a specific batch
 */
export async function deleteTasksByBatchId(batchId: string): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    // First, get the count of tasks to be deleted
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batchId);
    
    // Delete all tasks for the batch
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('batch_id', batchId);
    
    if (error) {
      return {
        success: false,
        deletedCount: 0,
        error: `Failed to delete tasks: ${error.message}`
      };
    }
    
    return {
      success: true,
      deletedCount: count || 0
    };
  } catch (error) {
    return {
      success: false,
      deletedCount: 0,
      error: `Failed to delete tasks: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Utility functions

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
