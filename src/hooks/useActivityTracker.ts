import { useEffect, useRef, useState, useCallback } from 'react';

interface ActivityState {
  isActive: boolean;
  lastActivityTime: number;
  idleTime: number; // Total idle time in seconds
  activeTime: number; // Total active time in seconds
  isIdle: boolean;
}

interface UseActivityTrackerOptions {
  idleThresholdMs?: number; // Time in ms before considered idle (default: 1 minute)
  trackingIntervalMs?: number; // How often to check activity (default: 1000ms)
  enabled?: boolean; // Whether tracking is enabled
  onIdleChange?: (isIdle: boolean) => void;
  onIdleWarning?: () => void; // Callback when idle warning should be shown (e.g., after 5 minutes)
  idleWarningThresholdMs?: number; // Time in ms before showing idle warning (default: 5 minutes)
}

const DEFAULT_IDLE_THRESHOLD_MS = 1 * 60 * 1000; // 1 minute
const DEFAULT_TRACKING_INTERVAL_MS = 1000; // 1 second
const DEFAULT_IDLE_WARNING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// Check if running in Tauri
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

// Get Tauri invoke function
function getInvoke(): any {
  if (isTauri()) {
    // @ts-ignore - Tauri types
    return window.__TAURI__?.core?.invoke || window.__TAURI__?.tauri?.invoke;
  }
  return null;
}

// Get Tauri event listen function
function getEventListen(): any {
  if (isTauri()) {
    // @ts-ignore - Tauri types
    return window.__TAURI__?.event?.listen || window.__TAURI__?.core?.event?.listen;
  }
  return null;
}

