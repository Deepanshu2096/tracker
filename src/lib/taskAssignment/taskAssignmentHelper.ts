import { supabase } from '@/integrations/supabase/client';

export interface AnnotatorTaskCount {
  annotatorId: string;
  assignedTaskCount: number;
}

export interface TaskAssignment {
  annotatorId: string;
  taskCount: number;
}

/**
 * Get existing task counts for annotators in an organization
 */
export async function getExistingTaskCounts(
  orgId: string, 
  annotatorIds: string[]
): Promise<AnnotatorTaskCount[]> {
  if (annotatorIds.length === 0) {
    return [];
  }

  try {
    // Use efficient RPC function for database-level aggregation
    const { data, error } = await supabase.rpc('get_task_counts_by_annotator', {
      org_id_param: orgId,
      annotator_ids: annotatorIds,
      task_statuses: ['available', 'rejected']
    });

    if (error) {
      console.error('Error fetching task counts with RPC:', error);
      
      // Fallback to individual count queries if RPC fails
      console.log('Falling back to individual count queries...');
      const taskCounts = new Map<string, number>();
      
      const countPromises = annotatorIds.map(async (annotatorId) => {
        const { count, error } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('assigned_user', annotatorId)
          .in('status', ['available', 'rejected']);
        
        if (error) {
          console.error(`Error counting tasks for annotator ${annotatorId}:`, error);
          return { annotatorId, count: 0 };
        }
        
        return { annotatorId, count: count || 0 };
      });

      const results = await Promise.all(countPromises);
      results.forEach(({ annotatorId, count }) => {
        taskCounts.set(annotatorId, count);
      });

      return annotatorIds.map(annotatorId => ({
        annotatorId,
        assignedTaskCount: taskCounts.get(annotatorId) || 0
      }));
    }

    // Process RPC results
    const taskCounts = new Map<string, number>();
    
    // Initialize all annotators with 0
    annotatorIds.forEach(id => taskCounts.set(id, 0));
    
    // Set actual counts from RPC results
    (data || []).forEach((result: { assigned_user: string; task_count: number }) => {
      taskCounts.set(result.assigned_user, result.task_count);
    });

    return annotatorIds.map(annotatorId => ({
      annotatorId,
      assignedTaskCount: taskCounts.get(annotatorId) || 0
    }));
  } catch (error) {
    console.error('Failed to get existing task counts:', error);
    // Return zero counts for all annotators if query fails
    return annotatorIds.map(annotatorId => ({
      annotatorId,
      assignedTaskCount: 0
    }));
  }
}

/**
 * Calculate optimal task distribution to balance workload
 */
export function calculateTaskDistribution(
  existingCounts: AnnotatorTaskCount[],
  newTaskCount: number
): TaskAssignment[] {
  if (existingCounts.length === 0) {
    return [];
  }

  if (newTaskCount <= 0) {
    return existingCounts.map(count => ({
      annotatorId: count.annotatorId,
      taskCount: 0
    }));
  }

  // Sort annotators by current task count (ascending) to prioritize those with fewer tasks
  const sortedCounts = [...existingCounts].sort((a, b) => 
    a.assignedTaskCount - b.assignedTaskCount
  );

  const assignments: TaskAssignment[] = sortedCounts.map(count => ({
    annotatorId: count.annotatorId,
    taskCount: 0
  }));

  // Distribute tasks using round-robin approach, starting with annotators who have fewer tasks
  let tasksToDistribute = newTaskCount;
  let currentAnnotatorIndex = 0;

  while (tasksToDistribute > 0) {
    assignments[currentAnnotatorIndex].taskCount++;
    tasksToDistribute--;
    currentAnnotatorIndex = (currentAnnotatorIndex + 1) % assignments.length;
  }

  return assignments;
}

/**
 * Assign tasks to annotators using round-robin distribution
 */
export function assignTasksToAnnotators<T>(
  tasks: T[],
  assignments: TaskAssignment[]
): Array<T & { assigned_user: string | null }> {
  const assignedTasks: Array<T & { assigned_user: string | null }> = [];
  
  // Create a queue of annotators based on their assigned task counts
  const annotatorQueue: string[] = [];
  
  assignments.forEach(assignment => {
    for (let i = 0; i < assignment.taskCount; i++) {
      annotatorQueue.push(assignment.annotatorId);
    }
  });

  // Assign tasks to annotators
  tasks.forEach((task, index) => {
    const assignedUser = annotatorQueue[index] || null;
    assignedTasks.push({
      ...task,
      assigned_user: assignedUser
    });
  });

  return assignedTasks;
}

/**
 * Get annotator workload summary
 */
export function getAnnotatorWorkloadSummary(
  existingCounts: AnnotatorTaskCount[],
  assignments: TaskAssignment[]
): Array<{
  annotatorId: string;
  existingTasks: number;
  newTasks: number;
  totalTasks: number;
}> {
  return existingCounts.map(existing => {
    const assignment = assignments.find(a => a.annotatorId === existing.annotatorId);
    const newTasks = assignment?.taskCount || 0;
    
    return {
      annotatorId: existing.annotatorId,
      existingTasks: existing.assignedTaskCount,
      newTasks,
      totalTasks: existing.assignedTaskCount + newTasks
    };
  });
}