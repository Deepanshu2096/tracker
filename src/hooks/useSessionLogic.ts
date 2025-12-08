import { useCallback } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useBreakStore } from '@/store/breakStore';
import { useToast } from '@/hooks/use-toast';

/**
 * Custom hook for session logic with validation and state management
 */
export function useSessionLogic(userId: string | undefined) {
  const { toast } = useToast();
  const {
    currentSession,
    startSession: storeStartSession,
    endSession: storeEndSession,
    getCurrentSession,
  } = useSessionStore();
  
  const { activeBreak, getActiveBreak } = useBreakStore();

  const sessionIsActive = currentSession?.status === 'open';

  /**
   * Validates if a session can be started
   */
  const canStartSession = useCallback(async (): Promise<{ canStart: boolean; reason?: string }> => {
    if (!userId) {
      return { canStart: false, reason: 'User not authenticated' };
    }

    // Rule: Cannot start session if break is active
    if (activeBreak?.id) {
      return { canStart: false, reason: 'Please end your break before checking in.' };
    }

    // Double-check by refreshing break state
    try {
      await getActiveBreak(userId);
      const refreshedBreak = useBreakStore.getState().activeBreak;
      if (refreshedBreak?.id) {
        return { canStart: false, reason: 'Please end your break before checking in.' };
      }
    } catch (error) {
      console.warn('Error checking active break:', error);
      // Continue with check-in if break check fails
    }

    // Rule: Cannot start session if one is already active
    if (sessionIsActive) {
      return { canStart: false, reason: 'You already have an active session.' };
    }

    return { canStart: true };
  }, [userId, activeBreak, sessionIsActive, getActiveBreak]);

  /**
   * Starts a session with validation
   */
  const startSession = useCallback(async (notes?: string | null) => {
    if (!userId) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive',
      });
      return false;
    }

    // Validate before starting
    const validation = await canStartSession();
    if (!validation.canStart) {
      toast({
        title: 'Cannot check in',
        description: validation.reason || 'Cannot start session',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const session = await storeStartSession(notes || null);
      
      if (session) {
        // Refresh current session state
        await getCurrentSession(userId);
        
        toast({
          title: 'Session started',
          description: 'Your work session has started successfully.',
        });
        return true;
      }
      return false;
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to start session';
      
      // Handle specific error codes
      if (error?.code === '409' || errorMessage.includes('work_sessions_one_open_per_user')) {
        toast({
          title: 'Session already active',
          description: 'You already have an open session.',
        });
      } else if (errorMessage.includes('break is active') || errorMessage.includes('end your break')) {
        toast({
          title: 'Cannot check in',
          description: 'Please end your break before checking in.',
          variant: 'destructive',
        });
        // Refresh break state
        await getActiveBreak(userId);
      } else {
        toast({
          title: 'Unable to start session',
          description: errorMessage,
          variant: 'destructive',
        });
      }
      return false;
    }
  }, [userId, canStartSession, storeStartSession, getCurrentSession, getActiveBreak, toast]);

  /**
   * Ends a session
   */
  const endSession = useCallback(async () => {
    if (!currentSession) {
      toast({
        title: 'No active session',
        description: 'There is no active session to end.',
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

    try {
      await storeEndSession(currentSession.id);
      
      // Refresh state
      await getCurrentSession(userId);
      
      toast({
        title: 'Session ended',
        description: 'Your work session has been closed.',
      });
      return true;
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to end session';
      
      if (errorMessage.includes('No open session found')) {
        toast({
          title: 'No open session',
          description: 'There is no active session to end.',
        });
        // Refresh state
        await getCurrentSession(userId);
      } else {
        toast({
          title: 'Unable to end session',
          description: errorMessage,
          variant: 'destructive',
        });
      }
      return false;
    }
  }, [currentSession, userId, storeEndSession, getCurrentSession, toast]);

  return {
    currentSession,
    sessionIsActive,
    canStartSession,
    startSession,
    endSession,
  };
}