export function useActivityTracker(options: UseActivityTrackerOptions = {}) {
  const {
    idleThresholdMs = DEFAULT_IDLE_THRESHOLD_MS,
    trackingIntervalMs = DEFAULT_TRACKING_INTERVAL_MS,
    enabled = true,
    onIdleChange,
    onIdleWarning,
    idleWarningThresholdMs = DEFAULT_IDLE_WARNING_THRESHOLD_MS,
  } = options;

  const [activityState, setActivityState] = useState<ActivityState>({
    isActive: false,
    lastActivityTime: Date.now(),
    idleTime: 0,
    activeTime: 0,
    isIdle: false,
  });

  const isTauriMode = isTauri();
  const invoke = getInvoke();
  const eventListen = getEventListen();

  // Browser-based tracking refs (fallback)
  const lastActivityTimeRef = useRef<number>(Date.now());
  const trackingStartTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActiveStateRef = useRef<{ time: number; isIdle: boolean } | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const idleWarningShownRef = useRef<boolean>(false);

  // Tauri native tracking
  const startTauriTracking = useCallback(async () => {
    if (!isTauriMode || !invoke || !enabled) return;

    try {
      await invoke('start_activity_tracking', {
        idleThresholdMs,
        trackingIntervalMs,
      });

      // Listen to activity state updates
      if (eventListen) {
        const unlisten = await eventListen('activity-state', (event: any) => {
          // Map Rust snake_case to TypeScript camelCase
          const rustState = event.payload as {
            is_active: boolean;
            is_idle: boolean;
            last_activity_time: number;
            idle_time: number;
            active_time: number;
          };
          const newState = {
            isActive: rustState.is_active,
            lastActivityTime: rustState.last_activity_time,
            idleTime: rustState.idle_time,
            activeTime: rustState.active_time,
            isIdle: rustState.is_idle,
          };
          
          setActivityState(newState);
          
          // Check if idle time exceeds warning threshold
          if (newState.isIdle && rustState.idle_time >= idleWarningThresholdMs / 1000 && !idleWarningShownRef.current && onIdleWarning) {
            idleWarningShownRef.current = true;
            onIdleWarning();
          } else if (!newState.isIdle) {
            // Reset warning flag when user becomes active again
            idleWarningShownRef.current = false;
          }
        });

        unsubscribeRef.current = unlisten;

        // Listen to idle change events
        const unlistenIdle = await eventListen('activity-idle-change', (event: any) => {
          const isIdle = event.payload as boolean;
          if (onIdleChange) {
            onIdleChange(isIdle);
          }
        });
        
        // Combine unlisten functions
        const originalUnlisten = unsubscribeRef.current;
        unsubscribeRef.current = () => {
          if (originalUnlisten) originalUnlisten();
          if (unlistenIdle) unlistenIdle();
        };
      }
    } catch (error) {
      console.error('Failed to start Tauri activity tracking:', error);
    }
  }, [isTauriMode, invoke, eventListen, enabled, idleThresholdMs, trackingIntervalMs, onIdleChange, idleWarningThresholdMs, onIdleWarning]);

  const stopTauriTracking = useCallback(async () => {
    if (!isTauriMode || !invoke) return;

    try {
      await invoke('stop_activity_tracking');
      
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    } catch (error) {
      console.error('Failed to stop Tauri activity tracking:', error);
    }
  }, [isTauriMode, invoke]);

  const resetTauriTracking = useCallback(async () => {
    if (!isTauriMode || !invoke) return;

    try {
      await invoke('reset_activity_tracking');
    } catch (error) {
      console.error('Failed to reset Tauri activity tracking:', error);
    }
  }, [isTauriMode, invoke]);

  // Browser-based tracking (fallback)
  const handleActivity = useCallback(() => {
    if (!enabled || isTauriMode) return;
    
    const now = Date.now();
    lastActivityTimeRef.current = now;

    setActivityState((prev) => {
      if (trackingStartTimeRef.current !== null && lastActiveStateRef.current) {
        const timeSinceLastState = now - lastActiveStateRef.current.time;
        
        if (lastActiveStateRef.current.isIdle) {
          return {
            ...prev,
            idleTime: prev.idleTime + Math.floor(timeSinceLastState / 1000),
            isIdle: false,
            lastActivityTime: now,
          };
        } else {
          return {
            ...prev,
            activeTime: prev.activeTime + Math.floor(timeSinceLastState / 1000),
            lastActivityTime: now,
          };
        }
      }
      
      return {
        ...prev,
        lastActivityTime: now,
        isIdle: false,
      };
    });

    lastActiveStateRef.current = { time: now, isIdle: false };
  }, [enabled, isTauriMode]);

  const startBrowserTracking = useCallback(() => {
    if (isTauriMode || !enabled) return;

    const now = Date.now();
    trackingStartTimeRef.current = now;
    lastActivityTimeRef.current = now;
    lastActiveStateRef.current = { time: now, isIdle: false };

    setActivityState({
      isActive: true,
      lastActivityTime: now,
      idleTime: 0,
      activeTime: 0,
      isIdle: false,
    });

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityTimeRef.current;
      const isCurrentlyIdle = timeSinceLastActivity >= idleThresholdMs;

      setActivityState((prev) => {
        if (prev.isIdle !== isCurrentlyIdle && trackingStartTimeRef.current && lastActiveStateRef.current) {
          const timeSinceLastState = now - lastActiveStateRef.current.time;

          if (prev.isIdle && !isCurrentlyIdle) {
            const newIdleTime = prev.idleTime + Math.floor(timeSinceLastState / 1000);
            lastActiveStateRef.current = { time: now, isIdle: false };
            
            if (onIdleChange) {
              onIdleChange(false);
            }

            // Reset warning flag when user becomes active
            idleWarningShownRef.current = false;
            
            return {
              ...prev,
              isIdle: false,
              idleTime: newIdleTime,
              lastActivityTime: now,
            };
          } else if (!prev.isIdle && isCurrentlyIdle) {
            const newActiveTime = prev.activeTime + Math.floor(timeSinceLastState / 1000);
            lastActiveStateRef.current = { time: now, isIdle: true };
            
            if (onIdleChange) {
              onIdleChange(true);
            }

            return {
              ...prev,
              isIdle: true,
              activeTime: newActiveTime,
            };
          }
        }

        if (trackingStartTimeRef.current && lastActiveStateRef.current) {
          const timeSinceLastState = now - lastActiveStateRef.current.time;
          
          if (prev.isIdle) {
            const timeToAdd = Math.floor(timeSinceLastState / 1000);
            if (timeToAdd > 0) {
              const newIdleTime = prev.idleTime + timeToAdd;
              
              // Check if idle time exceeds warning threshold (5 minutes)
              if (newIdleTime >= idleWarningThresholdMs / 1000 && !idleWarningShownRef.current && onIdleWarning) {
                idleWarningShownRef.current = true;
                onIdleWarning();
              }
              
              lastActiveStateRef.current = { time: now, isIdle: true };
              return {
                ...prev,
                idleTime: newIdleTime,
              };
            }
          } else {
            // Reset warning flag when user becomes active
            idleWarningShownRef.current = false;
            
            const timeToAdd = Math.floor(timeSinceLastState / 1000);
            if (timeToAdd > 0) {
              lastActiveStateRef.current = { time: now, isIdle: false };
              return {
                ...prev,
                activeTime: prev.activeTime + timeToAdd,
              };
            }
          }
        }

        return prev;
      });
    }, trackingIntervalMs);
  }, [isTauriMode, enabled, idleThresholdMs, trackingIntervalMs, onIdleChange]);

  const stopBrowserTracking = useCallback(() => {
    if (isTauriMode) return;

    const now = Date.now();
    if (trackingStartTimeRef.current && lastActiveStateRef.current) {
      const timeSinceLastState = now - lastActiveStateRef.current.time;
      const timeToAdd = Math.floor(timeSinceLastState / 1000);

      setActivityState((prev) => {
        if (prev.isIdle) {
          return {
            ...prev,
            idleTime: prev.idleTime + timeToAdd,
            isActive: false,
          };
        } else {
          return {
            ...prev,
            activeTime: prev.activeTime + timeToAdd,
            isActive: false,
          };
        }
      });
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    trackingStartTimeRef.current = null;
    lastActiveStateRef.current = null;
  }, [isTauriMode]);

  const resetBrowserTracking = useCallback(() => {
    if (isTauriMode) return;
    
    stopBrowserTracking();
    const now = Date.now();
    trackingStartTimeRef.current = now;
    lastActivityTimeRef.current = now;
    lastActiveStateRef.current = { time: now, isIdle: false };

    setActivityState({
      isActive: true,
      lastActivityTime: now,
      idleTime: 0,
      activeTime: 0,
      isIdle: false,
    });

    startBrowserTracking();
  }, [isTauriMode, stopBrowserTracking, startBrowserTracking]);

  // Unified start/stop/reset functions
  const startTracking = useCallback(() => {
    if (isTauriMode) {
      startTauriTracking();
    } else {
      startBrowserTracking();
    }
  }, [isTauriMode, startTauriTracking, startBrowserTracking]);

  const stopTracking = useCallback(() => {
    if (isTauriMode) {
      stopTauriTracking();
    } else {
      stopBrowserTracking();
    }
  }, [isTauriMode, stopTauriTracking, stopBrowserTracking]);

  const resetTracking = useCallback(() => {
    if (isTauriMode) {
      resetTauriTracking();
    } else {
      resetBrowserTracking();
    }
  }, [isTauriMode, resetTauriTracking, resetBrowserTracking]);

  // Set up browser event listeners
  useEffect(() => {
    if (isTauriMode || !enabled) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'keydown', 'scroll', 'touchstart', 'click'];

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, isTauriMode, handleActivity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      stopTracking();
    };
  }, [stopTracking]);

  return {
    ...activityState,
    startTracking,
    stopTracking,
    resetTracking,
  };
}
