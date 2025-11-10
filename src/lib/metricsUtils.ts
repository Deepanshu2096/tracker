import type { Tables } from '@/integrations/supabase/types';

type TaskHistory = Tables<'task_history'>;

/**
 * Calculates daily throughput based on task history from the last 7 days
 * @param taskHistory - Array of task history records
 * @returns Average number of tasks completed per day over the last 7 days
 */
export const calculateDailyThroughput = (taskHistory: TaskHistory[]): number => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const recentTasks = taskHistory.filter(th => 
    th.end_time && 
    new Date(th.end_time) >= sevenDaysAgo
  );
  
  return Math.round((recentTasks.length / 7) * 10) / 10; // Average per day over 7 days
};