import type { Tables } from '../../integrations/supabase/types';

export interface Task extends Tables<'tasks'> {
    profiles?: {
      name: string | null;
      email: string | null;
    }
  };