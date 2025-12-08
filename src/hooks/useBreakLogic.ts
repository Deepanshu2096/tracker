import { useCallback } from 'react';
import { useBreakStore } from '@/store/breakStore';
import { useSessionStore } from '@/store/sessionStore';
import { useToast } from '@/hooks/use-toast';

type BreakType = 'lunch' | 'tea' | 'bio' | 'other';

/**
 * Custom hook for break logic with validation and state management
 */
export function useBreakLogic(userId: string | undefined) {
  const { toast } = useToast();
  const {
    activeBreak,
    startBreak: storeStartBreak,
    endBreak: storeEndBreak,
    getActiveBreak,
  } = useBreakStore();
  
  const { currentSession } = useSessionStore();
  const sessionIsActive = currentSession?.status === 'open';

  /**
   * Validates if a break can be started
   */
  const canStartBreak = useCallback(async (): Promise<{ canStart: boolean; reason?: string }> => {
    if (!userId) {
      return { canStart: false, reason: 'User not authenticated' };
    }

    // Rule: Cannot start break if one is already active
    if (activeBreak?.id) {
      return { canStart: false, reason: 'Please end the current break before starting a new one.' };
    }

    // Rule: Cannot start break if session is active
    if (sessionIsActive) {
      return { canStart: false, reason: 'Please end your session before starting a break.' };
    }

    // Double-check session state
    const refreshedSession = useSessionStore.getState().currentSession;
    if (refreshedSession?.status === 'open') {
      return { canStart: false, reason: 'Please end your session before starting a break.' };
    }

    return { canStart: true };
  }, [userId, activeBreak, sessionIsActive]);

  /**
   * Starts a break with validation
   */
  const startBreak = useCallback(async (breakType: BreakType, label?: string) => {
    if (!userId) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive',
      });
      return false;
    }

    // Validate before starting
    const validation = await canStartBreak();
    if (!validation.canStart) {
      toast({
        title: 'Cannot start break',
        description: validation.reason || 'Cannot start break',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const newBreak = await storeStartBreak(breakType, null);
      
      if (newBreak) {
        // Wait a moment for database to commit, then refresh
        await new Promise(resolve => setTimeout(resolve, 300));
        await getActiveBreak(userId);
        
        // Verify break is set
        const refreshedBreak = useBreakStore.getState().activeBreak;
        if (!refreshedBreak?.id) {
          // Retry once more
          await new Promise(resolve => setTimeout(resolve, 200));
          await getActiveBreak(userId);
        }
        
        const breakLabel = label || getBreakLabel(breakType);
        toast({
          title: `${breakLabel} break started`,
          description: 'Enjoy your break!',
        });
        return true;
      }
      
      return false;
    } catch (error: any) {
      const errorMessage = error?.message || error?.details || error?.hint || 'Failed to start break';
      
      toast({
        title: 'Unable to start break',
        description: errorMessage,
        variant: 'destructive',
      });
      return false;
    }
  }, [userId, canStartBreak, storeStartBreak, getActiveBreak, toast]);

  /**
   * Ends a break
   */
  const endBreak = useCallback(async () => {
    if (!activeBreak?.id) {
      toast({
        title: 'No active break',
        description: 'There is no active break to end.',
      });
      return false;
    }

    if (!userId) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive',
      });
      return false;
    }

    const breakId = activeBreak.id;
    const breakType = activeBreak.type;

    try {
      await storeEndBreak(breakId);
      
      // Immediately clear local state (store already does this, but ensure UI updates)
      // Refresh to sync with server
      await getActiveBreak(userId);
      
      toast({
        title: `${getBreakLabel(breakType)} break ended`,
        description: 'Welcome back!',
      });
      return true;
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to end break';
      
      // Refresh state on error to restore correct state
      await getActiveBreak(userId);
      
      toast({
        title: 'Unable to end break',
        description: errorMessage,
        variant: 'destructive',
      });
      return false;
    }
  }, [activeBreak, userId, storeEndBreak, getActiveBreak, toast]);

  return {
    activeBreak,
    canStartBreak,
    startBreak,
    endBreak,
  };
}

/**
 * Helper function to get break label
 */
function getBreakLabel(type: BreakType): string {
  const labels: Record<BreakType, string> = {
    lunch: 'Lunch',
    tea: 'Tea',
    bio: 'Bio',
    other: 'Other',
  };
  return labels[type] || type;
}

