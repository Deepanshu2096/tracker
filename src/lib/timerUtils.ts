/**
 * Timer utilities for annotation session management
 * Uses localStorage for persistent timer state across browser sessions
 */

interface TimerSession {
  taskId: string;
  startTime: string; // ISO string
  elapsedSeconds: number;
  lastUpdated: string; // ISO string
}

const TIMER_SESSION_KEY = 'annotation_timer_session';

export class AnnotationTimer {
  private static instance: AnnotationTimer;
  private intervalId: NodeJS.Timeout | null = null;
  private onTimerUpdate?: (seconds: number) => void;

  static getInstance(): AnnotationTimer {
    if (!AnnotationTimer.instance) {
      AnnotationTimer.instance = new AnnotationTimer();
    }
    return AnnotationTimer.instance;
  }

  /**
   * Initialize timer for a task
   */
  initializeTimer(taskId: string, onUpdate: (seconds: number) => void): { startTime: Date; elapsedSeconds: number } {
    this.clearTimer();
    this.onTimerUpdate = onUpdate;

    const sessionKey = this.getSessionKey(taskId);
    const existingSession = this.getTimerSession(sessionKey);

    let startTime: Date;
    let elapsedSeconds: number;

    if (existingSession && this.isValidSession(existingSession)) {
      // Restore from session
      startTime = new Date(existingSession.startTime);
      elapsedSeconds = existingSession.elapsedSeconds;
      
      // Calculate additional time elapsed since last update to account for inactive time
      const lastUpdated = new Date(existingSession.lastUpdated);
      const additionalTimeElapsed = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      elapsedSeconds = elapsedSeconds + additionalTimeElapsed;
    } else {
      // Fresh start
      startTime = new Date();
      elapsedSeconds = 0;
    }

    // Save initial session
    this.saveTimerSession(sessionKey, {
      taskId,
      startTime: startTime.toISOString(),
      elapsedSeconds,
      lastUpdated: new Date().toISOString()
    });

    // Start countup
    this.startCountup(sessionKey, elapsedSeconds);
    onUpdate(elapsedSeconds);

    return { startTime, elapsedSeconds };
  }

  /**
   * Start the countup timer
   */
  private startCountup(sessionKey: string, initialSeconds: number): void {
    let currentSeconds = initialSeconds;

    this.intervalId = setInterval(() => {
      currentSeconds++;
      
      // Update session storage
      const session = this.getTimerSession(sessionKey);
      if (session) {
        session.elapsedSeconds = currentSeconds;
        session.lastUpdated = new Date().toISOString();
        this.saveTimerSession(sessionKey, session);
      }

      // Update UI
      if (this.onTimerUpdate) {
        this.onTimerUpdate(currentSeconds);
      }
    }, 1000);
  }

  /**
   * Clear current timer
   */
  clearTimer(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Clean up timer for specific task
   */
  cleanupTask(taskId: string): void {
    const sessionKey = this.getSessionKey(taskId);
    localStorage.removeItem(sessionKey);
  }

  /**
   * Clean up all timer data (call when leaving annotation flow)
   */
  cleanupAllTimers(): void {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('timer_')) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    this.clearTimer();
  }

  /**
   * Get current timer session for task
   */
  getCurrentSession(taskId: string): TimerSession | null {
    const sessionKey = this.getSessionKey(taskId);
    return this.getTimerSession(sessionKey);
  }

  /**
   * Reset timer for current task (e.g., when skipping)
   */
  resetTimer(taskId: string): Date {
    const sessionKey = this.getSessionKey(taskId);
    const startTime = new Date();
    
    this.saveTimerSession(sessionKey, {
      taskId,
      startTime: startTime.toISOString(),
      elapsedSeconds: 0,
      lastUpdated: new Date().toISOString()
    });

    return startTime;
  }

  // Private helper methods
  private getSessionKey(taskId: string): string {
    return `timer_${taskId}`;
  }

  private getTimerSession(sessionKey: string): TimerSession | null {
    try {
      const data = localStorage.getItem(sessionKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error parsing timer session:', error);
      return null;
    }
  }

  private saveTimerSession(sessionKey: string, session: TimerSession): void {
    try {
      localStorage.setItem(sessionKey, JSON.stringify(session));
    } catch (error) {
      console.error('Error saving timer session:', error);
    }
  }

  private isValidSession(session: TimerSession): boolean {
    // Validate session is not too old (e.g., more than 24 hours)
    const lastUpdated = new Date(session.lastUpdated);
    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceUpdate < 24 && session.elapsedSeconds >= 0;
  }
}

/**
 * Utility functions for formatting time
 */
export const formatTime = (totalSeconds: number): string => {
  // Ensure valid number
  if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
    totalSeconds = 0;
  }
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
};

/**
 * Calculate time taken from start time to now
 */
export const calculateTimeTaken = (startTime: Date): number => {
  return Math.floor((Date.now() - startTime.getTime()) / 1000);
};